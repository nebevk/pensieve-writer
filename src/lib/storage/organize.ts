import type { DocumentJson } from "$lib/model";
import { createSaveQueue } from "$lib/save/queue";
import { readNotesWith, readTasksWith, writeNoteWith, writeTaskWith } from "./noteRows";
import { withDb, withProjectDb } from "./sqlite";
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
  /** Empty means the to-do belongs to the whole project. */
  chapterId: string;
  /** Empty means the to-do was not written on a note. */
  noteId: string;
};

type Change = { kind: "note"; note: Note } | { kind: "task"; task: Task } | { kind: "deleteTask"; id: string };

let saveError: ((message: string) => void) | null = null;
// The page's, apart from the views' saveError: it keeps a rescue copy while saves fail (ARCH-1).
let savingWatch: { failed: () => void; saved: () => void } | null = null;

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
  save: async (change) => {
    try {
      if (change.kind === "note") await withProjectDb(change.note.projectId, (db) => writeNoteWith(db, change.note));
      else if (change.kind === "task") await withProjectDb(change.task.projectId, (db) => writeTaskWith(db, change.task));
      else await withDb((db) => db.execute(`DELETE FROM tasks WHERE id = $1`, [change.id]));
    } catch (error) {
      // A change for a project that isn't open any more is said once and let go: kept, it would wait
      // forever and hold up every switch, backup and close behind it.
      if (error instanceof Error && error.message === t("errOtherProject")) {
        saveError?.(error.message);
        return;
      }
      throw error;
    }
  },
  onError: (error) => {
    saveError?.(error instanceof Error ? error.message : t("notesSaveFailed"));
    savingWatch?.failed();
  },
  onSaved: () => savingWatch?.saved(),
});

/** Lists read what was last typed, not what happened to be saved: pending writes go first. */
const settled = () => saves.flush().catch(() => undefined);

/** The open project's notes. */
export async function listNotes(): Promise<Note[]> {
  await settled();
  return withDb((db) => readNotesWith(db));
}

/** The open project's to-dos. */
export async function listTasks(): Promise<Task[]> {
  await settled();
  return withDb((db) => readTasksWith(db));
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

/** Hears every note and to-do save fail, and work again. */
export function watchNoteSaving(watch: { failed: () => void; saved: () => void }): void {
  savingWatch = watch;
}

/** Saves every pending note and to-do change. */
export function flushNoteSave(): Promise<void> {
  return saves.flush();
}

/** Notes and to-dos changed but not saved yet (a save failing, say): what a rescue copy keeps of them (ARCH-1). */
export function unsavedNotesAndTasks(): { notes: Note[]; tasks: Task[] } {
  const notes: Note[] = [];
  const tasks: Task[] = [];
  for (const change of saves.waiting()) {
    if (change.kind === "note") notes.push(change.note);
    else if (change.kind === "task") tasks.push(change.task);
  }
  return { notes, tasks };
}
