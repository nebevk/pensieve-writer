use std::fs;
use std::path::{Component, Path};
use tauri::{AppHandle, Manager};

/// How deep the library is read, and how many folders and files at most, so a folder chosen by mistake
/// (Documents, a whole disk) can't stall the window or fill the tree.
const DEPTH: usize = 6;
const MOST: usize = 2000;
const MOST_FILES: usize = 1000;

/// How many files of one folder are listed at most, after its folders and projects.
const FILES_PER_FOLDER: usize = 300;

/// The open project's own folders and files are read on a budget of their own, so a project full of
/// folders (years of photos) never pushes the library's other projects out of the listing.
const IN_PROJECT: usize = 300;

/// What one listing may still read, and how.
struct Walk {
    folders: usize,
    files: usize,
    /// The open project's folder, as path_key gives it: the only project whose own contents are read.
    open: String,
    /// Links to folders (junctions) are followed in the library, never inside a project.
    links: bool,
}

/// A folder in the library, a project (a folder holding a `pensieve.db`), or a file of hers in either.
#[derive(serde::Serialize)]
pub struct LibraryEntry {
    name: String,
    path: String,
    project: bool,
    /// A file, opened in its own program.
    file: bool,
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

/// The folders, projects and files in the library folder, a few levels deep, and the open project's
/// (`open`, its folder) own folders and files. A missing folder lists as empty.
#[tauri::command]
pub async fn list_library(folder: String, open: Option<String>) -> Result<Vec<LibraryEntry>, String> {
    let root = Path::new(&folder);
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let open = open.map(|path| path_key(Path::new(&path))).unwrap_or_default();
    Ok(read_folder(root, 1, &mut Walk { folders: MOST, files: MOST_FILES, open, links: true }))
}

fn read_folder(dir: &Path, depth: usize, walk: &mut Walk) -> Vec<LibraryEntry> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut found = Vec::new();
    let mut files = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        if walk.folders == 0 {
            break;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        // Hidden and system files and folders are not the writer's, and neither are Word's lock files ("~$...").
        if name.starts_with('.') || name.starts_with('$') || name.starts_with("~$") || hidden(&entry) {
            continue;
        }
        // What it is comes with the folder's listing: no extra trip to the disk for each of its files.
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        if kind.is_symlink() && !walk.links {
            continue;
        }
        if kind.is_dir() || (kind.is_symlink() && path.is_dir()) {
            walk.folders -= 1;
            let project = path.join("pensieve.db").is_file();
            let children = if depth >= DEPTH {
                Vec::new()
            } else if project {
                // Only the open project's own folders and files are shown (its Files), on their own budget.
                if path_key(&path) == walk.open {
                    read_folder(&path, depth + 1, &mut Walk { folders: IN_PROJECT, files: MOST_FILES, open: String::new(), links: false })
                } else {
                    Vec::new()
                }
            } else {
                read_folder(&path, depth + 1, walk)
            };
            found.push(LibraryEntry {
                project,
                name,
                path: path.display().to_string(),
                file: false,
                children,
            });
        } else if kind.is_file() && files.len() < FILES_PER_FOLDER && walk.files > 0 && !pensieve_own(&name) {
            walk.files -= 1;
            files.push(LibraryEntry {
                name,
                path: path.display().to_string(),
                project: false,
                file: true,
                children: Vec::new(),
            });
        }
    }
    found.extend(files);
    found
}

/// A project's file, and the ones SQLite and Pensieve keep beside it: never shown as one of her files.
fn pensieve_own(name: &str) -> bool {
    name.to_lowercase().starts_with("pensieve.db")
}

/// Kinds of file that run as programs or scripts: nothing in the library starts one.
const PROGRAMS: &[&str] = &[
    "appref-ms", "application", "bat", "chm", "cmd", "com", "cpl", "exe", "gadget", "hta", "inf", "jar", "js", "jse", "lnk",
    "msc", "msi", "msp", "pif", "ps1", "psm1", "reg", "scf", "scr", "sct", "url", "vb", "vbe", "vbs", "ws", "wsc", "wsf",
    "wsh",
];

fn starts_program(file: &Path) -> bool {
    let kind = file.extension().map(|kind| kind.to_string_lossy().to_lowercase()).unwrap_or_default();
    PROGRAMS.contains(&kind.as_str())
}

/// Opens a file of the library in its own program, as a double click in Explorer does. Programs and
/// scripts are refused.
#[tauri::command]
pub async fn open_library_file(path: String) -> Result<(), String> {
    let file = Path::new(&path);
    if !file.is_file() {
        return Err("That file isn't there any more".into());
    }
    if starts_program(file) {
        return Err("Pensieve doesn't start programs; open it from Explorer if you trust it".into());
    }
    tauri_plugin_opener::open_path(file, None::<&str>).map_err(|error| error.to_string())
}

/// Shows a file or folder of the library in Explorer, selected.
#[tauri::command]
pub async fn show_in_explorer(path: String) -> Result<(), String> {
    let item = Path::new(&path);
    if !item.exists() {
        return Err("That isn't there any more".into());
    }
    tauri_plugin_opener::reveal_item_in_dir(item).map_err(|error| error.to_string())
}

/// The kinds of file that can come in as a writing: Word, OpenDocument (LibreOffice), text and Markdown.
const DOCUMENTS: &[&str] = &["docx", "odt", "txt", "md", "markdown"];

fn is_document(file: &Path) -> bool {
    let kind = file.extension().map(|kind| kind.to_string_lossy().to_lowercase()).unwrap_or_default();
    DOCUMENTS.contains(&kind.as_str())
}

/// A Word, OpenDocument, text or Markdown file's bytes, to bring it into a project as a writing.
#[tauri::command]
pub async fn read_document_file(path: String) -> Result<tauri::ipc::Response, String> {
    read_document(Path::new(&path)).map(tauri::ipc::Response::new)
}

fn read_document(file: &Path) -> Result<Vec<u8>, String> {
    if !is_document(file) {
        return Err("Only a Word, OpenDocument, text or Markdown file can come in as a writing".into());
    }
    let size = fs::metadata(file).map_err(|_| "That file isn't there any more".to_string())?.len();
    // Pictures make a Word or OpenDocument file big; text that size would be shelves of books.
    let packed = file.extension().is_some_and(|kind| kind.eq_ignore_ascii_case("docx") || kind.eq_ignore_ascii_case("odt"));
    let most = if packed { 200 } else { 20 };
    if size > most * 1024 * 1024 {
        return Err("That file is too big to bring in".into());
    }
    fs::read(file).map_err(|error| error.to_string())
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

const NOT_LIBRARY: &str = "Only a folder of the library can be moved or deleted from here";

/// A whole path, from a drive or a share, with no "." or ".." that could lead out of the folder it seems to be in.
fn whole(path: &Path) -> bool {
    path.is_absolute() && !path.components().any(|part| matches!(part, Component::ParentDir | Component::CurDir))
}

/// Whether `path` is inside the library folder (`library`), never the library itself.
fn in_library(path: &Path, library: &Path) -> bool {
    whole(path) && whole(library) && path_key(path).starts_with(&format!("{}\\", path_key(library)))
}

/// The library folder, or a folder inside it.
fn library_or_in(path: &Path, library: &Path) -> bool {
    (whole(path) && whole(library) && path_key(path) == path_key(library)) || in_library(path, library)
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
/// Only a folder inside the library (`library`) moves, and only within it.
#[tauri::command]
pub async fn move_library_entry(path: String, parent: String, name: String, library: String) -> Result<String, String> {
    move_entry(Path::new(&path), Path::new(&parent), &name, Path::new(&library))
}

fn move_entry(from: &Path, parent: &Path, name: &str, library: &Path) -> Result<String, String> {
    if !from.is_dir() {
        return Err("That folder isn't there any more".into());
    }
    if !in_library(from, library) || !library_or_in(parent, library) {
        return Err(NOT_LIBRARY.into());
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

/// Deletes an empty folder inside the library (`library`). One with anything in it, a project above all, stays.
#[tauri::command]
pub async fn remove_library_folder(path: String, library: String) -> Result<(), String> {
    remove_folder(Path::new(&path), Path::new(&library))
}

fn remove_folder(dir: &Path, library: &Path) -> Result<(), String> {
    // Deleted or renamed in Explorer since the tree was read, or by a Delete pressed just before.
    if !dir.is_dir() {
        return Err("That folder isn't there any more".into());
    }
    if !in_library(dir, library) {
        return Err(NOT_LIBRARY.into());
    }
    let mut inside = fs::read_dir(dir).map_err(|error| error.to_string())?;
    if inside.next().is_some() {
        return Err("Only an empty folder can be deleted; move what's in it out first".into());
    }
    fs::remove_dir(dir).map_err(in_use)
}

/// Moves a project's folder to the Recycle Bin (HOME-15), from where it can be brought back as it was. Only the
/// folder of a project in the library goes, one with its pensieve.db. Where there is no Recycle Bin (a network
/// folder, say), Windows asks her itself before deleting it for good; false when she said no there.
/// Not async, so it runs on the window's thread and that question belongs to her window.
#[tauri::command]
pub fn trash_project_folder(window: tauri::WebviewWindow, path: String, library: String) -> Result<bool, String> {
    trash_project(Path::new(&path), Path::new(&library), owner(&window))
}

#[cfg(windows)]
fn owner(window: &tauri::WebviewWindow) -> isize {
    window.hwnd().map(|hwnd| hwnd.0 as isize).unwrap_or(0)
}

#[cfg(not(windows))]
fn owner(_window: &tauri::WebviewWindow) -> isize {
    0
}

fn trash_project(dir: &Path, library: &Path, owner: isize) -> Result<bool, String> {
    if !dir.is_dir() {
        return Err("That folder isn't there any more".into());
    }
    // Never the library itself, a folder of projects, or a project kept elsewhere, in Documents say.
    if !in_library(dir, library) || !dir.join("pensieve.db").is_file() {
        return Err("Only a project's folder goes to the Recycle Bin from here".into());
    }
    if !to_recycle_bin(dir, owner)? {
        return Ok(false);
    }
    // Windows says it went; a folder in use can stay behind all the same.
    if dir.exists() {
        return Err("That folder is in use; close what has it open and try again".into());
    }
    Ok(true)
}

/// False when Windows asked her and she said no.
#[cfg(windows)]
fn to_recycle_bin(dir: &Path, owner: isize) -> Result<bool, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::{SHFileOperationW, FOF_ALLOWUNDO, FOF_NOERRORUI, FOF_SILENT, FOF_WANTNUKEWARNING, FO_DELETE, SHFILEOPSTRUCTW};
    // Windows takes a list of paths, each ended by a zero and the list by one more.
    let from: Vec<u16> = dir.as_os_str().encode_wide().chain([0, 0]).collect();
    let mut operation = SHFILEOPSTRUCTW {
        hwnd: HWND(owner as *mut _),
        wFunc: FO_DELETE,
        pFrom: PCWSTR(from.as_ptr()),
        // Undo is what sends it to the Recycle Bin. FOF_NOCONFIRMATION stays out on purpose: with it, a folder
        // where there is no Recycle Bin is deleted for good without a word (tried on a subst drive, 13 Oct).
        // Without it, Windows asks first in that case, and otherwise only if she has set it to ask.
        fFlags: (FOF_ALLOWUNDO | FOF_WANTNUKEWARNING | FOF_NOERRORUI | FOF_SILENT).0 as u16,
        ..Default::default()
    };
    let result = unsafe { SHFileOperationW(&mut operation) };
    if operation.fAnyOperationsAborted.as_bool() {
        return Ok(false);
    }
    // A file in it held open keeps the whole folder where it is, nothing moved (tried, 13 Oct).
    if result != 0 {
        return Err("Windows couldn't move the folder to the Recycle Bin; close what has it open and try again".into());
    }
    Ok(true)
}

#[cfg(not(windows))]
fn to_recycle_bin(_dir: &Path, _owner: isize) -> Result<bool, String> {
    Err("Only Windows has the Recycle Bin Pensieve uses".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_project_of_the_library_goes_to_the_recycle_bin() {
        let root = std::env::temp_dir().join(format!("pensieve-trash-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let library = root.join("Knjižnica");
        fs::create_dir_all(library.join("Gradivo")).unwrap();
        fs::write(library.join("Gradivo").join("zapiski.txt"), b"x").unwrap();
        fs::create_dir_all(root.join("Drugje")).unwrap();
        fs::write(root.join("Drugje").join("pensieve.db"), b"x").unwrap();
        fs::write(library.join("pensieve.db"), b"x").unwrap();
        // Refused, and nothing moves: a folder that isn't a project, a project outside the library, the
        // library itself, and a folder that isn't there.
        let refused = "Only a project's folder goes to the Recycle Bin from here";
        assert_eq!(trash_project(&library.join("Gradivo"), &library, 0), Err(refused.into()));
        assert_eq!(trash_project(&root.join("Drugje"), &library, 0), Err(refused.into()));
        assert_eq!(trash_project(&library, &library, 0), Err(refused.into()));
        assert_eq!(trash_project(&root.join("Drugje"), Path::new("Knjižnica"), 0), Err(refused.into()));
        assert!(trash_project(&library.join("Ni ga"), &library, 0).is_err());
        assert!(library.join("Gradivo").join("zapiski.txt").exists());
        assert!(root.join("Drugje").join("pensieve.db").exists());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn listing_files() {
        let root = std::env::temp_dir().join(format!("pensieve-files-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("Gradivo")).unwrap();
        fs::create_dir_all(root.join("Brod").join("Slike")).unwrap();
        for file in ["Gradivo/zemljevid.pdf", "Gradivo/~$rokopis.docx", "Brod/pensieve.db", "Brod/pensieve.db-wal", "Brod/naslovnica.jpg", "Brod/Slike/reka.png"] {
            fs::write(root.join(file), b"x").unwrap();
        }
        fs::create_dir_all(root.join("Reka").join("Gradivo")).unwrap();
        fs::write(root.join("Reka").join("pensieve.db"), b"x").unwrap();
        let walk = |open: &str| Walk { folders: MOST, files: MOST_FILES, open: path_key(&root.join(open)), links: true };
        let listed = read_folder(&root, 1, &mut walk("Brod"));
        // A project that isn't open keeps its own contents to itself.
        let reka = listed.iter().find(|entry| entry.name == "Reka").unwrap();
        assert!(reka.project && reka.children.is_empty());
        // However many files, the listing stops at its cap.
        let few = read_folder(&root, 1, &mut Walk { folders: MOST, files: 1, open: String::new(), links: true });
        let count = |entries: &[LibraryEntry]| -> usize {
            fn all(entries: &[LibraryEntry]) -> usize {
                entries.iter().map(|entry| usize::from(entry.file) + all(&entry.children)).sum()
            }
            all(entries)
        };
        assert_eq!(count(&few), 1);
        let named = |entries: &[LibraryEntry]| {
            let mut names: Vec<String> = entries.iter().map(|entry| format!("{}{}", entry.name, if entry.file { "" } else { "/" })).collect();
            names.sort();
            names
        };
        let gradivo = listed.iter().find(|entry| entry.name == "Gradivo").unwrap();
        // Word's lock file is left out.
        assert_eq!(named(&gradivo.children), ["zemljevid.pdf"]);
        let brod = listed.iter().find(|entry| entry.name == "Brod").unwrap();
        assert!(brod.project);
        // A project's own files and folders, without its database.
        assert_eq!(named(&brod.children), ["Slike/", "naslovnica.jpg"]);
        assert!(starts_program(Path::new("C:\\x\\setup.EXE")));
        assert!(starts_program(Path::new("C:\\x\\run.ps1")));
        assert!(!starts_program(Path::new("C:\\x\\Rokopis.docx")));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn reading_a_document() {
        let root = std::env::temp_dir().join(format!("pensieve-documents-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        for file in ["zapiski.md", "2 Drugo.TXT", "Zgodba.odt", "slika.png"] {
            fs::write(root.join(file), "Čaša, šola, žaba".as_bytes()).unwrap();
        }
        // Word, OpenDocument, text and Markdown files come in, whatever the case of their kind; nothing else does.
        assert_eq!(read_document(&root.join("zapiski.md")).unwrap(), "Čaša, šola, žaba".as_bytes());
        assert_eq!(read_document(&root.join("2 Drugo.TXT")).unwrap(), "Čaša, šola, žaba".as_bytes());
        assert_eq!(read_document(&root.join("Zgodba.odt")).unwrap(), "Čaša, šola, žaba".as_bytes());
        assert!(read_document(&root.join("slika.png")).is_err());
        assert_eq!(read_document(&root.join("ni.txt")), Err("That file isn't there any more".to_string()));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn moving_and_removing_folders() {
        let root = std::env::temp_dir().join(format!("pensieve-library-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("Zgodbe").join("Prva")).unwrap();
        fs::create_dir_all(root.join("Romani")).unwrap();
        // A rename, then a move into another folder, with what is inside.
        let renamed = move_entry(&root.join("Zgodbe"), &root, "Kratke zgodbe", &root).unwrap();
        assert!(Path::new(&renamed).join("Prva").is_dir());
        move_entry(Path::new(&renamed), &root.join("Romani"), "Kratke zgodbe", &root).unwrap();
        assert!(root.join("Romani").join("Kratke zgodbe").join("Prva").is_dir());
        // Never inside itself, never over something already there.
        assert!(move_entry(&root.join("Romani"), &root.join("Romani").join("Kratke zgodbe"), "Romani", &root).is_err());
        fs::create_dir_all(root.join("Drugo")).unwrap();
        assert!(move_entry(&root.join("Drugo"), &root, "Romani", &root).is_err());
        // Only the capitals change.
        assert!(move_entry(&root.join("Drugo"), &root, "drugo", &root).is_ok());
        // An empty folder can be deleted; one with something in it can't.
        assert!(remove_folder(&root.join("Romani"), &root).is_err());
        assert!(remove_folder(&root.join("drugo"), &root).is_ok());
        assert!(!root.join("drugo").exists());
        assert_eq!(remove_folder(&root.join("drugo"), &root), Err("That folder isn't there any more".to_string()));
        // A bare drive is its current folder to Windows, never the parent meant.
        assert!(move_entry(&root.join("Romani"), Path::new("C:"), "Romani", &root).is_err());
        // Only a folder inside the library moves or goes, and only within it; ".." leads nowhere out of it.
        let outside = std::env::temp_dir().join(format!("pensieve-outside-{}", std::process::id()));
        fs::create_dir_all(outside.join("Moje")).unwrap();
        let refused = NOT_LIBRARY.to_string();
        assert_eq!(move_entry(&outside.join("Moje"), &root, "Moje", &root).unwrap_err(), refused);
        assert_eq!(move_entry(&root.join("Romani"), &outside, "Romani", &root).unwrap_err(), refused);
        assert_eq!(move_entry(&root, &outside, "Knjižnica", &root).unwrap_err(), refused);
        assert_eq!(move_entry(&root.join("Romani"), &root.join("..").join(outside.file_name().unwrap()), "Romani", &root).unwrap_err(), refused);
        assert_eq!(remove_folder(&outside.join("Moje"), &root).unwrap_err(), refused);
        assert_eq!(remove_folder(&root, &root).unwrap_err(), refused);
        assert_eq!(remove_folder(&root.join("..").join(outside.file_name().unwrap()).join("Moje"), &root).unwrap_err(), refused);
        assert_eq!(remove_folder(&outside.join("Moje"), Path::new("Knjižnica")).unwrap_err(), refused);
        assert!(outside.join("Moje").is_dir() && root.join("Romani").is_dir());
        let _ = fs::remove_dir_all(&outside);
        // A project whose file would pass Windows' 260 characters stays where it is.
        fs::create_dir_all(root.join("Brod")).unwrap();
        fs::write(root.join("Brod").join("pensieve.db"), b"").unwrap();
        let deep = root.join("d".repeat(120));
        fs::create_dir_all(&deep).unwrap();
        assert!(move_entry(&root.join("Brod"), &deep, &"b".repeat(120), &root).is_err());
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
