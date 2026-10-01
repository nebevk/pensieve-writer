import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Project } from "$lib/model";
import { listNotes, listTasks } from "./organize";

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
  const contents = JSON.stringify({
    kind: "pensieve-backup",
    savedAt: new Date().toISOString(),
    project,
    notes,
    tasks,
  });
  return invoke<string>("write_backup", { folder, filename, contents });
}
