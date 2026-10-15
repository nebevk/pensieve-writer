//! Copies Pensieve keeps in its own folder, apart from her projects: a rescue copy of what couldn't be saved to
//! a project (ARCH-1), and a copy of each writing deleted for good (ARCH-5). Both are backup files, which
//! Settings → Backup & export can bring back.

use crate::disk;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

/// Where kept copies live: "Kept copies" in Pensieve's data folder.
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|error| error.to_string())?.join("Kept copies"))
}

/// The folder for one kind of copy.
fn folder(app: &AppHandle, kind: &str) -> Result<PathBuf, String> {
    let name = match kind {
        "rescue" => "Rescue",
        "deleted" => "Deleted writings",
        _ => return Err("That kind of copy isn't known".into()),
    };
    Ok(root(app)?.join(name))
}

/// A copy's file name: a backup file's, with nothing in it Windows refuses or that leads elsewhere.
fn valid_name(name: &str) -> bool {
    name.len() <= 200
        && name.ends_with(".json")
        && !name.starts_with(['.', ' '])
        && !name.contains("..")
        && !name.chars().any(|c| c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'))
}

/// A kept copy, as the list shows it.
#[derive(Serialize)]
pub struct KeptCopy {
    name: String,
    path: String,
    bytes: u64,
    /// When it was written, in milliseconds since 1970.
    modified: u64,
}

fn write_in(dir: &Path, name: &str, contents: &str) -> Result<PathBuf, String> {
    if !valid_name(name) {
        return Err("The copy's name isn't valid".into());
    }
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let path = dir.join(name);
    disk::replace(&path, &dir.join(format!("{name}.writing")), contents.as_bytes()).map_err(|error| error.to_string())?;
    Ok(path)
}

fn list_in(dir: &Path) -> Vec<KeptCopy> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut copies: Vec<KeptCopy> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            // A copy still being written ends in .writing, and isn't one yet.
            if !name.ends_with(".json") {
                return None;
            }
            let meta = entry.metadata().ok().filter(|meta| meta.is_file())?;
            let modified = meta.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64;
            Some(KeptCopy { path: entry.path().display().to_string(), name, bytes: meta.len(), modified })
        })
        .collect();
    copies.sort_by_key(|copy| std::cmp::Reverse(copy.modified));
    copies
}

fn remove_in(dir: &Path, name: &str) -> Result<(), String> {
    if !valid_name(name) {
        return Err("The copy's name isn't valid".into());
    }
    match fs::remove_file(dir.join(name)) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.to_string()),
        _ => Ok(()),
    }
}

/// The folder one kind of kept copy is in, for the file picker that brings one back.
#[tauri::command(async)]
pub fn kept_copies_folder(app: AppHandle, kind: String) -> Result<String, String> {
    let dir = folder(&app, &kind)?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.display().to_string())
}

/// Writes a kept copy (on the disk, then renamed into place, over an older one of that name); returns where.
#[tauri::command(async)]
pub fn write_kept_copy(app: AppHandle, kind: String, name: String, contents: String) -> Result<String, String> {
    write_in(&folder(&app, &kind)?, &name, &contents).map(|path| path.display().to_string())
}

/// The kept copies of one kind, newest first.
#[tauri::command(async)]
pub fn list_kept_copies(app: AppHandle, kind: String) -> Result<Vec<KeptCopy>, String> {
    Ok(list_in(&folder(&app, &kind)?))
}

/// Removes a kept copy; one that is gone already is fine.
#[tauri::command(async)]
pub fn remove_kept_copy(app: AppHandle, kind: String, name: String) -> Result<(), String> {
    remove_in(&folder(&app, &kind)?, &name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pensieve-kept-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn a_copy_is_written_listed_replaced_and_removed() {
        let dir = folder("round");
        let name = "Zgodbe ob reki 2026-10-15 14-32-05.json";
        write_in(&dir, name, r#"{"naslov":"Čaša"}"#).unwrap();
        write_in(&dir, name, r#"{"naslov":"Čaša, šola, žaba"}"#).unwrap();
        // One left unfinished, as a power cut leaves it, isn't a copy.
        fs::write(dir.join("Drugo.json.writing"), "{").unwrap();
        let copies = list_in(&dir);
        assert_eq!(copies.iter().map(|copy| copy.name.as_str()).collect::<Vec<_>>(), [name]);
        assert_eq!(fs::read_to_string(&copies[0].path).unwrap(), r#"{"naslov":"Čaša, šola, žaba"}"#);
        assert_eq!(copies[0].bytes, r#"{"naslov":"Čaša, šola, žaba"}"#.len() as u64);
        remove_in(&dir, name).unwrap();
        remove_in(&dir, name).unwrap();
        assert!(list_in(&dir).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn names_that_lead_elsewhere_or_that_windows_refuses_are_refused() {
        let dir = folder("names");
        for name in ["../prefs.json", "a\\b.json", "C:x.json", "zapiski.txt", ".json", " x.json", "a?.json", "tab\t.json"] {
            assert!(write_in(&dir, name, "{}").is_err(), "{name}");
            assert!(remove_in(&dir, name).is_err(), "{name}");
        }
        assert!(list_in(&dir).is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
