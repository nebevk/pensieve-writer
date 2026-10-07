use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};

/// How deep the library is read, and how many entries at most, so a folder chosen by mistake
/// (a whole disk) can't stall the window.
const DEPTH: usize = 6;
const MOST: usize = 2000;

/// A folder in the library, or a project: a folder holding a `pensieve.db`.
#[derive(serde::Serialize)]
pub struct LibraryEntry {
    name: String,
    path: String,
    project: bool,
    children: Vec<LibraryEntry>,
}

/// Where a library can go: Documents, and the home folder for when Documents is synced.
#[derive(serde::Serialize)]
pub struct LibraryPlaces {
    documents: String,
    home: String,
}

// The commands are async, so reading or making folders never holds up the window.
#[tauri::command]
pub async fn library_places(app: AppHandle) -> Result<LibraryPlaces, String> {
    let paths = app.path();
    Ok(LibraryPlaces {
        documents: paths.document_dir().map_err(|error| error.to_string())?.display().to_string(),
        home: paths.home_dir().map_err(|error| error.to_string())?.display().to_string(),
    })
}

/// The folders and projects in the library folder, a few levels deep. A missing folder lists as empty.
#[tauri::command]
pub async fn list_library(folder: String) -> Result<Vec<LibraryEntry>, String> {
    let root = Path::new(&folder);
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let mut seen = 0;
    Ok(read_folder(root, 1, &mut seen))
}

fn read_folder(dir: &Path, depth: usize, seen: &mut usize) -> Vec<LibraryEntry> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut found = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        if *seen >= MOST {
            break;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        // Hidden and system folders are not the writer's.
        if name.starts_with('.') || name.starts_with('$') || hidden(&entry) || !path.is_dir() {
            continue;
        }
        *seen += 1;
        let project = path.join("pensieve.db").is_file();
        let children = if project || depth >= DEPTH {
            Vec::new()
        } else {
            read_folder(&path, depth + 1, seen)
        };
        found.push(LibraryEntry {
            name,
            path: path.display().to_string(),
            project,
            children,
        });
    }
    found
}

/// Whether Windows marks a folder hidden or as the system's ("System Volume Information", say).
#[cfg(windows)]
fn hidden(entry: &fs::DirEntry) -> bool {
    use std::os::windows::fs::MetadataExt;
    const HIDDEN: u32 = 0x2;
    const SYSTEM: u32 = 0x4;
    entry
        .metadata()
        .map(|meta| meta.file_attributes() & (HIDDEN | SYSTEM) != 0)
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn hidden(_entry: &fs::DirEntry) -> bool {
    false
}

/// A name Windows accepts for a folder, trimmed; the message says what to change otherwise.
fn folder_name(name: &str) -> Result<String, String> {
    let name = name.trim().trim_end_matches('.').trim_end();
    if name.is_empty() || name == "." || name == ".." {
        return Err("Give the folder a name".into());
    }
    if name.chars().count() > 120 {
        return Err("That name is too long for a folder".into());
    }
    if name.chars().any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control()) {
        return Err("A folder name can't have \\ / : * ? \" < > or |".into());
    }
    // A leading dot or dollar sign makes a folder the library leaves out, as Windows and other programs keep those.
    if name.starts_with('.') || name.starts_with('$') {
        return Err("A folder name can't start with . or $".into());
    }
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit());
    if reserved {
        return Err("Windows keeps that name for itself; choose another".into());
    }
    Ok(name.to_string())
}

/// Makes a new folder in `parent` and returns its path. A folder of that name already there is refused.
#[tauri::command]
pub async fn create_library_folder(parent: String, name: String) -> Result<String, String> {
    make_folder(&parent, &name)
}

fn make_folder(parent: &str, name: &str) -> Result<String, String> {
    let dir = Path::new(parent);
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let path = dir.join(folder_name(name)?);
    if path.exists() {
        return Err("Something with that name is already there".into());
    }
    fs::create_dir(&path).map_err(|error| error.to_string())?;
    Ok(path.display().to_string())
}

/// Makes the folder for a new project in `parent` and returns where its file goes. The file itself
/// is made when Pensieve opens it.
#[tauri::command]
pub async fn new_project_folder(parent: String, name: String) -> Result<String, String> {
    let folder = make_folder(&parent, &name)?;
    Ok(Path::new(&folder).join("pensieve.db").display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_names() {
        assert_eq!(folder_name("  Zgodbe ob reki  ").unwrap(), "Zgodbe ob reki");
        assert_eq!(folder_name("Notes.").unwrap(), "Notes");
        assert!(folder_name("").is_err());
        assert!(folder_name("a/b").is_err());
        assert!(folder_name("Con").is_err());
        assert!(folder_name("com1.txt").is_err());
        assert!(folder_name("Comedy").is_ok());
        assert!(folder_name(".hidden").is_err());
        assert!(folder_name("$money").is_err());
        assert_eq!(folder_name("Čarovnica").unwrap(), "Čarovnica");
    }
}
