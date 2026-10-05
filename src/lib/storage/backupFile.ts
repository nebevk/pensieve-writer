import type { Project } from "$lib/model";
import type { Note, Task } from "./organize";
import { t } from "$lib/ui.svelte";

export type BackupFile = {
  kind: "pensieve-backup";
  savedAt: string;
  project: Project;
  notes: unknown[];
  tasks: unknown[];
};

/** A backup file read back in, ready to restore. */
export type BackupContent = {
  savedAt: string;
  project: Project;
  notes: Note[];
  tasks: Task[];
};

export function backupFile(project: Project, notes: unknown[], tasks: unknown[], savedAt: string): BackupFile {
  return {
    kind: "pensieve-backup",
    savedAt,
    project,
    notes,
    tasks,
  };
}

/** A short, file-name-safe key per book, so each book's backups are counted and pruned on their own. */
export function backupBookKey(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "book";
}

export function backupFileName(projectId: string, savedAt: string): string {
  return `pensieve-${backupBookKey(projectId)}-${savedAt.replaceAll(":", "-")}.json`;
}

/**
 * A fingerprint of what a backup would contain, ignoring edit times. Two backups with the same
 * fingerprint hold the same book, notes and to-dos.
 */
export function backupSignature(project: Project, notes: unknown[], tasks: unknown[]): string {
  const text = JSON.stringify({ project, notes, tasks }, (key, value) =>
    key === "updatedAt" || key === "createdAt" ? undefined : value,
  );
  // Two independent 32-bit hashes plus the length, so a changed book practically never looks unchanged.
  let first = 0x811c9dc5;
  let second = 5381;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second, 33) ^ code;
  }
  return `${project.id}:${text.length}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

/** Reads a backup file's text, or explains in plain words why it can't be restored. */
export function parseBackup(text: string): BackupContent {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t("errNotBackup"));
  }
  const file = data as Partial<BackupFile> | null;
  const chapters = file?.project?.chapters;
  if (!file || file.kind !== "pensieve-backup" || !Array.isArray(chapters) || chapters.length === 0) {
    throw new Error(t("errNotBackup"));
  }
  if (chapters.some((chapter) => !chapter || chapter.contentJson?.type !== "doc")) {
    throw new Error(t("errBackupChapter"));
  }
  return {
    savedAt: typeof file.savedAt === "string" ? file.savedAt : "",
    project: file.project as Project,
    notes: Array.isArray(file.notes) ? (file.notes as Note[]) : [],
    tasks: Array.isArray(file.tasks) ? (file.tasks as Task[]) : [],
  };
}
