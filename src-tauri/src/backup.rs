use crate::disk;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

const KEEP: usize = 20;

/// Writes one backup file. With `book`, only that book's backups count toward the 20 kept,
/// so working on one book never prunes another book's backups. Off the window's thread (ARCH-10): a
/// backup of several MB into a synced folder would hold up her typing.
#[tauri::command(async)]
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
    if let Err(error) = disk::write_synced(&temporary, contents.as_bytes()) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    if path.exists() {
        let _ = fs::remove_file(&temporary);
        return Err("That backup already exists".into());
    }
    if let Err(error) = fs::rename(&temporary, &path) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    // The backup is written. Tidying the folder can fail (a file Drive holds open, say) and is tried again
    // with the next backup: it never makes this one count as failed (ARCH-16).
    remove_partial_backups(dir);
    prune_old_backups(dir, &prefix);
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

/// One project's backups in a folder: how many, and the room they take.
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct BackupUsage {
    /// The key in their names, from the project's id; empty for backups from before projects had one.
    key: String,
    /// The project's name, from its newest backup; empty when it can't be read there.
    title: String,
    count: usize,
    bytes: u64,
}

/// Pensieve's backups in a folder, one entry for each project, the one backed up last first (SV-15). Other
/// files there aren't counted, and a folder that isn't there has none.
#[tauri::command(async)]
pub fn backup_usage(folder: String) -> Vec<BackupUsage> {
    let Ok(entries) = fs::read_dir(Path::new(&folder)) else {
        return Vec::new();
    };
    // Each project's count, size, and its newest backup's name and path.
    let mut projects: HashMap<String, (usize, u64, String, PathBuf)> = HashMap::new();
    for entry in entries.filter_map(Result::ok) {
        let name = entry.file_name().to_string_lossy().to_string();
        let Some((key, saved)) = backup_name(&name) else {
            continue;
        };
        // Its size without reading it, so a file Drive keeps only online isn't fetched to be counted.
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if !meta.is_file() {
            continue;
        }
        let project = projects.entry(key).or_insert((0, 0, String::new(), PathBuf::new()));
        project.0 += 1;
        project.1 += meta.len();
        if saved > project.2 {
            project.2 = saved;
            project.3 = entry.path();
        }
    }
    let mut usage: Vec<(String, BackupUsage)> = projects
        .into_iter()
        .map(|(key, (count, bytes, saved, newest))| (saved, BackupUsage { key, title: backup_title(&newest), count, bytes }))
        .collect();
    usage.sort_by(|a, b| b.0.cmp(&a.0));
    usage.into_iter().map(|(_, project)| project).collect()
}

/// A backup's project key and when it was saved, from its name: `pensieve-<key>-<time>.json`, or
/// `pensieve-<time>.json` from before projects had a key. Anything else isn't a backup.
fn backup_name(name: &str) -> Option<(String, String)> {
    let rest = name.strip_prefix("pensieve-")?.strip_suffix(".json")?;
    // A time as backups are named: 2026-10-20T09-30-00.000Z.
    let is_time = |text: &str| {
        let bytes = text.as_bytes();
        bytes.len() >= 11
            && bytes[..4].iter().all(u8::is_ascii_digit)
            && bytes[4] == b'-'
            && bytes[5..7].iter().all(u8::is_ascii_digit)
            && bytes[7] == b'-'
            && bytes[8..10].iter().all(u8::is_ascii_digit)
            && bytes[10] == b'T'
    };
    if let Some((key, saved)) = rest.split_once('-') {
        if !key.is_empty() && key.len() <= 32 && key.chars().all(|c| c.is_ascii_alphanumeric()) && is_time(saved) {
            return Some((key.to_string(), saved.to_string()));
        }
    }
    is_time(rest).then(|| (String::new(), rest.to_string()))
}

/// The project's name in a backup, from the file's start, where it is written before any of the text.
fn backup_title(path: &Path) -> String {
    let mut head = vec![0; 16 * 1024];
    let read = fs::File::open(path).and_then(|mut file| file.read(&mut head)).unwrap_or(0);
    let text = String::from_utf8_lossy(&head[..read]);
    let Some(at) = text.find("\"title\":") else {
        return String::new();
    };
    let value = text[at + "\"title\":".len()..].trim_start();
    if !value.starts_with('"') {
        return String::new();
    }
    let mut escaped = false;
    for (index, c) in value.char_indices().skip(1) {
        if escaped {
            escaped = false;
        } else if c == '\\' {
            escaped = true;
        } else if c == '"' {
            return serde_json::from_str(&value[..=index]).unwrap_or_default();
        }
    }
    String::new()
}

/// Removes what a backup cut short left behind; one that can't go now goes next time.
fn remove_partial_backups(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(Result::ok) {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("pensieve-") && name.ends_with(".json.writing") {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Keeps the newest 20 backups with this prefix. One that can't be removed now is passed over, and goes
/// with a later backup.
fn prune_old_backups(dir: &Path, prefix: &str) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<_> = entries
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
        let _ = fs::remove_file(entry.path());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, SystemTime};

    fn folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pensieve-backup-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// An older backup of book "abc", from `day` days into 2023.
    fn older(dir: &Path, day: u64) -> PathBuf {
        let path = dir.join(format!("pensieve-abc-{day:03}.json"));
        fs::write(&path, "{}").unwrap();
        let file = fs::OpenOptions::new().write(true).open(&path).unwrap();
        file.set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(1_672_531_200 + day * 86_400)).unwrap();
        path
    }

    #[test]
    fn writes_the_backup_and_keeps_the_newest_twenty() {
        let dir = folder("keep");
        let paths: Vec<_> = (0..25).map(|day| older(&dir, day)).collect();
        let contents = r#"{"naslov":"Čaša, šola, žaba"}"#;
        let written = write_backup(dir.display().to_string(), "pensieve-abc-new.json".into(), contents.into(), Some("abc".into())).unwrap();
        assert_eq!(fs::read_to_string(&written).unwrap(), contents);
        // 26 backups: the six oldest go.
        assert!(paths[..6].iter().all(|path| !path.exists()));
        assert!(paths[6..].iter().all(|path| path.exists()));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn counts_pensieves_backups_by_project_and_names_each_from_its_newest() {
        let dir = folder("usage");
        let write = |name: &str, contents: &str| fs::write(dir.join(name), contents).unwrap();
        write("pensieve-ab12cd34-2026-10-19T10-00-00.000Z.json", r#"{"kind":"pensieve-backup","format":2,"savedAt":"x","project":{"id":"ab12cd34","title":"Staro ime"}}"#);
        write("pensieve-ab12cd34-2026-10-20T09-30-00.000Z.json", r#"{"kind":"pensieve-backup","format":2,"savedAt":"x","project":{"id":"ab12cd34","title":"Zgodbe ob reki: \"Čaša\", šola, žaba"}}"#);
        write("pensieve-12345678-2026-10-18T08-00-00.000Z.json", r#"{"project":{"title":"Vrt"}}"#);
        write("pensieve-2026-10-01T07-00-00.000Z.json", r#"{"kind":"pensieve-backup","format":1,"book":{"title":"Stara knjiga"}}"#);
        // Not backups: one cut short, her own files, and names that only look alike.
        write("pensieve-ab12cd34-2026-10-21T09-30-00.000Z.json.writing", "{");
        write("zapiski.txt", "Čaša");
        write("pensieve-prefs.json", "{}");
        write("pensieve-ab12cd34-kopija.json", "{}");
        let usage = backup_usage(dir.display().to_string());
        let size = |name: &str| fs::metadata(dir.join(name)).unwrap().len();
        assert_eq!(
            usage,
            vec![
                BackupUsage {
                    key: "ab12cd34".into(),
                    title: "Zgodbe ob reki: \"Čaša\", šola, žaba".into(),
                    count: 2,
                    bytes: size("pensieve-ab12cd34-2026-10-19T10-00-00.000Z.json") + size("pensieve-ab12cd34-2026-10-20T09-30-00.000Z.json"),
                },
                BackupUsage { key: "12345678".into(), title: "Vrt".into(), count: 1, bytes: size("pensieve-12345678-2026-10-18T08-00-00.000Z.json") },
                BackupUsage { key: String::new(), title: "Stara knjiga".into(), count: 1, bytes: size("pensieve-2026-10-01T07-00-00.000Z.json") },
            ]
        );
        assert!(backup_usage(dir.join("ni je").display().to_string()).is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn a_backup_written_is_never_reported_as_failed() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = folder("held");
        let paths: Vec<_> = (0..21).map(|day| older(&dir, day)).collect();
        let partial = dir.join("pensieve-abc-old.json.writing");
        fs::write(&partial, "{").unwrap();
        // The oldest backup and a partial one, held open by a program that shares nothing.
        let held = [&paths[0], &partial].map(|path| fs::OpenOptions::new().read(true).share_mode(0).open(path).unwrap());
        let written = write_backup(dir.display().to_string(), "pensieve-abc-new.json".into(), "{}".into(), Some("abc".into()));
        assert!(written.is_ok(), "{written:?}");
        // Pruning went on past the backup it couldn't remove.
        assert!(paths[0].exists() && !paths[1].exists() && paths[2].exists());
        drop(held);
        fs::remove_dir_all(&dir).unwrap();
    }
}
