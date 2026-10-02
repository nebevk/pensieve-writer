use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn app_database(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_config_dir().map_err(|error| error.to_string())?;
    path.push("pensieve.db");
    Ok(path)
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
