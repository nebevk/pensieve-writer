use std::fs;
use std::path::{Path, PathBuf};

const KEEP: usize = 20;

/// Writes one backup file. With `book`, only that book's backups count toward the 20 kept,
/// so working on one book never prunes another book's backups.
#[tauri::command]
pub fn write_backup(
    folder: String,
    filename: String,
    contents: String,
    book: Option<String>,
) -> Result<String, String> {
    let prefix = match book.as_deref() {
        Some(key) if !key.is_empty() => {
            if key.len() > 32 || !key.chars().all(|c| c.is_ascii_alphanumeric()) {
                return Err("The backup name is not valid".into());
            }
            format!("pensieve-{key}-")
        }
        _ => "pensieve-".to_string(),
    };
    if !filename.starts_with(&prefix)
        || !filename.ends_with(".json")
        || filename.contains(['/', '\\'])
        || filename.contains("..")
    {
        return Err("The backup name is not valid".into());
    }

    let dir = Path::new(&folder);
    if !dir.is_dir() {
        return Err("Choose a folder that exists. Put it inside Google Drive if you want it synced.".into());
    }

    let path = dir.join(&filename);
    let temporary = dir.join(format!("{filename}.writing"));
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    if path.exists() {
        let _ = fs::remove_file(&temporary);
        return Err("That backup already exists".into());
    }
    if let Err(error) = fs::rename(&temporary, &path) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    remove_partial_backups(dir)?;
    prune_old_backups(dir, &prefix)?;
    Ok(path.display().to_string())
}

/// Reads a backup file the writer picked, so it can be restored.
#[tauri::command]
pub fn read_backup_file(path: String) -> Result<String, String> {
    let file = PathBuf::from(&path);
    let is_json = file
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("json"));
    if !is_json {
        return Err("Choose a Pensieve backup (.json) file.".into());
    }
    fs::read_to_string(&file).map_err(|error| error.to_string())
}

fn remove_partial_backups(dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())?.filter_map(Result::ok) {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("pensieve-") && name.ends_with(".json.writing") {
            fs::remove_file(entry.path()).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn prune_old_backups(dir: &Path, prefix: &str) -> Result<(), String> {
    let mut files: Vec<_> = fs::read_dir(dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            name.starts_with(prefix) && name.ends_with(".json")
        })
        .collect();

    files.sort_by_key(|entry| {
        entry
            .metadata()
            .and_then(|meta| meta.modified())
            .ok()
    });

    let extra = files.len().saturating_sub(KEEP);
    for entry in files.into_iter().take(extra) {
        fs::remove_file(entry.path()).map_err(|error| error.to_string())?;
    }
    Ok(())
}
