mod backup;
mod disk;
mod export;
mod kept;
mod library;
mod links;
mod project;
mod session;
mod spellcheck;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // One Pensieve at a time (ARCH-2): starting it again, from its icon while it sits minimised say, brings
    // the open window back instead of a second copy whose saves would overwrite the first's. First, so a
    // second copy quits before anything else starts. Not under `tauri dev`, which runs beside an installed
    // Pensieve.
    #[cfg(not(dev))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));

    builder
        // The window stays on Pensieve: a link opens in her browser.
        .plugin(links::guard())
        .plugin(tauri_plugin_dialog::init())
        // Updates from GitHub Releases, signed with the owner's key (see docs/releasing.md).
        .plugin(tauri_plugin_updater::Builder::new().build())
        // A project's file is made ready by sqlite.ts (ensureSchema), whatever its path; the plugin only opens it.
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            backup::write_backup,
            backup::read_backup_file,
            export::write_document,
            kept::kept_copies_folder,
            kept::write_kept_copy,
            kept::list_kept_copies,
            kept::remove_kept_copy,
            library::library_places,
            library::list_library,
            library::create_library_folder,
            library::new_project_folder,
            library::move_library_entry,
            library::remove_library_folder,
            library::trash_project_folder,
            library::open_library_file,
            library::show_in_explorer,
            library::read_document_file,
            links::open_link,
            project::default_project_path,
            project::project_file_exists,
            project::example_book_path,
            project::settle_project_copy,
            project::reserve_project_path,
            project::read_image_file,
            project::read_prefs,
            project::write_prefs,
            session::session_reason,
            session::session_saved,
            spellcheck::probe_spellcheck,
            spellcheck::add_personal_word,
            spellcheck::remove_personal_word
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png"))?;
                window.set_icon(icon)?;
                // Windows shutting down waits while her words are saved (ARCH-23).
                session::watch(&window);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
