//! Windows shutting down, or signing out, while Pensieve is open (ARCH-23). The window ends the process as soon as
//! the session ends, before the page can save. So when Windows asks whether it may end the session, Pensieve holds
//! it, with a reason Windows shows, and asks the page to save; once the page says it has, Pensieve closes and
//! Windows goes on. A shutdown she cancels leaves it open.

use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/// Where the session's end is.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Step {
    /// Nothing asked.
    Open,
    /// Windows asked to end the session; the page is saving.
    Saving,
    /// Saved: Windows may go on.
    Saved,
}

/// Windows asks to end the session: the next step, whether to hold it now, and whether to ask the page to save. A
/// critical end can't be held: the page is asked all the same, and saves what it can in the time left.
fn on_query(step: Step, critical: bool) -> (Step, bool, bool) {
    match step {
        Step::Saved => (Step::Saved, false, false),
        Step::Open => (Step::Saving, !critical, true),
        Step::Saving => (Step::Saving, !critical, false),
    }
}

/// The page has saved: the next step, and whether to close Pensieve, as the session is still ending.
fn on_saved(step: Step) -> (Step, bool) {
    match step {
        Step::Saving => (Step::Saved, true),
        other => (other, false),
    }
}

static STEP: AtomicU8 = AtomicU8::new(0);
/// What Windows shows while it waits, in her language; the page says it at the start.
static REASON: Mutex<String> = Mutex::new(String::new());

fn load() -> Step {
    match STEP.load(Ordering::SeqCst) {
        1 => Step::Saving,
        2 => Step::Saved,
        _ => Step::Open,
    }
}

fn store(step: Step) {
    STEP.store(
        match step {
            Step::Open => 0,
            Step::Saving => 1,
            Step::Saved => 2,
        },
        Ordering::SeqCst,
    );
}

/// The words Windows shows while Pensieve saves, in the language she reads.
#[tauri::command]
pub fn session_reason(text: String) {
    if let Ok(mut reason) = REASON.lock() {
        *reason = text;
    }
}

/// The page has saved her words: Pensieve closes, if Windows is still waiting to end the session.
#[tauri::command]
pub fn session_saved(app: AppHandle) {
    let (next, close) = on_saved(load());
    store(next);
    if close {
        #[cfg(windows)]
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    let _ = windows::Win32::System::Shutdown::ShutdownBlockReasonDestroy(windows::Win32::Foundation::HWND(hwnd.0));
                }
            }
        }
        app.exit(0);
    }
}

/// Watches the window for the session's end.
#[cfg(windows)]
pub fn watch(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::SetWindowSubclass;
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    // The app lives as long as the window: the handle given to Windows is never taken back.
    let app = Box::into_raw(Box::new(window.app_handle().clone())) as usize;
    unsafe {
        let _ = SetWindowSubclass(HWND(hwnd.0), Some(on_message), 1, app);
    }
}

#[cfg(not(windows))]
pub fn watch(_window: &tauri::WebviewWindow) {}

#[cfg(windows)]
unsafe extern "system" fn on_message(
    hwnd: windows::Win32::Foundation::HWND,
    message: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    app: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::System::Shutdown::{ShutdownBlockReasonCreate, ShutdownBlockReasonDestroy};
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::{ENDSESSION_CRITICAL, WM_ENDSESSION, WM_QUERYENDSESSION};

    if message == WM_QUERYENDSESSION {
        let critical = (lparam.0 as u32) & ENDSESSION_CRITICAL != 0;
        let (next, hold, ask) = on_query(load(), critical);
        store(next);
        if ask {
            let app = unsafe { &*(app as *const AppHandle) };
            let _ = app.emit("pensieve://session-ending", ());
        }
        if hold {
            let said = REASON.lock().map(|reason| reason.clone()).unwrap_or_default();
            let reason: Vec<u16> = (if said.is_empty() { "Pensieve is saving your words".to_string() } else { said })
                .encode_utf16()
                .chain(Some(0))
                .collect();
            unsafe {
                let _ = ShutdownBlockReasonCreate(hwnd, PCWSTR(reason.as_ptr()));
            }
            return LRESULT(0);
        }
    } else if message == WM_ENDSESSION && wparam.0 == 0 {
        // She cancelled: Pensieve stays open, as it was.
        store(Step::Open);
        unsafe {
            let _ = ShutdownBlockReasonDestroy(hwnd);
        }
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_session_waits_while_she_has_words_to_save() {
        // Asked: held, and the page asked once.
        assert_eq!(on_query(Step::Open, false), (Step::Saving, true, true));
        assert_eq!(on_query(Step::Saving, false), (Step::Saving, true, false));
        // Saved: Pensieve closes, and Windows goes on.
        assert_eq!(on_saved(Step::Saving), (Step::Saved, true));
        assert_eq!(on_query(Step::Saved, false), (Step::Saved, false, false));
    }

    #[test]
    fn a_critical_end_is_never_held_but_still_saves_what_it_can() {
        assert_eq!(on_query(Step::Open, true), (Step::Saving, false, true));
    }

    #[test]
    fn a_save_after_she_cancelled_leaves_pensieve_open() {
        assert_eq!(on_saved(Step::Open), (Step::Open, false));
    }
}
