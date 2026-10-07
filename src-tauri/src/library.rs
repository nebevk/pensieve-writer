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
    // Windows drops trailing dots and spaces from a folder's name: all of them go here, in any mix, so the
    // path returned is the folder on disk ("Konec . . ." would otherwise come back as "Konec . .").
    let name = name.trim().trim_end_matches(|c: char| c == '.' || c.is_whitespace());
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
    if too_long(&Path::new(&parent).join(folder_name(&name)?).join("pensieve.db")) {
        return Err(TOO_LONG.into());
    }
    let folder = make_folder(&parent, &name)?;
    Ok(Path::new(&folder).join("pensieve.db").display().to_string())
}

const TOO_LONG: &str = "That would make the path too long for Windows; choose a shorter name or a folder higher up";

/// Whether a project file there would reach Windows' old limit of 260 characters, with the "-wal" file
/// SQLite keeps beside it. Pensieve isn't long-path aware, so SQLite couldn't open it.
fn too_long(file: &Path) -> bool {
    file.display().to_string().encode_utf16().count() + "-wal".len() >= 260
}

/// Whether a project file in `dir`, at any depth, would reach that limit once `from` is `to`.
fn too_long_after_move(dir: &Path, from: &Path, to: &Path, seen: &mut usize) -> bool {
    let file = dir.join("pensieve.db");
    if file.is_file() {
        return too_long(&file.strip_prefix(from).map(|rest| to.join(rest)).unwrap_or(file));
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    entries.filter_map(Result::ok).any(|entry| {
        *seen += 1;
        *seen <= MOST && entry.path().is_dir() && too_long_after_move(&entry.path(), from, to, seen)
    })
}

/// A path as Windows compares paths: either slash, no slash at the end, any case.
fn path_key(path: &Path) -> String {
    path.display().to_string().replace('/', "\\").trim_end_matches('\\').to_lowercase()
}

/// Windows refuses to move or delete a folder while a program has a file in it open.
fn in_use(error: std::io::Error) -> String {
    if error.kind() == std::io::ErrorKind::PermissionDenied || error.raw_os_error() == Some(32) {
        "That folder is in use; close what has it open and try again".into()
    } else {
        error.to_string()
    }
}

/// Renames a folder of the library or a project's folder (`parent` stays), or moves it into another
/// folder (`name` stays), and returns where it went. Nothing is replaced, and no folder goes inside itself.
#[tauri::command]
pub async fn move_library_entry(path: String, parent: String, name: String) -> Result<String, String> {
    move_entry(Path::new(&path), Path::new(&parent), &name)
}

fn move_entry(from: &Path, parent: &Path, name: &str) -> Result<String, String> {
    if !from.is_dir() {
        return Err("That folder isn't there any more".into());
    }
    // A bare "E:" is that drive's current folder to Windows, not its top: only a whole path will do.
    if !parent.is_absolute() || !parent.is_dir() {
        return Err("Choose a folder that exists".into());
    }
    let to = parent.join(folder_name(name)?);
    let (from_key, to_key) = (path_key(from), path_key(&to));
    if to_key.starts_with(&format!("{from_key}\\")) {
        return Err("A folder can't go inside itself".into());
    }
    if to_key == from_key {
        // The same folder: at most its capitals change.
        if to.file_name() == from.file_name() {
            return Ok(from.display().to_string());
        }
    } else if to.exists() {
        return Err("Something with that name is already there".into());
    }
    if too_long_after_move(from, from, &to, &mut 0) {
        return Err(TOO_LONG.into());
    }
    fs::rename(from, &to).map_err(in_use)?;
    Ok(to.display().to_string())
}

/// Deletes an empty folder of the library. One with anything in it, a project above all, stays.
#[tauri::command]
pub async fn remove_library_folder(path: String) -> Result<(), String> {
    remove_folder(Path::new(&path))
}

fn remove_folder(dir: &Path) -> Result<(), String> {
    // Deleted or renamed in Explorer since the tree was read, or by a Delete pressed just before.
    if !dir.is_dir() {
        return Err("That folder isn't there any more".into());
    }
    let mut inside = fs::read_dir(dir).map_err(|error| error.to_string())?;
    if inside.next().is_some() {
        return Err("Only an empty folder can be deleted; move what's in it out first".into());
    }
    fs::remove_dir(dir).map_err(in_use)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moving_and_removing_folders() {
        let root = std::env::temp_dir().join(format!("pensieve-library-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("Zgodbe").join("Prva")).unwrap();
        fs::create_dir_all(root.join("Romani")).unwrap();
        // A rename, then a move into another folder, with what is inside.
        let renamed = move_entry(&root.join("Zgodbe"), &root, "Kratke zgodbe").unwrap();
        assert!(Path::new(&renamed).join("Prva").is_dir());
        move_entry(Path::new(&renamed), &root.join("Romani"), "Kratke zgodbe").unwrap();
        assert!(root.join("Romani").join("Kratke zgodbe").join("Prva").is_dir());
        // Never inside itself, never over something already there.
        assert!(move_entry(&root.join("Romani"), &root.join("Romani").join("Kratke zgodbe"), "Romani").is_err());
        fs::create_dir_all(root.join("Drugo")).unwrap();
        assert!(move_entry(&root.join("Drugo"), &root, "Romani").is_err());
        // Only the capitals change.
        assert!(move_entry(&root.join("Drugo"), &root, "drugo").is_ok());
        // An empty folder can be deleted; one with something in it can't.
        assert!(remove_folder(&root.join("Romani")).is_err());
        assert!(remove_folder(&root.join("drugo")).is_ok());
        assert!(!root.join("drugo").exists());
        assert_eq!(remove_folder(&root.join("drugo")), Err("That folder isn't there any more".to_string()));
        // A bare drive is its current folder to Windows, never the parent meant.
        assert!(move_entry(&root.join("Romani"), Path::new("C:"), "Romani").is_err());
        // A project whose file would pass Windows' 260 characters stays where it is.
        fs::create_dir_all(root.join("Brod")).unwrap();
        fs::write(root.join("Brod").join("pensieve.db"), b"").unwrap();
        let deep = root.join("d".repeat(120));
        fs::create_dir_all(&deep).unwrap();
        assert!(move_entry(&root.join("Brod"), &deep, &"b".repeat(120)).is_err());
        assert!(root.join("Brod").join("pensieve.db").is_file());
        assert!(too_long(Path::new(&format!("C:\\{}\\pensieve.db", "a".repeat(250)))));
        assert!(!too_long(Path::new(&format!("C:\\{}\\pensieve.db", "a".repeat(240)))));
        assert!(!too_long(Path::new("C:\\Users\\Eva\\Documents\\Pensieve\\Brod\\pensieve.db")));
        let _ = fs::remove_dir_all(&root);
    }

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
        // Trailing dots and spaces in any mix, as Windows drops them.
        assert_eq!(folder_name("Konec . . .").unwrap(), "Konec");
        assert_eq!(folder_name("Konec.. .").unwrap(), "Konec");
        assert!(folder_name(". . .").is_err());
        assert_eq!(folder_name("Čarovnica").unwrap(), "Čarovnica");
    }
}
