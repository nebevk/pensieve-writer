import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Project } from "$lib/model";
import { backupFile } from "./backupFile";
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

export async function writeBackup(folder: string, project: Project): Promise<string> {
  const [notes, tasks] = await Promise.all([listNotes(project.id), listTasks(project.id)]);
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const filename = `pensieve-${stamp}.json`;
  const contents = JSON.stringify(backupFile(project, notes, tasks, new Date().toISOString()));
  return invoke<string>("write_backup", { folder, filename, contents });
}
