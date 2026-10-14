import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  backupBookKey,
  backupFile,
  backupFileName,
  backupSignature,
  parseBackup,
  type BackupContent,
} from "./backupFile";
import { readWholeProject } from "./sqlite";
import { t } from "$lib/ui.svelte";

export async function chooseProjectFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: t("dialogOpenProject"),
    filters: [{ name: t("dialogProjectFilter"), extensions: ["db"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function chooseImageFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: t("dialogChooseImage"),
    filters: [{ name: t("dialogImageFilter"), extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
  });
  return typeof selected === "string" ? selected : null;
}

/** A Word, text or Markdown file to start a project from. */
/** Word, text or Markdown files she picks: one, or several when `several`; `near` is where the picker opens. */
export async function chooseDocumentFiles(several: boolean, near = ""): Promise<string[]> {
  const selected = await open({
    directory: false,
    multiple: several,
    title: t(several ? "dialogChooseDocuments" : "dialogChooseDocument"),
    filters: [{ name: t("dialogDocumentFilter"), extensions: ["docx", "txt", "md", "markdown"] }],
    ...(near ? { defaultPath: near } : {}),
  });
  return Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
}

/** A folder picker; the title says what the folder is for. */
export async function chooseBackupFolder(title = t("dialogBackupFolder")): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title,
  });
  return typeof selected === "string" ? selected : null;
}

export async function chooseBackupFile(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: t("dialogRestoreBackup"),
    filters: [{ name: t("dialogBackupFilter"), extensions: ["json"] }],
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
 * Writes a backup of the open project as it is saved: every writing, its notes and its to-dos. Pass the
 * previous backup's signature to skip writing an identical copy.
 */
export async function writeBackup(folder: string, skipIfSignature = ""): Promise<BackupResult> {
  const { shelf, writings, notes, tasks } = await readWholeProject();
  const project = { id: shelf.projectId, title: shelf.title, folders: shelf.folders };
  const signature = backupSignature(project.id, { project, writings, notes, tasks });
  if (skipIfSignature && signature === skipIfSignature) return { path: null, signature };
  const savedAt = new Date().toISOString();
  const contents = JSON.stringify(backupFile(project, writings, notes, tasks, savedAt));
  const path = await invoke<string>("write_backup", {
    folder,
    filename: backupFileName(project.id, savedAt),
    contents,
    book: backupBookKey(project.id),
  });
  return { path, signature };
}
