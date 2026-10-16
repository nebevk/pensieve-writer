use crate::disk;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn app_database(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_config_dir().map_err(|error| error.to_string())?;
    path.push("pensieve.db");
    Ok(path)
}

#[derive(serde::Serialize)]
pub struct ExamplePath {
    path: String,
    exists: bool,
}

/// Where an example book lives: `<app config>/examples/<name>.db`, apart from the writer's own books.
#[tauri::command]
pub fn example_book_path(app: AppHandle, name: String) -> Result<ExamplePath, String> {
    if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("The example name is not valid".into());
    }
    let mut dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
    dir.push("examples");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = dir.join(format!("{name}.db"));
    Ok(ExamplePath {
        exists: path.is_file(),
        path: path.display().to_string(),
    })
}

/// Whether a remembered book file is still there. Opening a missing path would create an empty book. Off the
/// window's thread: on a network drive that is gone, asking can take Windows a long while.
#[tauri::command(async)]
pub fn project_file_exists(path: String) -> bool {
    Path::new(&path).is_file()
}

#[tauri::command]
pub fn default_project_path(app: AppHandle) -> Result<String, String> {
    Ok(app_database(&app)?.display().to_string())
}

/// A project's copy, which SQLite wrote (`VACUUM INTO`) as `pensieve.db.writing` in `folder`, put on the disk and
/// then in place as the folder's `pensieve.db`: never over another project's file (ARCH-6). Returns where it is.
#[tauri::command(async)]
pub fn settle_project_copy(copy: String, folder: String) -> Result<String, String> {
    settle_copy(Path::new(&copy), Path::new(&folder)).map(|dest| dest.display().to_string())
}

fn settle_copy(copy: &Path, dir: &Path) -> Result<PathBuf, String> {
    if copy.parent() != Some(dir) || copy.file_name().and_then(|name| name.to_str()) != Some("pensieve.db.writing") || !copy.is_file() {
        return Err("The project file was not found".into());
    }
    let dest = dir.join("pensieve.db");
    if dest.exists() {
        let _ = fs::remove_file(copy);
        return Err("That folder already contains a pensieve.db file".into());
    }
    disk::flush(copy);
    fs::rename(copy, &dest).map_err(|error| {
        let _ = fs::remove_file(copy);
        error.to_string()
    })?;
    Ok(dest)
}

/// Path for a new book. The file is created when Pensieve opens it.
#[tauri::command]
pub fn reserve_project_path(folder: String) -> Result<String, String> {
    let dir = Path::new(&folder);
    if !dir.is_dir() {
        return Err("Choose a folder that exists".into());
    }
    let dest = dir.join("pensieve.db");
    if dest.exists() {
        return Err("That folder already has a book. Open that file instead.".into());
    }
    Ok(dest.display().to_string())
}

fn prefs_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_config_dir().map_err(|error| error.to_string())?;
    path.push("prefs.json");
    Ok(path)
}

#[tauri::command]
pub fn read_prefs(app: AppHandle) -> Result<String, String> {
    let path = prefs_path(&app)?;
    if !path.is_file() {
        return Ok(String::new());
    }
    fs::read_to_string(path).map_err(|error| error.to_string())
}

/// Replaces the settings file in one step: a temp file, on the disk, renamed over the old one, which stays
/// whole until then (ARCH-17). Off the window's thread (ARCH-10); prefs.ts sends one write at a time.
#[tauri::command(async)]
pub fn write_prefs(app: AppHandle, contents: String) -> Result<(), String> {
    let path = prefs_path(&app)?;
    let dir = path.parent().ok_or("The settings folder is missing")?;
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    disk::replace(&path, &dir.join("prefs.json.writing"), contents.as_bytes()).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pensieve-settle-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_copy_goes_in_place_and_never_over_another_project() {
        let dir = folder("place").join("Zgodbe ob reki");
        fs::create_dir_all(&dir).unwrap();
        let copy = dir.join("pensieve.db.writing");
        fs::write(&copy, "SQLite format 3, čšž").unwrap();
        assert_eq!(settle_copy(&copy, &dir).unwrap(), dir.join("pensieve.db"));
        assert_eq!(fs::read_to_string(dir.join("pensieve.db")).unwrap(), "SQLite format 3, čšž");
        assert!(!copy.exists());
        // Another project there already: refused, and the copy goes.
        fs::write(&copy, "druga").unwrap();
        assert!(settle_copy(&copy, &dir).is_err());
        assert_eq!(fs::read_to_string(dir.join("pensieve.db")).unwrap(), "SQLite format 3, čšž");
        assert!(!copy.exists());
        // Only the copy SQLite wrote, in that folder.
        let elsewhere = folder("elsewhere");
        fs::write(elsewhere.join("pensieve.db.writing"), "x").unwrap();
        assert!(settle_copy(&elsewhere.join("pensieve.db.writing"), &dir).is_err());
        assert!(settle_copy(&dir.join("prefs.json"), &dir).is_err());
        fs::remove_dir_all(dir.parent().unwrap()).unwrap();
        fs::remove_dir_all(&elsewhere).unwrap();
    }
}

/// Read an image the writer just chose. Only common image extensions are accepted.
#[tauri::command]
pub fn read_image_file(path: String) -> Result<Vec<u8>, String> {
    let file = PathBuf::from(&path);
    let extension = file
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp") {
        return Err("Choose a PNG, JPEG, GIF, or WebP image.".into());
    }
    fs::read(&file).map_err(|error| error.to_string())
}
