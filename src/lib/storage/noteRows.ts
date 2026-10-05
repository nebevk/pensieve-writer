import type Database from "@tauri-apps/plugin-sql";
import type { DocumentJson } from "$lib/model";
import { emptyDocument } from "$lib/model";
import type { Note, NoteCategory, NoteField, Task, TodoState } from "./organize";

/** Row-level reads and writes for notes and to-dos, used inside a database job that is already running. */

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

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  todo_state: string;
  updated_at: string;
  chapter_id: string;
  note_id: string;
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

export function asCategory(value: string): NoteCategory {
  if (value === "characters" || value === "places" || value === "research") return value;
  return "ideas";
}

export function asTodo(value: string | null): TodoState | null {
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

export async function readNotesWith(db: Database, projectId: string): Promise<Note[]> {
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
}

export async function writeNoteWith(db: Database, note: Note): Promise<void> {
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
}

export async function readTasksWith(db: Database, projectId: string): Promise<Task[]> {
  const rows = await db.select<TaskRow[]>(
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
}

export async function writeTaskWith(db: Database, task: Task): Promise<void> {
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
}
