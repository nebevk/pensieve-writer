import type { DocumentJson } from "$lib/model";
import { createSaveQueue } from "$lib/save/queue";
import { readNotesWith, readTasksWith, writeNoteWith, writeTaskWith } from "./noteRows";
import { withDb } from "./sqlite";

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

export function listNotes(projectId: string): Promise<Note[]> {
  return withDb((db) => readNotesWith(db, projectId));
}

export function saveNote(note: Note): Promise<void> {
  return withDb((db) => writeNoteWith(db, note));
}

export function deleteNote(id: string): Promise<void> {
  return withDb(async (db) => {
    await db.execute(`DELETE FROM note_chapters WHERE note_id = $1`, [id]);
    await db.execute(`DELETE FROM tasks WHERE note_id = $1`, [id]);
    await db.execute(`DELETE FROM notes WHERE id = $1`, [id]);
  });
}

export function listTasks(projectId: string): Promise<Task[]> {
  return withDb((db) => readTasksWith(db, projectId));
}

export function saveTask(task: Task): Promise<void> {
  return withDb((db) => writeTaskWith(db, task));
}

let noteSaveError: ((message: string) => void) | null = null;

const noteSaves = createSaveQueue<Note>({
  delayMs: 800,
  key: (note) => note.id,
  save: saveNote,
  onError: (error) => {
    noteSaveError?.(error instanceof Error ? error.message : "Could not save the note");
  },
});

export function watchNoteSaves(onError: (message: string) => void): void {
  noteSaveError = onError;
}

export function scheduleNoteSave(note: Note): void {
  noteSaves.schedule(note);
}

export function flushNoteSave(): Promise<void> {
  return noteSaves.flush();
}

export function deleteTask(id: string): Promise<void> {
  return withDb(async (db) => {
    await db.execute(`DELETE FROM tasks WHERE id = $1`, [id]);
  });
}
