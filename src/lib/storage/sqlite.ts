import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type {
  Chapter,
  ChapterOutline,
  DocumentJson,
  Shelf,
  SnapshotInfo,
  Writing,
  WritingLanguage,
  WritingOutline,
} from "$lib/model";
import { loadPrefs, savePrefs } from "$lib/prefs";
import { firstChapters, newWritingChapters } from "$lib/chapters/welcome";
import { wordsFor } from "$lib/editor/counts";
import { translate } from "$lib/i18n";
import { t } from "$lib/ui.svelte";
import type { Note, Task } from "./organize";
import { readNotesWith, readTasksWith, writeNoteWith, writeTaskWith } from "./noteRows";
import {
  missingItems,
  normalizeChapter,
  normalizeNote,
  normalizeTask,
  snapshotPayload,
  withRestoredChapter,
  writingFromBackup,
  writingFromSnapshot,
  type SnapshotPayload,
} from "./restore";
import type { BackupContent, BackupWriting } from "./backupFile";

/*
 * One file is one project. Its writings are the rows of the `projects` table (the name is older than
 * writings): each chapter and each snapshot belongs to one writing by `project_id`, which holds the
 * writing's id. The `shelf` row is the project itself: the id its notes and to-dos are saved under, its
 * name and its writing folders. A file from before projects held several writings has one row in
 * `projects`; it becomes the project's first writing and keeps its id, which also becomes the project's,
 * so nothing in it has to move.
 */

const DEFAULT_DB_URL = "sqlite:pensieve.db";
const SCHEMA_VERSION = 4;
const HOURLY_LIMIT = 48;
const DAILY_LIMIT = 30;
const MANUAL_LIMIT = 20;

type WritingRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  language?: string;
  kind?: string;
  word_goal?: number;
  position?: number;
  folder?: string;
  deleted_at?: string;
  opened_at?: string;
  opened_chapter?: string;
};

const WRITING_COLUMNS =
  "id, title, language, kind, word_goal, position, folder, deleted_at, opened_at, opened_chapter, created_at, updated_at";

type ChapterRow = {
  id: string;
  project_id: string;
  title: string;
  position: number;
  content_json: string;
  plain_text: string;
  synopsis?: string;
  status?: string;
  language?: string;
  word_goal?: number;
  part?: string;
  updated_at: string;
};

type SnapshotRow = {
  id: string;
  project_id: string;
  created_at: string;
  kind?: string;
  payload?: string;
};

type ShelfRow = { project_id: string; title: string; folders_json: string; created_at: string };

type SnapshotKind = SnapshotInfo["kind"];

/**
 * The open file, kept here: set when a project opens, and never read back from the settings while a switch
 * runs, where a settings save from the page could still hold the old path.
 */
let openPath: string | null = null;

function connectionUrl(): string {
  const path = (openPath ?? loadPrefs().projectPath).trim();
  return path ? `sqlite:${path}` : DEFAULT_DB_URL;
}

let databasePromise: Promise<Database> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
/** The open project's id, set once its shelf is read: notes and to-dos for any other project are refused. */
let openProjectId = "";

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function database(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }
  return databasePromise;
}

async function openDatabase(): Promise<Database> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error(t("errNoWindow"));
  }
  const db = await Database.load(connectionUrl());
  try {
    await db.select("PRAGMA journal_mode = WAL");
    await db.select("PRAGMA busy_timeout = 5000");
    await keepCopyBeforeUpgrade(db);
    await ensureSchema(db);
    const versions = await db.select<{ version: number }[]>(
      "SELECT version FROM schema_version WHERE id = 1",
    );
    const version = Number(versions[0]?.version);
    if (version !== SCHEMA_VERSION) {
      throw new Error(
        version == null || Number.isNaN(version)
          ? t("errNoSchema")
          : t("errSchemaVersion", { version: String(version), expected: String(SCHEMA_VERSION) }),
      );
    }
    return db;
  } catch (error) {
    // A file that opened but couldn't be made ready is let go, so nothing holds its folder.
    await db.close(db.path).catch(() => undefined);
    throw error;
  }
}

async function columnNames(db: Database, table: string): Promise<Set<string>> {
  const rows = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => row.name));
}

/** Columns added since the first version, in the order they came, with the change that adds each. */
const ADDED_COLUMNS: [table: string, column: string, change: string][] = [
  ["projects", "language", "ALTER TABLE projects ADD COLUMN language TEXT NOT NULL DEFAULT 'en'"],
  ["chapters", "language", "ALTER TABLE chapters ADD COLUMN language TEXT NOT NULL DEFAULT ''"],
  ["snapshots", "kind", "ALTER TABLE snapshots ADD COLUMN kind TEXT NOT NULL DEFAULT 'hourly'"],
  ["notes", "fields_json", "ALTER TABLE notes ADD COLUMN fields_json TEXT NOT NULL DEFAULT '[]'"],
  ["notes", "aliases", "ALTER TABLE notes ADD COLUMN aliases TEXT NOT NULL DEFAULT ''"],
  ["tasks", "chapter_id", "ALTER TABLE tasks ADD COLUMN chapter_id TEXT NOT NULL DEFAULT ''"],
  ["tasks", "note_id", "ALTER TABLE tasks ADD COLUMN note_id TEXT NOT NULL DEFAULT ''"],
  ["chapters", "word_goal", "ALTER TABLE chapters ADD COLUMN word_goal INTEGER NOT NULL DEFAULT 0"],
  ["chapters", "part", "ALTER TABLE chapters ADD COLUMN part TEXT NOT NULL DEFAULT ''"],
  ["projects", "kind", "ALTER TABLE projects ADD COLUMN kind TEXT NOT NULL DEFAULT 'novel'"],
  ["projects", "word_goal", "ALTER TABLE projects ADD COLUMN word_goal INTEGER NOT NULL DEFAULT 0"],
  // Writings in a project (version 4): their order, folder, the Deleted folder and the last one opened.
  ["projects", "position", "ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0"],
  ["projects", "folder", "ALTER TABLE projects ADD COLUMN folder TEXT NOT NULL DEFAULT ''"],
  ["projects", "deleted_at", "ALTER TABLE projects ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''"],
  ["projects", "opened_at", "ALTER TABLE projects ADD COLUMN opened_at TEXT NOT NULL DEFAULT ''"],
  ["projects", "opened_chapter", "ALTER TABLE projects ADD COLUMN opened_chapter TEXT NOT NULL DEFAULT ''"],
  // A chapter's words, kept with it so the library's tree needn't read its text; -1 until counted.
  ["chapters", "words", "ALTER TABLE chapters ADD COLUMN words INTEGER NOT NULL DEFAULT -1"],
];

const BOOTSTRAP = [
  `CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
  )`,
  `INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 3)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    content_json TEXT NOT NULL,
    plain_text TEXT NOT NULL,
    synopsis TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    language TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chapters_project_position ON chapters (project_id, position)`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'hourly',
    payload TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_snapshots_project_created ON snapshots (project_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    plain_text TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'ideas',
    tags TEXT NOT NULL DEFAULT '',
    todo_state TEXT,
    fields_json TEXT NOT NULL DEFAULT '[]',
    aliases TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS note_chapters (
    note_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    PRIMARY KEY (note_id, chapter_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    todo_state TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    chapter_id TEXT NOT NULL DEFAULT '',
    note_id TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS personal_words (
    language TEXT NOT NULL,
    word TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (language, word)
  )`,
];

async function tableExists(db: Database, name: string): Promise<boolean> {
  const rows = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = $1`,
    [name],
  );
  return rows.length > 0;
}

/** Where the open file is on disk. */
async function databaseFilePath(): Promise<string> {
  return (openPath ?? loadPrefs().projectPath).trim() || (await invoke<string>("default_project_path"));
}

/**
 * A file from an older Pensieve, with a book in it, is copied as it was before it changes for projects
 * that hold several writings: "pensieve.db.before-projects", beside it, once. The change only adds, but
 * nothing about her text is risked on it.
 */
async function keepCopyBeforeUpgrade(db: Database): Promise<void> {
  if (!(await tableExists(db, "schema_version")) || !(await tableExists(db, "projects"))) return;
  const versions = await db.select<{ version: number }[]>("SELECT version FROM schema_version WHERE id = 1");
  if (Number(versions[0]?.version) >= SCHEMA_VERSION) return;
  const books = await db.select<{ count: number }[]>("SELECT COUNT(*) AS count FROM projects");
  if (!Number(books[0]?.count)) return;
  const copy = `${await databaseFilePath()}.before-projects`;
  if (await invoke<boolean>("project_file_exists", { path: copy })) return;
  // VACUUM INTO writes a whole, consistent copy, text still in the write-ahead log included.
  await db.execute("VACUUM INTO $1", [copy]);
}

async function ensureSchema(db: Database): Promise<void> {
  if (!(await tableExists(db, "schema_version"))) {
    for (const statement of BOOTSTRAP) {
      await db.execute(statement);
    }
  }
  // Each table's columns are read once, not once per column: every read is a trip to the database.
  const tables = new Map<string, Set<string>>();
  for (const [table, column, change] of ADDED_COLUMNS) {
    let columns = tables.get(table);
    if (!columns) {
      columns = await columnNames(db, table);
      tables.set(table, columns);
    }
    if (!columns.has(column)) {
      await db.execute(change);
      columns.add(column);
    }
  }
  await db.execute(
    `CREATE TABLE IF NOT EXISTS personal_words (
      language TEXT NOT NULL,
      word TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (language, word)
    )`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS shelf (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      folders_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    )`,
  );
  // A file with one book in it: the book becomes the project's first writing, and its id the project's.
  await db.execute(
    `INSERT OR IGNORE INTO shelf (id, project_id, title, folders_json, created_at)
     SELECT 1, id, title, '[]', created_at FROM projects ORDER BY created_at LIMIT 1`,
  );
  await db.execute("UPDATE schema_version SET version = 3 WHERE id = 1 AND version < 3");
  await db.execute("UPDATE schema_version SET version = 4 WHERE id = 1 AND version < 4");
}

export function shouldTakeSnapshot(latestCreatedAt: string | null, now: Date): boolean {
  if (!latestCreatedAt) return true;
  const latest = Date.parse(latestCreatedAt);
  if (Number.isNaN(latest)) return true;
  return now.getTime() - latest >= 60 * 60 * 1000;
}

function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** "Split into chapters" lives in the old `kind` column: a one-page writing is an "article". */
function kindOf(split: boolean): string {
  return split ? "novel" : "article";
}

/** A one-page writing that holds more than one chapter shows them all: none is ever hidden. */
function splitOf(kind: string | undefined, chapters: number): boolean {
  return kind !== "article" || chapters > 1;
}

function languageOf(value: string | undefined): WritingLanguage {
  return value === "sl" ? "sl" : "en";
}

async function writeWriting(db: Database, writing: Writing): Promise<void> {
  if (writing.chapters.length === 0) {
    throw new Error(t("errNeedsChapter"));
  }
  const ids = writing.chapters.map((chapter) => chapter.id);
  const placeholders = ids.map((_, index) => `$${index + 2}`).join(", ");
  // A chapter is in one writing only. Saving one writing must never write over another's chapter.
  const elsewhere = await db.select<{ id: string }[]>(
    `SELECT id FROM chapters WHERE project_id <> $1 AND id IN (${placeholders})`,
    [writing.id, ...ids],
  );
  if (elsewhere.length > 0) throw new Error(t("errChapterInOtherWriting"));

  const updatedAt = new Date().toISOString();
  await db.execute(
    `INSERT INTO projects (id, title, language, kind, word_goal, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       language = excluded.language,
       kind = excluded.kind,
       word_goal = excluded.word_goal,
       updated_at = excluded.updated_at`,
    [
      writing.id,
      writing.title,
      writing.language === "sl" ? "sl" : "en",
      kindOf(writing.split),
      Number.isFinite(writing.wordGoal) ? writing.wordGoal : 0,
      writing.createdAt,
      updatedAt,
    ],
  );

  // Chapters new to the file are written first. A heading on the page moves text from a chapter into a
  // new one, and the writes are separate: if Pensieve stops between them, the text is then in both
  // chapters rather than in neither.
  const saved = new Set(
    (await db.select<{ id: string }[]>(`SELECT id FROM chapters WHERE project_id = $1`, [writing.id])).map((row) => row.id),
  );
  const ordered = [
    ...writing.chapters.filter((chapter) => !saved.has(chapter.id)),
    ...writing.chapters.filter((chapter) => saved.has(chapter.id)),
  ];
  for (const chapter of ordered) {
    await db.execute(
      `INSERT INTO chapters (
         id, project_id, title, position, content_json, plain_text, synopsis, status, language, word_goal, part, updated_at, words
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         position = excluded.position,
         content_json = excluded.content_json,
         plain_text = excluded.plain_text,
         synopsis = excluded.synopsis,
         status = excluded.status,
         language = excluded.language,
         word_goal = excluded.word_goal,
         part = excluded.part,
         updated_at = excluded.updated_at,
         words = excluded.words`,
      [
        chapter.id,
        writing.id,
        chapter.title,
        chapter.position,
        JSON.stringify(chapter.contentJson),
        chapter.plainText,
        chapter.synopsis ?? "",
        chapter.status ?? "draft",
        chapter.language === "en" || chapter.language === "sl" ? chapter.language : "",
        Number.isFinite(chapter.wordGoal) ? chapter.wordGoal : 0,
        chapter.part ?? "",
        chapter.updatedAt,
        wordsFor(chapter.id, chapter.plainText),
      ],
    );
  }

  // Only this writing's chapters that it no longer has: every other writing's stay as they are.
  await db.execute(
    `DELETE FROM chapters WHERE project_id = $1 AND id NOT IN (${placeholders})`,
    [writing.id, ...ids],
  );

  await maybeSnapshot(db, writing);
}

async function maybeSnapshot(db: Database, writing: Writing): Promise<void> {
  const now = new Date();
  const hourly = await db.select<{ created_at: string }[]>(
    `SELECT created_at FROM snapshots
     WHERE project_id = $1 AND kind = 'hourly'
     ORDER BY created_at DESC LIMIT 1`,
    [writing.id],
  );
  if (shouldTakeSnapshot(hourly[0]?.created_at ?? null, now)) {
    await insertSnapshot(db, writing, "hourly");
  }

  const daily = await db.select<{ created_at: string }[]>(
    `SELECT created_at FROM snapshots
     WHERE project_id = $1 AND kind = 'daily'
     ORDER BY created_at DESC LIMIT 1`,
    [writing.id],
  );
  const latestDay = daily[0]?.created_at ? localDay(daily[0].created_at) : "";
  if (latestDay !== localDay(now.toISOString())) {
    await insertSnapshot(db, writing, "daily");
  }
}

/** Earlier versions belong to a writing; each also keeps the project's notes and to-dos as they were. */
async function insertSnapshot(db: Database, writing: Writing, kind: SnapshotKind): Promise<void> {
  const notes = await readNotesWith(db);
  const tasks = await readTasksWith(db);
  const payload = snapshotPayload(writing, notes, tasks);
  await db.execute(
    `INSERT INTO snapshots (id, project_id, created_at, kind, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [crypto.randomUUID(), writing.id, new Date().toISOString(), kind, JSON.stringify(payload)],
  );
  const limit = kind === "daily" ? DAILY_LIMIT : kind === "hourly" ? HOURLY_LIMIT : MANUAL_LIMIT;
  await db.execute(
    `DELETE FROM snapshots
     WHERE project_id = $1
       AND kind = $2
       AND id NOT IN (
         SELECT id FROM snapshots
         WHERE project_id = $1 AND kind = $2
         ORDER BY created_at DESC
         LIMIT $3
       )`,
    [writing.id, kind, limit],
  );
}

async function readWritingRow(db: Database, writingId: string): Promise<WritingRow | null> {
  const rows = await db.select<WritingRow[]>(`SELECT ${WRITING_COLUMNS} FROM projects WHERE id = $1`, [writingId]);
  return rows[0] ?? null;
}

async function readWriting(db: Database, writingId: string): Promise<Writing | null> {
  const row = await readWritingRow(db, writingId);
  if (!row) return null;
  const chapters = await db.select<ChapterRow[]>(
    `SELECT id, project_id, title, position, content_json, plain_text, synopsis, status, language, word_goal, part, updated_at
     FROM chapters
     WHERE project_id = $1
     ORDER BY position ASC, title ASC`,
    [row.id],
  );
  return {
    id: row.id,
    title: row.title,
    language: languageOf(row.language),
    split: splitOf(row.kind, chapters.length),
    wordGoal: Number(row.word_goal) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chapters: chapters.map(toChapter),
  };
}

function toChapter(row: ChapterRow): Chapter {
  let contentJson: DocumentJson;
  try {
    const parsed = (
      typeof row.content_json === "string" ? JSON.parse(row.content_json) : row.content_json
    ) as DocumentJson;
    if (!parsed || typeof parsed !== "object" || parsed.type !== "doc") {
      throw new Error(t("errChapterNotDocument"));
    }
    contentJson = parsed;
  } catch (error) {
    throw new Error(
      t("errChapterUnreadable", { title: row.title, reason: error instanceof Error ? error.message : t("errInvalidContent") }),
    );
  }
  return {
    id: row.id,
    writingId: row.project_id,
    title: row.title,
    position: Number(row.position),
    contentJson,
    plainText: row.plain_text ?? "",
    synopsis: row.synopsis ?? "",
    status: row.status === "revised" || row.status === "final" ? row.status : "draft",
    language: row.language === "en" || row.language === "sl" ? row.language : "",
    wordGoal: Number(row.word_goal) || 0,
    part: row.part ?? "",
    updatedAt: row.updated_at,
  };
}

async function readShelfRow(db: Database): Promise<ShelfRow | null> {
  const rows = await db.select<ShelfRow[]>(`SELECT project_id, title, folders_json, created_at FROM shelf WHERE id = 1`);
  return rows[0] ?? null;
}

function foldersOf(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string" && name.trim() !== "") : [];
  } catch {
    return [];
  }
}

/** Every writing of the project in order, with its chapters' titles, parts and words, but not their text. */
async function readOutline(db: Database): Promise<WritingOutline[]> {
  const rows = await db.select<WritingRow[]>(`SELECT ${WRITING_COLUMNS} FROM projects ORDER BY position ASC, created_at ASC`);
  // The text is read only for chapters whose words weren't kept yet (saved by an older Pensieve), once.
  const chapters = await db.select<{ id: string; project_id: string; title: string; part?: string; position: number; status?: string; words: number; plain_text?: string | null }[]>(
    `SELECT id, project_id, title, part, position, status, words, CASE WHEN words < 0 THEN plain_text ELSE NULL END AS plain_text
     FROM chapters ORDER BY position ASC, title ASC`,
  );
  const byWriting = new Map<string, ChapterOutline[]>();
  for (const chapter of chapters) {
    const list = byWriting.get(chapter.project_id) ?? [];
    let words = Number(chapter.words);
    if (words < 0) {
      words = wordsFor(chapter.id, chapter.plain_text ?? "");
      await db.execute(`UPDATE chapters SET words = $2 WHERE id = $1`, [chapter.id, words]);
    }
    list.push({
      id: chapter.id,
      title: chapter.title,
      part: chapter.part ?? "",
      position: Number(chapter.position),
      status: chapter.status === "revised" || chapter.status === "final" ? chapter.status : "draft",
      words,
      empty: words === 0,
    });
    byWriting.set(chapter.project_id, list);
  }
  return rows.map((row) => {
    const list = byWriting.get(row.id) ?? [];
    return {
      id: row.id,
      title: row.title,
      folder: row.folder ?? "",
      position: Number(row.position) || 0,
      split: splitOf(row.kind, list.length),
      language: languageOf(row.language),
      wordGoal: Number(row.word_goal) || 0,
      deletedAt: row.deleted_at ?? "",
      openedAt: row.opened_at ?? "",
      openedChapter: row.opened_chapter ?? "",
      updatedAt: row.updated_at,
      chapters: list,
    };
  });
}

async function readShelf(db: Database): Promise<Shelf> {
  const row = await readShelfRow(db);
  if (!row) throw new Error(t("errNoSchema"));
  return { projectId: row.project_id, title: row.title, folders: foldersOf(row.folders_json), writings: await readOutline(db) };
}

async function nextPosition(db: Database): Promise<number> {
  const rows = await db.select<{ last: number | null }[]>(`SELECT MAX(position) AS last FROM projects`);
  const last = rows[0]?.last;
  return last === null || last === undefined ? 0 : Number(last) + 1;
}

/** A new writing's row, in its folder and place; its chapters are written by writeWriting after it. */
async function insertWritingRow(db: Database, writing: Writing, folder: string, position: number): Promise<void> {
  await db.execute(
    `INSERT INTO projects (id, title, language, kind, word_goal, position, folder, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      writing.id,
      writing.title,
      writing.language,
      kindOf(writing.split),
      writing.wordGoal,
      position,
      folder,
      writing.createdAt,
      writing.updatedAt,
    ],
  );
}

/** A writing with no chapters (a stop between two writes, long ago) gets one empty chapter back. */
async function readWritingWhole(db: Database, writingId: string): Promise<Writing> {
  const writing = await readWriting(db, writingId);
  if (!writing) throw new Error(t("errWritingMissing"));
  if (writing.chapters.length > 0) return writing;
  const repaired = { ...writing, chapters: newWritingChapters(writing.id, writing.split, writing.title, writing.language) };
  await writeWriting(db, repaired);
  return repaired;
}

function blankWriting(title: string, split: boolean, language: WritingLanguage, now = new Date().toISOString()): Writing {
  const id = crypto.randomUUID();
  return {
    id,
    title,
    language,
    split,
    wordGoal: 0,
    createdAt: now,
    updatedAt: now,
    chapters: newWritingChapters(id, split, title, language),
  };
}

export type OpenedProject = { shelf: Shelf; writing: Writing };

/**
 * What a new project's file starts with: its name, and its first writing's title; with `first`, that
 * writing's chapters, from a file brought in.
 */
export type NewProject = {
  title: string;
  writingTitle: string;
  welcome: boolean;
  first?: { split: boolean; chapters?: (writingId: string) => Chapter[] };
};

/**
 * Opens the project in the open file: its shelf, and the writing to show (the one asked for if it is
 * there and not deleted, else the one opened last, else the first). A brand-new file becomes a project
 * with its first writing, on the welcome page when it is the first one in the library.
 */
export function openShelf(writingId: string, fresh: NewProject): Promise<OpenedProject> {
  return enqueue(async () => {
    const db = await database();
    if (!(await readShelfRow(db))) {
      const language = loadPrefs().uiLanguage;
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR IGNORE INTO shelf (id, project_id, title, folders_json, created_at) VALUES (1, $1, $2, '[]', $3)`,
        [crypto.randomUUID(), fresh.title, now],
      );
      const writing = blankWriting(fresh.writingTitle, fresh.first?.split ?? true, language, now);
      if (fresh.welcome) writing.chapters = firstChapters(writing.id, true, writing.title, language);
      else if (fresh.first?.chapters) writing.chapters = fresh.first.chapters(writing.id);
      await insertWritingRow(db, writing, "", await nextPosition(db));
      await writeWriting(db, writing);
    }
    const shelf = await readShelf(db);
    openProjectId = shelf.projectId;
    const live = shelf.writings.filter((item) => !item.deletedAt);
    const lastOpened = [...live].sort((a, b) => (b.openedAt > a.openedAt ? 1 : b.openedAt < a.openedAt ? -1 : 0))[0];
    const chosen = live.find((item) => item.id === writingId) ?? (lastOpened?.openedAt ? lastOpened : live[0]);
    if (chosen) return { shelf, writing: await readWritingWhole(db, chosen.id) };
    // Every writing is in Deleted: a new one, so there is a page to write on.
    const language = loadPrefs().uiLanguage;
    const writing = blankWriting(translate(language, "untitled"), true, language);
    await insertWritingRow(db, writing, "", await nextPosition(db));
    await writeWriting(db, writing);
    return { shelf: await readShelf(db), writing };
  });
}

/**
 * What the search across projects reads of one: its writings' chapters (and whether a writing is split into
 * chapters or is one page), and its notes, as text.
 */
export type ProjectText = {
  writings: { id: string; title: string; split?: boolean; chapters: { id: string; title: string; text: string }[] }[];
  notes: { id: string; title: string; text: string }[];
};

async function readText(db: Database): Promise<ProjectText> {
  // Every column, as a file from an older Pensieve may not have them all yet.
  const rows = await db.select<Record<string, unknown>[]>("SELECT * FROM projects");
  const live = rows
    // A writing in Deleted isn't searched.
    .filter((row) => !row.deleted_at)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const writings = live.map((row) => ({ id: String(row.id), title: String(row.title ?? ""), split: true, chapters: [] as ProjectText["writings"][number]["chapters"] }));
  const byId = new Map(writings.map((writing) => [writing.id, writing]));
  const chapters = await db.select<{ id: string; project_id: string; title: string; plain_text: string | null }[]>(
    "SELECT id, project_id, title, plain_text FROM chapters ORDER BY position",
  );
  for (const chapter of chapters) byId.get(chapter.project_id)?.chapters.push({ id: chapter.id, title: chapter.title, text: chapter.plain_text ?? "" });
  live.forEach((row, index) => (writings[index].split = splitOf(row.kind === undefined ? undefined : String(row.kind), writings[index].chapters.length)));
  let notes: ProjectText["notes"] = [];
  try {
    const noteRows = await db.select<{ id: string; title: string; plain_text: string | null }[]>("SELECT id, title, plain_text FROM notes ORDER BY title");
    notes = noteRows.map((note) => ({ id: note.id, title: note.title, text: note.plain_text ?? "" }));
  } catch {
    // A file from before notes.
  }
  return { writings, notes };
}

/** An idea of a project, as the Ideas tab lists another project's: read, never written from there. */
export type IdeaText = { id: string; title: string; text: string; aliases: string; createdAt: string };

async function readIdeas(db: Database): Promise<IdeaText[]> {
  try {
    const rows = await db.select<Record<string, unknown>[]>("SELECT * FROM notes WHERE category = 'ideas'");
    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      text: String(row.plain_text ?? ""),
      aliases: String(row.aliases ?? ""),
      createdAt: String(row.created_at ?? ""),
    }));
  } catch {
    // A file from before notes.
    return [];
  }
}

/**
 * Reads a project by its file. The open one is read through its own connection, as opening its file again
 * would take that over; any other is opened, read and let go at once, as Windows won't move a folder while a
 * file in it is open. Only a file that is there is asked for: one that isn't would be made.
 */
async function readProject<T>(path: string, read: (db: Database) => Promise<T>): Promise<T> {
  const key = (value: string) => value.trim().replace(/\//g, "\\").toLowerCase();
  if (key(path) === key(openPath ?? loadPrefs().projectPath)) return enqueue(async () => read(await database()));
  const url = `sqlite:${path}`;
  const db = await Database.load(url);
  try {
    return await read(db);
  } finally {
    await db.close(url).catch(() => undefined);
  }
}

/** A project's text, for the search across projects. */
export function readProjectText(path: string): Promise<ProjectText> {
  return readProject(path, readText);
}

/** A project's ideas, for the Ideas tab's All projects. */
export function readProjectIdeas(path: string): Promise<IdeaText[]> {
  return readProject(path, readIdeas);
}

/**
 * Where each idea sits on the Ideas map (owner, 13 October), in a table of its own, made when first needed:
 * the ideas' text is saved as it always was, whatever happens to their places.
 */
const IDEA_PLACES = "CREATE TABLE IF NOT EXISTS idea_places (note_id TEXT PRIMARY KEY NOT NULL, x REAL NOT NULL, y REAL NOT NULL)";

export function readIdeaPlaces(): Promise<Map<string, { x: number; y: number }>> {
  return enqueue(async () => {
    const db = await database();
    await db.execute(IDEA_PLACES);
    const rows = await db.select<{ note_id: string; x: number; y: number }[]>("SELECT note_id, x, y FROM idea_places");
    return new Map(rows.map((row) => [row.note_id, { x: Number(row.x), y: Number(row.y) }]));
  });
}

/** Where ideas were put on the map, in one turn of the queue. */
export function saveIdeaPlaces(moved: [string, { x: number; y: number }][]): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    await db.execute(IDEA_PLACES);
    for (const [noteId, place] of moved) {
      await db.execute(
        "INSERT INTO idea_places (note_id, x, y) VALUES ($1, $2, $3) ON CONFLICT(note_id) DO UPDATE SET x = excluded.x, y = excluded.y",
        [noteId, Math.round(place.x), Math.round(place.y)],
      );
    }
  });
}

/** The open project's shelf as saved now, after a writing was added, moved, renamed or deleted. */
export function readOpenShelf(): Promise<Shelf> {
  return enqueue(async () => readShelf(await database()));
}

/** One writing of the open project, whole, to open it. */
export function loadWriting(writingId: string): Promise<Writing> {
  return enqueue(async () => readWritingWhole(await database(), writingId));
}

/** Adds a writing at the end of the open project, in a folder or none, and returns it. */
export function addWriting(input: {
  title: string;
  folder: string;
  split: boolean;
  language: WritingLanguage;
  wordGoal?: number;
  chapters?: (writingId: string) => Chapter[];
}): Promise<Writing> {
  return enqueue(async () => {
    const db = await database();
    const writing = blankWriting(input.title, input.split, input.language);
    writing.wordGoal = input.wordGoal ?? 0;
    if (input.chapters) writing.chapters = input.chapters(writing.id);
    await insertWritingRow(db, writing, input.folder, await nextPosition(db));
    await writeWriting(db, writing);
    return writing;
  });
}

export type WritingFields = {
  title?: string;
  folder?: string;
  position?: number;
  deletedAt?: string;
  openedAt?: string;
  openedChapter?: string;
};

const FIELD_COLUMNS: Record<keyof WritingFields, string> = {
  title: "title",
  folder: "folder",
  position: "position",
  deletedAt: "deleted_at",
  openedAt: "opened_at",
  openedChapter: "opened_chapter",
};

/** Changes a writing's place, name or state without touching its text. */
export function setWritingFields(writingId: string, fields: WritingFields): Promise<void> {
  return enqueue(async () => {
    const keys = (Object.keys(fields) as (keyof WritingFields)[]).filter((key) => fields[key] !== undefined);
    if (keys.length === 0) return;
    const sets = keys.map((key, index) => `${FIELD_COLUMNS[key]} = $${index + 2}`).join(", ");
    await (await database()).execute(`UPDATE projects SET ${sets} WHERE id = $1`, [writingId, ...keys.map((key) => fields[key])]);
  });
}

/** A copy of a writing, with new ids for it and its chapters, right after the original. */
export function duplicateWriting(writingId: string, title: string): Promise<Writing> {
  return enqueue(async () => {
    const db = await database();
    const original = await readWritingWhole(db, writingId);
    const row = await readWritingRow(db, writingId);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // A JSON copy, so the copy shares nothing with the original.
    const chapters = (JSON.parse(JSON.stringify(original.chapters)) as Chapter[]).map((chapter) => ({
      ...chapter,
      id: crypto.randomUUID(),
      writingId: id,
      updatedAt: now,
    }));
    // A one-page writing's page carries its title on its title line: the copy's says the copy's name.
    if (!original.split && chapters.length === 1) chapters[0] = { ...chapters[0], title };
    const copy: Writing = { ...original, id, title, createdAt: now, updatedAt: now, chapters };
    const position = (Number(row?.position) || 0) + 1;
    await db.execute(`UPDATE projects SET position = position + 1 WHERE position >= $1`, [position]);
    await insertWritingRow(db, copy, row?.folder ?? "", position);
    await writeWriting(db, copy);
    return copy;
  });
}

/** Deletes a writing for good: its chapters and its earlier versions go with it. */
export function eraseWriting(writingId: string): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    await db.execute(`DELETE FROM chapters WHERE project_id = $1`, [writingId]);
    await db.execute(`DELETE FROM snapshots WHERE project_id = $1`, [writingId]);
    await db.execute(`DELETE FROM projects WHERE id = $1`, [writingId]);
  });
}

/** Renames the open project, or changes its writing folders. */
export function setShelf(fields: { title?: string; folders?: string[] }): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    if (fields.title !== undefined) await db.execute(`UPDATE shelf SET title = $1 WHERE id = 1`, [fields.title]);
    if (fields.folders !== undefined) {
      await db.execute(`UPDATE shelf SET folders_json = $1 WHERE id = 1`, [JSON.stringify(fields.folders)]);
    }
  });
}

/** Renames a writing folder and moves its writings with it; renaming to "" takes them out of folders. */
export function renameWritingFolder(from: string, to: string, folders: string[]): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    await db.execute(`UPDATE projects SET folder = $2 WHERE folder = $1`, [from, to]);
    await db.execute(`UPDATE shelf SET folders_json = $1 WHERE id = 1`, [JSON.stringify(folders)]);
  });
}

export function withDb<T>(work: (db: Database) => Promise<T>): Promise<T> {
  return enqueue(async () => work(await database()));
}

/**
 * Runs a write of the open project's notes or to-dos. One made for another project (a note still
 * waiting while the projects switched) is refused rather than written into this one.
 */
export function withProjectDb<T>(projectId: string, work: (db: Database) => Promise<T>): Promise<T> {
  return enqueue(async () => {
    const db = await database();
    if (!openProjectId || projectId !== openProjectId) throw new Error(t("errOtherProject"));
    return work(db);
  });
}

export function keepSnapshot(writing: Writing): Promise<void> {
  return enqueue(async () => {
    await insertSnapshot(await database(), writing, "manual");
  });
}

/** Keeps a snapshot of a writing as it is saved right now, with the project's notes as they are. */
export function snapshotSavedWriting(writingId: string): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    const writing = await readWriting(db, writingId);
    if (!writing) throw new Error(t("errNoteBookMissing"));
    await insertSnapshot(db, writing, "manual");
  });
}

/** Runs after every write already queued, so nothing lands in the file mid-checkpoint. */
export function checkpointDatabase(): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    await db.select("PRAGMA wal_checkpoint(TRUNCATE)");
  });
}

/** Runs after every write already queued, so a pending save can't land in the next project's file. */
export function switchProjectFile(absolutePath: string, remember = true): Promise<void> {
  return enqueue(async () => {
    const previous = connectionUrl();
    const open = databasePromise;
    openPath = absolutePath;
    // A sample's file, opened only to be written, never becomes the project that opens at the next start.
    if (remember) savePrefs({ ...loadPrefs(), projectPath: absolutePath });
    // Nothing is opened just to close it: at the start, the default file must not be made for nothing.
    if (open) {
      try {
        await (await open).close(previous);
      } catch {
        // The previous file may have failed to open, or its pool is already closed.
      }
    }
    databasePromise = null;
    openProjectId = "";
    await database();
  });
}

/** Closes the open file's pool, if any; one that failed to open is simply dropped. */
async function closeOpen(): Promise<void> {
  const open = databasePromise;
  databasePromise = null;
  if (!open) return;
  try {
    await (await open).close(connectionUrl());
  } catch {
    // The file failed to open, or its pool is already closed.
  }
}

/**
 * Lets go of the open project's file while `move` renames or moves its folder (Windows won't while a file
 * in it is open), then opens it where it went; `move` returns its new path. It is one step of the queue:
 * saves and reads asked for meanwhile wait and run on the file in its new place, and the project stays the
 * open one, so its notes and to-dos keep saving. When the file won't open there, `back` moves the folder
 * back and it opens where it was. Returns where the file is.
 */
export function moveProjectFile(move: () => Promise<string>, back: () => Promise<void>): Promise<string> {
  return enqueue(async () => {
    const file = (openPath ?? loadPrefs().projectPath).trim();
    await closeOpen();
    let moved: string;
    try {
      moved = await move();
    } catch (error) {
      // It didn't move: it opens where it was.
      await database();
      throw error;
    }
    openPath = moved;
    try {
      await database();
    } catch (error) {
      await closeOpen();
      try {
        await back();
        openPath = file;
      } catch {
        // It stays where it went; the error below says why it won't open.
      }
      await database().catch(() => undefined);
      throw error;
    }
    savePrefs({ ...loadPrefs(), projectPath: moved });
    return moved;
  });
}

/** Puts the open project's writings in this order. */
export function setWritingOrder(ids: string[]): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    for (const [index, id] of ids.entries()) await db.execute(`UPDATE projects SET position = $2 WHERE id = $1`, [id, index]);
  });
}

/** Adds the snapshot's or backup's notes and to-dos that the project no longer has. Existing ones stay as they are. */
async function addMissingNotesAndTasks(db: Database, notes: Note[] | undefined, tasks: Task[] | undefined): Promise<void> {
  if (!openProjectId) return;
  const noteIds = await db.select<{ id: string }[]>(`SELECT id FROM notes`);
  for (const note of missingItems(notes, noteIds.map((row) => row.id))) {
    await writeNoteWith(db, normalizeNote(note, openProjectId));
  }
  const taskIds = await db.select<{ id: string }[]>(`SELECT id FROM tasks`);
  for (const task of missingItems(tasks, taskIds.map((row) => row.id))) {
    await writeTaskWith(db, normalizeTask(task, openProjectId));
  }
}

/** The whole open project, every writing with its text, for a Drive backup. */
export function readWholeProject(): Promise<{ shelf: Shelf; writings: BackupWriting[]; notes: Note[]; tasks: Task[] }> {
  return enqueue(async () => {
    const db = await database();
    const shelf = await readShelf(db);
    const writings: BackupWriting[] = [];
    for (const outline of shelf.writings) {
      const writing = await readWriting(db, outline.id);
      // One with no chapters holds no text (a save cut short): a backup with it couldn't be read back.
      if (writing && writing.chapters.length > 0) writings.push({ ...writing, folder: outline.folder, position: outline.position, deletedAt: outline.deletedAt });
    }
    return { shelf, writings, notes: await readNotesWith(db), tasks: await readTasksWith(db) };
  });
}

/**
 * Puts a Drive backup back into the open project. Each writing in it replaces the writing with its id,
 * after a "Before restore" snapshot of that one, or comes back as a writing of its own when the project
 * no longer has it. A backup of one book (from before projects held several writings) restores into the
 * writing it came from when the project has it, and otherwise comes in as a new writing; nothing else is
 * written over. Writings the backup doesn't have stay, and so do notes and to-dos it doesn't have.
 * Returns the id of the writing to open.
 */
export function restoreFromBackup(backup: BackupContent): Promise<string> {
  return enqueue(async () => {
    const db = await database();
    let first = "";
    for (const saved of backup.writings) {
      // One that was in Deleted when the backup was made doesn't come back onto the shelf.
      const deletedAt = typeof saved.deletedAt === "string" ? saved.deletedAt : "";
      const current = await readWriting(db, saved.id);
      if (current) {
        await insertSnapshot(db, current, "before-restore");
        await writeWriting(db, writingFromBackup(current, saved));
        if (!deletedAt) {
          await db.execute(`UPDATE projects SET deleted_at = '' WHERE id = $1`, [current.id]);
          first ||= current.id;
        }
        continue;
      }
      // Back as a writing of its own. A chapter id another writing has now gets a new one.
      const taken = new Set((await db.select<{ id: string }[]>(`SELECT id FROM chapters`)).map((row) => row.id));
      const now = new Date().toISOString();
      const shell: Writing = {
        id: saved.id,
        title: saved.title,
        language: languageOf(saved.language),
        split: saved.split,
        wordGoal: 0,
        createdAt: now,
        updatedAt: now,
        chapters: [],
      };
      const restored = writingFromBackup(shell, saved);
      restored.chapters = restored.chapters.map((chapter) => (taken.has(chapter.id) ? { ...chapter, id: crypto.randomUUID() } : chapter));
      await insertWritingRow(db, restored, saved.folder, await nextPosition(db));
      await writeWriting(db, restored);
      if (deletedAt) await db.execute(`UPDATE projects SET deleted_at = $1 WHERE id = $2`, [deletedAt, restored.id]);
      else first ||= restored.id;
    }
    if (backup.folders.length > 0) {
      const row = await readShelfRow(db);
      const folders = [...new Set([...(row ? foldersOf(row.folders_json) : []), ...backup.folders])];
      await db.execute(`UPDATE shelf SET folders_json = $1 WHERE id = 1`, [JSON.stringify(folders)]);
    }
    await addMissingNotesAndTasks(db, backup.notes, backup.tasks);
    return first;
  });
}

export function listPersonalWords(): Promise<{ language: WritingLanguage; word: string }[]> {
  return enqueue(async () => {
    const rows = await (
      await database()
    ).select<{ language: string; word: string }[]>(
      `SELECT language, word FROM personal_words ORDER BY language, word`,
    );
    return rows
      .filter((row) => row.language === "en" || row.language === "sl")
      .map((row) => ({ language: row.language as WritingLanguage, word: row.word }));
  });
}

export function forgetPersonalWord(language: WritingLanguage, word: string): Promise<void> {
  return enqueue(async () => {
    await (
      await database()
    ).execute(`DELETE FROM personal_words WHERE language = $1 AND word = $2`, [language, word.trim()]);
  });
}

async function readSnapshotPayload(
  db: Database,
  snapshotId: string,
): Promise<{ writingId: string; payload: SnapshotPayload }> {
  const rows = await db.select<SnapshotRow[]>(
    `SELECT id, project_id, created_at, payload FROM snapshots WHERE id = $1`,
    [snapshotId],
  );
  const row = rows[0];
  if (!row?.payload) throw new Error(t("errSnapshotMissing"));
  let payload: SnapshotPayload;
  try {
    payload = JSON.parse(row.payload) as SnapshotPayload;
  } catch {
    throw new Error(t("errSnapshotUnreadable"));
  }
  if (!payload.chapters?.length) throw new Error(t("errSnapshotEmpty"));
  return { writingId: row.project_id, payload };
}

export function readSnapshotChapters(snapshotId: string): Promise<Chapter[]> {
  return enqueue(async () => {
    const { payload } = await readSnapshotPayload(await database(), snapshotId);
    return payload.chapters.map(normalizeChapter);
  });
}

export function restoreChapter(snapshotId: string, chapterId: string): Promise<Writing> {
  return enqueue(async () => {
    const db = await database();
    const { writingId, payload } = await readSnapshotPayload(db, snapshotId);
    const older = payload.chapters.find((chapter) => chapter.id === chapterId);
    if (!older) throw new Error(t("errChapterNotInSnapshot"));
    const current = await readWriting(db, writingId);
    if (!current) throw new Error(t("errSnapshotProjectMissing"));
    await insertSnapshot(db, current, "before-restore");
    const restored = withRestoredChapter(current, older);
    await writeWriting(db, restored);
    return restored;
  });
}

export function rememberPersonalWord(language: WritingLanguage, word: string): Promise<void> {
  const cleaned = word.trim();
  return enqueue(async () => {
    await (
      await database()
    ).execute(
      `INSERT INTO personal_words (language, word, created_at) VALUES ($1, $2, $3)
       ON CONFLICT(language, word) DO NOTHING`,
      [language, cleaned, new Date().toISOString()],
    );
  });
}

/**
 * Writes a sample project into the open file, which was just made for it or held it before: its
 * earlier writings go to Deleted (so anything she wrote in them can still be put back), its notes and
 * to-dos go, and the sample's writings, notes and to-dos come in. Returns the first writing's id.
 */
export function writeSampleProject(sample: {
  /** The sample's own file: anything else open is refused. */
  path: string;
  title: string;
  /** The writing a brand-new file started with, which simply goes; empty when the file held the sample before. */
  placeholder: string;
  writings: { writing: Writing; folder: string }[];
  notes: Note[];
  tasks: Task[];
}): Promise<string> {
  return enqueue(async () => {
    if (!openPath || openPath.toLowerCase() !== sample.path.toLowerCase()) throw new Error(t("errOtherProject"));
    const db = await database();
    const now = new Date().toISOString();
    if (sample.placeholder) {
      await db.execute(`DELETE FROM chapters WHERE project_id = $1`, [sample.placeholder]);
      await db.execute(`DELETE FROM snapshots WHERE project_id = $1`, [sample.placeholder]);
      await db.execute(`DELETE FROM projects WHERE id = $1`, [sample.placeholder]);
    }
    // An earlier version of a writing holds every note and to-do as they were, before they go.
    const live = await db.select<{ id: string }[]>(`SELECT id FROM projects WHERE deleted_at = '' ORDER BY position LIMIT 1`);
    const keeper = live[0] ? await readWriting(db, live[0].id) : null;
    if (keeper) await insertSnapshot(db, keeper, "manual");
    await db.execute(`UPDATE projects SET deleted_at = $1 WHERE deleted_at = ''`, [now]);
    await db.execute(`DELETE FROM note_chapters`);
    await db.execute(`DELETE FROM tasks`);
    await db.execute(`DELETE FROM notes`);
    await db.execute(`UPDATE shelf SET title = $1, folders_json = $2 WHERE id = 1`, [
      sample.title,
      JSON.stringify([...new Set(sample.writings.map((item) => item.folder).filter(Boolean))]),
    ]);
    for (const { writing, folder } of sample.writings) {
      await insertWritingRow(db, writing, folder, await nextPosition(db));
      await writeWriting(db, writing);
    }
    for (const note of sample.notes) await writeNoteWith(db, normalizeNote(note, openProjectId));
    for (const task of sample.tasks) await writeTaskWith(db, normalizeTask(task, openProjectId));
    return sample.writings[0]?.writing.id ?? "";
  });
}

/** The open project's id, the key its notes and to-dos are saved under; empty until its shelf is read. */
export function openProject(): string {
  return openProjectId;
}

export const sqliteStorage = {
  save(writing: Writing): Promise<void> {
    return enqueue(async () => {
      await writeWriting(await database(), writing);
    });
  },

  listSnapshots(writingId: string): Promise<SnapshotInfo[]> {
    return enqueue(async () => {
      const rows = await (
        await database()
      ).select<SnapshotRow[]>(
        `SELECT id, project_id, created_at, kind FROM snapshots
         WHERE project_id = $1
         ORDER BY created_at DESC`,
        [writingId],
      );
      return rows.map(
        (row): SnapshotInfo => ({
          id: row.id,
          writingId: row.project_id,
          createdAt: row.created_at,
          kind:
            row.kind === "daily" || row.kind === "manual" || row.kind === "before-restore"
              ? row.kind
              : "hourly",
        }),
      );
    });
  },

  /** Puts a writing back as it was in a snapshot, after keeping it as it is now. */
  restore(snapshotId: string): Promise<Writing> {
    return enqueue(async () => {
      const db = await database();
      const { writingId, payload } = await readSnapshotPayload(db, snapshotId);
      const current = await readWriting(db, writingId);
      if (!current) throw new Error(t("errSnapshotProjectMissing"));
      await insertSnapshot(db, current, "before-restore");
      await writeWriting(db, writingFromSnapshot(current, payload));
      await addMissingNotesAndTasks(db, payload.notes, payload.tasks);
      return (await readWriting(db, writingId)) ?? current;
    });
  },
};
