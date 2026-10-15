import type { Writing } from "$lib/model";
import type { Note, Task } from "./organize";
import { t } from "$lib/ui.svelte";

/** A writing in a backup: its text, and its place in the project. */
export type BackupWriting = Writing & { folder: string; position: number; deletedAt?: string };

/** A backup of a whole project: every writing with its text, and the project's notes and to-dos. */
export type BackupFile = {
  kind: "pensieve-backup";
  format: 2;
  savedAt: string;
  project: { id: string; title: string; folders: string[] };
  writings: BackupWriting[];
  notes: unknown[];
  tasks: unknown[];
  /** A rescue copy of what couldn't be saved (ARCH-1): its notes and to-dos are newer than the project's. */
  rescue?: boolean;
};

/**
 * A backup file read back in, ready to restore. A backup from before projects held several writings
 * (format 1) is one book: it reads as a project with that one writing, under the book's own id.
 */
export type BackupContent = {
  format: 1 | 2;
  savedAt: string;
  projectId: string;
  title: string;
  folders: string[];
  writings: BackupWriting[];
  notes: Note[];
  tasks: Task[];
  /** A rescue copy: notes and to-dos in it that the project has in an older version come back too. */
  rescue: boolean;
};

export function backupFile(
  project: { id: string; title: string; folders: string[] },
  writings: BackupWriting[],
  notes: unknown[],
  tasks: unknown[],
  savedAt: string,
): BackupFile {
  return { kind: "pensieve-backup", format: 2, savedAt, project, writings, notes, tasks };
}

/** A short, file-name-safe key per project, so each project's backups are counted and pruned on their own. */
export function backupBookKey(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "book";
}

export function backupFileName(projectId: string, savedAt: string): string {
  return `pensieve-${backupBookKey(projectId)}-${savedAt.replaceAll(":", "-")}.json`;
}

/**
 * A fingerprint of what a backup (or a Word copy) would contain, ignoring edit times and when a writing
 * was last opened. Two backups with the same fingerprint hold the same writings, notes and to-dos.
 */
export function backupSignature(key: string, content: unknown): string {
  const text = JSON.stringify(content, (name, value) =>
    name === "updatedAt" || name === "createdAt" || name === "openedAt" ? undefined : value,
  );
  // Two independent 32-bit hashes plus the length, so a changed book practically never looks unchanged.
  let first = 0x811c9dc5;
  let second = 5381;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second, 33) ^ code;
  }
  return `${key}:${text.length}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

/** Reads a backup file's text, or explains in plain words why it can't be restored. */
export function parseBackup(text: string): BackupContent {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t("errNotBackup"));
  }
  type Saved = { kind?: unknown; format?: unknown; savedAt?: unknown; project?: Record<string, unknown>; writings?: unknown; notes?: unknown; tasks?: unknown; rescue?: unknown };
  const file = data as Saved | null;
  if (!file || file.kind !== "pensieve-backup" || !file.project || typeof file.project !== "object") {
    throw new Error(t("errNotBackup"));
  }
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const project = file.project;
  let writings: BackupWriting[];
  let format: 1 | 2;
  if (Array.isArray(file.writings)) {
    format = 2;
    writings = file.writings as BackupWriting[];
  } else {
    // One book from before projects held several writings: the book is the writing, under its own id.
    format = 1;
    writings = [{ ...(project as unknown as Writing), split: project.kind !== "article", folder: "", position: 0 }];
  }
  // A writing with no chapters holds no text (a save cut short): it is left out, not the whole file.
  writings = writings.filter((writing) => writing && Array.isArray(writing.chapters) && writing.chapters.length > 0);
  if (writings.length === 0) throw new Error(t("errNotBackup"));
  if (writings.some((writing) => writing.chapters.some((chapter) => !chapter || chapter.contentJson?.type !== "doc"))) {
    throw new Error(t("errBackupChapter"));
  }
  return {
    format,
    savedAt: str(file.savedAt),
    projectId: str(project.id),
    title: str(project.title),
    folders: Array.isArray(project.folders) ? project.folders.filter((name): name is string => typeof name === "string") : [],
    writings: writings.map((writing, index) => ({
      ...writing,
      id: str(writing.id) || crypto.randomUUID(),
      title: str(writing.title),
      split: writing.split !== false,
      folder: str(writing.folder),
      position: Number.isFinite(writing.position) ? Number(writing.position) : index,
    })),
    notes: Array.isArray(file.notes) ? (file.notes as Note[]) : [],
    tasks: Array.isArray(file.tasks) ? (file.tasks as Task[]) : [],
    rescue: file.rescue === true,
  };
}
