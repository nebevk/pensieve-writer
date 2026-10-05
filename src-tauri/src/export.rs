use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Where an export was written, and a stamp to notice later if someone else changed the file.
#[derive(Serialize)]
pub struct WrittenFile {
    path: String,
    stamp: String,
}

const ALLOWED: [&str; 4] = ["docx", "md", "txt", "html"];

/// Pensieve's last-written stamp for a file it must not create over someone else's.
const MUST_BE_NEW: &str = "absent";

fn stamp_of(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_millis();
    Some(format!("{}:{}", meta.len(), modified))
}

fn decode_hex(hex: &str) -> Result<String, String> {
    if hex.len() % 2 != 0 {
        return Err("The file path is not valid".into());
    }
    let bytes = (0..hex.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&hex[index..index + 2], 16))
        .collect::<Result<Vec<u8>, _>>()
        .map_err(|_| "The file path is not valid".to_string())?;
    String::from_utf8(bytes).map_err(|_| "The file path is not valid".into())
}

/// Writes an exported file (raw bytes) by temp file and rename. The path comes hex-encoded in
/// `x-path`, so letters such as č, š and ž survive the request header. With `x-expect`, the file
/// is only replaced if it still has the stamp Pensieve last wrote ("absent": only if it doesn't
/// exist), so edits made in Word are never overwritten.
#[tauri::command]
pub fn write_document(request: tauri::ipc::Request<'_>) -> Result<WrittenFile, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("The file contents are missing".into());
    };
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
    };
    let path = PathBuf::from(decode_hex(&header("x-path").ok_or("The file path is missing")?)?);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !ALLOWED.contains(&extension.as_str()) {
        return Err("Pensieve only writes Word, Markdown, text and HTML files".into());
    }
    let dir = path
        .parent()
        .filter(|dir| dir.is_dir())
        .ok_or("That folder doesn't exist")?;
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .ok_or("Choose a file name")?;

    if let Some(expected) = header("x-expect").filter(|value| !value.is_empty()) {
        match stamp_of(&path) {
            Some(_) if expected == MUST_BE_NEW => return Err("EXISTS".into()),
            Some(current) if current != expected => return Err("CHANGED_ELSEWHERE".into()),
            _ => {}
        }
    }

    let temporary = dir.join(format!("~{name}.writing"));
    fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    if let Err(error) = fs::rename(&temporary, &path) {
        let _ = fs::remove_file(&temporary);
        let locked = error.raw_os_error() == Some(32) || error.kind() == std::io::ErrorKind::PermissionDenied;
        return Err(if locked {
            format!("“{name}” is open in another program, probably Word. Close it there, then try again.")
        } else {
            error.to_string()
        });
    }
    Ok(WrittenFile {
        path: path.display().to_string(),
        stamp: stamp_of(&path).unwrap_or_default(),
    })
}
