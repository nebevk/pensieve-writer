import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Project } from "$lib/model";
import {
  backupBookKey,
  backupFile,
  backupFileName,
  backupSignature,
  parseBackup,
  type BackupContent,
} from "./backupFile";
import { listNotes, listTasks } from "./organize";

export async function chooseProjectFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Open a Pensieve project",
    filters: [{ name: "Pensieve project", extensions: ["db"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function chooseImageFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Choose an image",
    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function chooseBackupFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose a backup folder",
  });
  return typeof selected === "string" ? selected : null;
}

export async function chooseBackupFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Restore from a backup",
    filters: [{ name: "Pensieve backup", extensions: ["json"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function readBackupFile(path: string): Promise<BackupContent> {
  return parseBackup(await invoke<string>("read_backup_file", { path }));
}

export type BackupResult = {
  /** Where the backup was written, or null when it was skipped because nothing changed. */
  path: string | null;
  signature: string;
};

/**
 * Writes a backup of the book, its notes and its to-dos. Pass the previous backup's signature
 * to skip writing an identical copy.
 */
export async function writeBackup(folder: string, project: Project, skipIfSignature = ""): Promise<BackupResult> {
  const [notes, tasks] = await Promise.all([listNotes(project.id), listTasks(project.id)]);
  const signature = backupSignature(project, notes, tasks);
  if (skipIfSignature && signature === skipIfSignature) return { path: null, signature };
  const savedAt = new Date().toISOString();
  const contents = JSON.stringify(backupFile(project, notes, tasks, savedAt));
  const path = await invoke<string>("write_backup", {
    folder,
    filename: backupFileName(project.id, savedAt),
    contents,
    book: backupBookKey(project.id),
  });
  return { path, signature };
}
