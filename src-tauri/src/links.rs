use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, Url};

/// A web page or an e-mail address: what a link in her text may open, outside Pensieve.
fn opens_outside(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "mailto")
}

/// Pensieve's own page in the window: the app (tauri.localhost on Windows), or the dev server under `tauri dev`.
fn pensieve_page(url: &Url) -> bool {
    let host = url.host_str();
    match url.scheme() {
        "tauri" => true,
        "http" | "https" if host == Some("tauri.localhost") => true,
        "http" => cfg!(dev) && matches!(host, Some("localhost" | "127.0.0.1")),
        _ => false,
    }
}

/// Keeps the window on Pensieve. It has no Back button, so a link that took it to a web page (in the Book
/// view, say) left her nothing to do but close Pensieve. A web or e-mail link opens in her browser or mail
/// program instead; anything else (a file dropped on the window) goes nowhere.
pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("window-guard")
        .on_navigation(|_, url| {
            if pensieve_page(url) {
                return true;
            }
            if opens_outside(url) {
                let url = url.to_string();
                // Not on the window's thread, which is busy with the navigation.
                tauri::async_runtime::spawn_blocking(move || {
                    let _ = tauri_plugin_opener::open_url(url, None::<&str>);
                });
            }
            false
        })
        .build()
}

/// Opens a link of hers, a web page or an e-mail address, in her browser or mail program.
#[tauri::command]
pub async fn open_link(url: String) -> Result<(), String> {
    let link = Url::parse(&url).map_err(|_| "That link isn't a web address".to_string())?;
    if !opens_outside(&link) {
        return Err("Pensieve opens only web and e-mail links".into());
    }
    tauri_plugin_opener::open_url(link.as_str(), None::<&str>).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(text: &str) -> Url {
        Url::parse(text).unwrap()
    }

    #[test]
    fn the_window_stays_on_pensieve() {
        for own in ["http://tauri.localhost/", "http://tauri.localhost/spellcheck", "https://tauri.localhost/", "tauri://localhost/"] {
            assert!(pensieve_page(&url(own)), "{own}");
        }
        for other in [
            "https://example.com/",
            "http://tauri.localhost.example.com/",
            "file:///C:/Users/Eva/Zgodba.docx",
            "about:blank",
            "mailto:eva@example.com",
            "javascript:alert(1)",
        ] {
            assert!(!pensieve_page(&url(other)), "{other}");
        }
        // The dev server, only under `tauri dev`.
        assert_eq!(pensieve_page(&url("http://localhost:1420/")), cfg!(dev));
    }

    #[test]
    fn only_web_and_e_mail_links_open_outside() {
        for link in ["https://example.com/zemljevid", "http://example.com", "mailto:eva@example.com", "HTTPS://EXAMPLE.COM/"] {
            assert!(opens_outside(&url(link)), "{link}");
        }
        for link in ["file:///C:/Windows/System32/calc.exe", "javascript:alert(1)", "ms-settings:", "tauri://localhost/"] {
            assert!(!opens_outside(&url(link)), "{link}");
        }
    }
}
