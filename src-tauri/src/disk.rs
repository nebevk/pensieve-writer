//! Files written so that a power cut can't leave an empty one where hers was (ARCH-17).

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;

/// Writes a file and has Windows put it on the disk, before it is renamed into place. A folder that won't
/// flush a file (some network and synced drives refuse) keeps what was written, as before.
pub fn write_synced(path: &Path, contents: &[u8]) -> io::Result<()> {
    let mut file = File::create(path)?;
    file.write_all(contents)?;
    let _ = file.sync_all();
    Ok(())
}

/// Asks Windows to put a file someone else wrote (SQLite, say) on the disk; one that won't flush keeps what it has.
pub fn flush(path: &Path) {
    if let Ok(file) = fs::OpenOptions::new().write(true).open(path) {
        let _ = file.sync_all();
    }
}

/// Replaces `path` in one step: the contents go to `temporary`, on the disk, which then takes its place.
/// Until then the old file stays whole; on a failure the temporary file goes.
pub fn replace(path: &Path, temporary: &Path, contents: &[u8]) -> io::Result<()> {
    let done = write_synced(temporary, contents).and_then(|()| fs::rename(temporary, path));
    if done.is_err() {
        let _ = fs::remove_file(temporary);
    }
    done
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pensieve-disk-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn replace_puts_the_new_file_in_place_of_the_old() {
        let dir = folder("replace");
        let path = dir.join("prefs.json");
        fs::write(&path, "staro").unwrap();
        replace(&path, &dir.join("prefs.json.writing"), "novo: č, š, ž".as_bytes()).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "novo: č, š, ž");
        assert!(!dir.join("prefs.json.writing").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn a_failed_replace_leaves_the_old_file_whole() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = folder("held");
        let path = dir.join("prefs.json");
        fs::write(&path, "staro").unwrap();
        // Held open by a program that shares nothing, as a virus scan might.
        let held = fs::OpenOptions::new().read(true).share_mode(0).open(&path).unwrap();
        assert!(replace(&path, &dir.join("prefs.json.writing"), b"novo").is_err());
        drop(held);
        assert_eq!(fs::read_to_string(&path).unwrap(), "staro");
        assert!(!dir.join("prefs.json.writing").exists());
        fs::remove_dir_all(&dir).unwrap();
    }
}
