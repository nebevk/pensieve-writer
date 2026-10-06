import type { DocumentJson } from "$lib/model";
import { createSaveQueue } from "$lib/save/queue";
import { readNotesWith, readTasksWith, writeNoteWith, writeTaskWith } from "./noteRows";
import { withDb } from "./sqlite";
import { t } from "$lib/ui.svelte";

export type TodoState = "todo" | "doing" | "done";
export type NoteCategory = "ideas" | "characters" | "places" | "research";

export type NoteField = { key: string; value: string };

export type Note = {
  id: string;
  projectId: string;
  title: string;
  contentJson: DocumentJson;
  plainText: string;
  category: NoteCategory;
  tags: string;
  /** Other names the note goes by, separated by commas: "Ana, Anica". They count as mentions too. */
  aliases: string;
  fields: NoteField[];
  todoState: TodoState | null;
  chapterIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  todoState: TodoState;
  updatedAt: string;
  /** Empty means the to-do belongs to the whole book. */
  chapterId: string;
  /** Empty means the to-do was not written on a note. */
  noteId: string;
};

type Change = { kind: "note"; note: Note } | { kind: "task"; task: Task } | { kind: "deleteTask"; id: string };

let saveError: ((message: string) => void) | null = null;

/**
 * Every note and to-do write goes through this one queue, one at a time, and the latest change to
 * each note or to-do replaces any older one still waiting, so an old copy can never land on top of
 * a newer one. Typing waits a moment; clicks save at once. A failed write stays queued for the
 * next attempt.
 */
const saves = createSaveQueue<Change>({
  delayMs: 800,
  key: (change) =>
    change.kind === "note" ? `note:${change.note.id}` : `task:${change.kind === "task" ? change.task.id : change.id}`,
  save: (change) =>
    withDb(async (db) => {
      if (change.kind === "note") await writeNoteWith(db, change.note);
      else if (change.kind === "task") await writeTaskWith(db, change.task);
      else await db.execute(`DELETE FROM tasks WHERE id = $1`, [change.id]);
    }),
  onError: (error) => {
    saveError?.(error instanceof Error ? error.message : t("notesSaveFailed"));
  },
});

/** Lists read what was last typed, not what happened to be saved: pending writes go first. */
const settled = () => saves.flush().catch(() => undefined);

export async function listNotes(projectId: string): Promise<Note[]> {
  await settled();
  return withDb((db) => readNotesWith(db, projectId));
}

export async function listTasks(projectId: string): Promise<Task[]> {
  await settled();
  return withDb((db) => readTasksWith(db, projectId));
}

/** Saves a note now, for a click such as a new note or a to-do state; typing uses scheduleNoteSave. */
export function saveNote(note: Note): Promise<void> {
  saves.schedule({ kind: "note", note });
  return saves.flush();
}

export function scheduleNoteSave(note: Note): void {
  saves.schedule({ kind: "note", note });
}

export function saveTask(task: Task): Promise<void> {
  saves.schedule({ kind: "task", task });
  return saves.flush();
}

export function deleteTask(id: string): Promise<void> {
  saves.schedule({ kind: "deleteTask", id });
  return saves.flush();
}

export async function deleteNote(id: string): Promise<void> {
  // Pending edits to the note or its to-dos would otherwise write them back after the delete.
  await saves.flush();
  await withDb(async (db) => {
    await db.execute(`DELETE FROM note_chapters WHERE note_id = $1`, [id]);
    await db.execute(`DELETE FROM tasks WHERE note_id = $1`, [id]);
    await db.execute(`DELETE FROM notes WHERE id = $1`, [id]);
  });
}

export function watchNoteSaves(onError: (message: string) => void): void {
  saveError = onError;
}

/** Saves every pending note and to-do change. */
export function flushNoteSave(): Promise<void> {
  return saves.flush();
}
