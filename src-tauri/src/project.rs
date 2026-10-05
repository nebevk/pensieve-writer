use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn app_database(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_config_dir().map_err(|error| error.to_string())?;
    path.push("pensieve.db");
    Ok(path)
}

/// Whether a remembered book file is still there. Opening a missing path would create an empty book.
#[tauri::command]
pub fn project_file_exists(path: String) -> bool {
    Path::new(&path).is_file()
}

#[tauri::command]
pub fn default_project_path(app: AppHandle) -> Result<String, String> {
    Ok(app_database(&app)?.display().to_string())
}

/// Copy the live project database into `folder/pensieve.db` using a temp file and rename.
#[tauri::command]
pub fn relocate_project(source: String, folder: String) -> Result<String, String> {
    let from = PathBuf::from(source);
    if !from.is_file() {
        return Err("The project file was not found".into());
    }
    let dir = Path::new(&folder);
    if !dir.is_dir() {
        return Err("Choose a folder that exists".into());
    }
    let dest = dir.join("pensieve.db");
    if dest == from {
        return Ok(dest.display().to_string());
    }
    if dest.exists() {
        return Err("That folder already contains a pensieve.db file".into());
    }

    let temporary = dir.join("pensieve.db.writing");
    fs::copy(&from, &temporary).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &dest).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        error.to_string()
    })?;
    Ok(dest.display().to_string())
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

/// Replace the settings file by writing a temp file and renaming it into place.
#[tauri::command]
pub fn write_prefs(app: AppHandle, contents: String) -> Result<(), String> {
    let path = prefs_path(&app)?;
    let dir = path.parent().ok_or("The settings folder is missing")?;
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let temporary = dir.join("prefs.json.writing");
    let previous = dir.join("prefs.json.previous");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    if path.exists() {
        let _ = fs::remove_file(&previous);
        fs::rename(&path, &previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temporary, &path) {
        let _ = fs::rename(&previous, &path);
        return Err(error.to_string());
    }
    let _ = fs::remove_file(&previous);
    Ok(())
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
