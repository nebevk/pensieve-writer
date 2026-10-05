mod backup;
mod export;
mod project;
mod spellcheck;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "projects_chapters_schema_version",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "notes_tasks_and_chapter_meta",
            sql: include_str!("../migrations/002_notes_tasks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "language_snapshot_kinds_dictionary",
            sql: include_str!("../migrations/003_language_snapshots.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pensieve.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            backup::write_backup,
            backup::read_backup_file,
            export::write_document,
            project::default_project_path,
            project::project_file_exists,
            project::example_book_path,
            project::relocate_project,
            project::reserve_project_path,
            project::read_image_file,
            project::read_prefs,
            project::write_prefs,
            spellcheck::probe_spellcheck,
            spellcheck::add_personal_word,
            spellcheck::remove_personal_word
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png"))?;
                window.set_icon(icon)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
