import type { DocumentJson } from "$lib/model";
import { emptyDocument } from "$lib/model";
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

type NoteRow = {
  id: string;
  project_id: string;
  title: string;
  content_json: string;
  plain_text: string;
  category: string;
  tags: string;
  todo_state: string | null;
  fields_json?: string;
  created_at: string;
  updated_at: string;
};

function parseFields(raw: string | undefined): NoteField[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const field = item as { key?: unknown; value?: unknown };
      const key = typeof field.key === "string" ? field.key : "";
      const value = typeof field.value === "string" ? field.value : "";
      if (!key && !value) return [];
      return [{ key, value }];
    });
  } catch {
    return [];
  }
}

function asCategory(value: string): NoteCategory {
  if (value === "characters" || value === "places" || value === "research") return value;
  return "ideas";
}

function asTodo(value: string | null): TodoState | null {
  if (value === "todo" || value === "doing" || value === "done") return value;
  return null;
}

function parseDoc(raw: string): DocumentJson {
  try {
    const parsed = JSON.parse(raw) as DocumentJson;
    if (parsed && parsed.type === "doc") return parsed;
  } catch {
    // Fall through to an empty document.
  }
  return emptyDocument();
}

export function listNotes(projectId: string): Promise<Note[]> {
  return withDb(async (db) => {
    const rows = await db.select<NoteRow[]>(
      `SELECT id, project_id, title, content_json, plain_text, category, tags, todo_state, fields_json, created_at, updated_at
       FROM notes WHERE project_id = $1 ORDER BY updated_at DESC`,
      [projectId],
    );
    const links = await db.select<{ note_id: string; chapter_id: string }[]>(
      `SELECT note_id, chapter_id FROM note_chapters
       WHERE note_id IN (SELECT id FROM notes WHERE project_id = $1)`,
      [projectId],
    );
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      contentJson: parseDoc(row.content_json),
      plainText: row.plain_text ?? "",
      category: asCategory(row.category),
      tags: row.tags ?? "",
      fields: parseFields(row.fields_json),
      todoState: asTodo(row.todo_state),
      chapterIds: links.filter((link) => link.note_id === row.id).map((link) => link.chapter_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  });
}

export function saveNote(note: Note): Promise<void> {
  return withDb(async (db) => {
    await db.execute(
      `INSERT INTO notes (
         id, project_id, title, content_json, plain_text, category, tags, todo_state, fields_json, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         content_json = excluded.content_json,
         plain_text = excluded.plain_text,
         category = excluded.category,
         tags = excluded.tags,
         todo_state = excluded.todo_state,
         fields_json = excluded.fields_json,
         updated_at = excluded.updated_at`,
      [
        note.id,
        note.projectId,
        note.title,
        JSON.stringify(note.contentJson),
        note.plainText,
        note.category,
        note.tags,
        note.todoState,
        JSON.stringify(note.fields ?? []),
        note.createdAt,
        note.updatedAt,
      ],
    );
    await db.execute(`DELETE FROM note_chapters WHERE note_id = $1`, [note.id]);
    for (const chapterId of note.chapterIds) {
      await db.execute(`INSERT INTO note_chapters (note_id, chapter_id) VALUES ($1, $2)`, [
        note.id,
        chapterId,
      ]);
    }
  });
}

export function deleteNote(id: string): Promise<void> {
  return withDb(async (db) => {
    await db.execute(`DELETE FROM note_chapters WHERE note_id = $1`, [id]);
    await db.execute(`DELETE FROM tasks WHERE note_id = $1`, [id]);
    await db.execute(`DELETE FROM notes WHERE id = $1`, [id]);
  });
}

export function listTasks(projectId: string): Promise<Task[]> {
  return withDb(async (db) => {
    const rows = await db.select<
      {
        id: string;
        project_id: string;
        title: string;
        todo_state: string;
        updated_at: string;
        chapter_id: string;
        note_id: string;
      }[]
    >(
      `SELECT id, project_id, title, todo_state, updated_at, chapter_id, note_id FROM tasks
       WHERE project_id = $1 ORDER BY updated_at DESC`,
      [projectId],
    );
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      todoState: asTodo(row.todo_state) ?? "todo",
      updatedAt: row.updated_at,
      chapterId: row.chapter_id ?? "",
      noteId: row.note_id ?? "",
    }));
  });
}

export function saveTask(task: Task): Promise<void> {
  return withDb(async (db) => {
    await db.execute(
      `INSERT INTO tasks (id, project_id, title, todo_state, updated_at, chapter_id, note_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         todo_state = excluded.todo_state,
         updated_at = excluded.updated_at,
         chapter_id = excluded.chapter_id,
         note_id = excluded.note_id`,
      [task.id, task.projectId, task.title, task.todoState, task.updatedAt, task.chapterId, task.noteId],
    );
  });
}

let pendingNote: Note | null = null;
let noteTimer: ReturnType<typeof setTimeout> | null = null;
let noteSaveError: ((message: string) => void) | null = null;

export function watchNoteSaves(onError: (message: string) => void): void {
  noteSaveError = onError;
}

export function scheduleNoteSave(note: Note): void {
  pendingNote = note;
  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    void flushNoteSave().catch(() => undefined);
  }, 800);
}

export async function flushNoteSave(): Promise<void> {
  if (noteTimer) {
    clearTimeout(noteTimer);
    noteTimer = null;
  }
  const note = pendingNote;
  if (!note) return;
  pendingNote = null;
  try {
    await saveNote(note);
  } catch (error) {
    if (!pendingNote) pendingNote = note;
    const message = error instanceof Error ? error.message : "Could not save the note";
    noteSaveError?.(message);
    throw error;
  }
}

export function deleteTask(id: string): Promise<void> {
  return withDb(async (db) => {
    await db.execute(`DELETE FROM tasks WHERE id = $1`, [id]);
  });
}
