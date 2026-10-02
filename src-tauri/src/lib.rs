mod backup;
mod project;
mod spellcheck;

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
            project::default_project_path,
            project::relocate_project,
            spellcheck::probe_spellcheck,
            spellcheck::add_personal_word
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
