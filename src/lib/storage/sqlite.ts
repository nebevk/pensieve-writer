import Database from "@tauri-apps/plugin-sql";
import {
  createProject,
  type Chapter,
  type DocumentJson,
  type Project,
  type SnapshotInfo,
  type WritingLanguage,
} from "$lib/model";
import { loadPrefs, savePrefs } from "$lib/prefs";
import { chapterTitle, firstChapters } from "$lib/chapters/welcome";
import { translate } from "$lib/i18n";
import { t } from "$lib/ui.svelte";
import type { Storage } from "./types";
import type { Note, Task } from "./organize";
import { readNotesWith, readTasksWith, writeNoteWith, writeTaskWith } from "./noteRows";
import {
  missingItems,
  normalizeChapter,
  normalizeNote,
  normalizeTask,
  projectFromBackup,
  projectFromSnapshot,
  snapshotPayload,
  withRestoredChapter,
  type SnapshotPayload,
} from "./restore";

const DEFAULT_DB_URL = "sqlite:pensieve.db";
const SCHEMA_VERSION = 3;
const HOURLY_LIMIT = 48;
const DAILY_LIMIT = 30;
const MANUAL_LIMIT = 20;

type ProjectRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  language?: string;
  kind?: string;
  word_goal?: number;
};

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

type SnapshotKind = SnapshotInfo["kind"];

function connectionUrl(): string {
  const path = loadPrefs().projectPath.trim();
  return path ? `sqlite:${path}` : DEFAULT_DB_URL;
}

let databasePromise: Promise<Database> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

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
  await db.select("PRAGMA journal_mode = WAL");
  await db.select("PRAGMA busy_timeout = 5000");
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
  await db.execute("UPDATE schema_version SET version = 3 WHERE id = 1 AND version < 3");
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

async function writeProject(db: Database, project: Project): Promise<void> {
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
      project.id,
      project.title,
      project.language === "sl" ? "sl" : "en",
      project.kind === "stories" || project.kind === "article" ? project.kind : "novel",
      Number.isFinite(project.wordGoal) ? project.wordGoal : 0,
      project.createdAt,
      updatedAt,
    ],
  );

  if (project.chapters.length === 0) {
    throw new Error(t("errNeedsChapter"));
  }

  for (const chapter of project.chapters) {
    await db.execute(
      `INSERT INTO chapters (
         id, project_id, title, position, content_json, plain_text, synopsis, status, language, word_goal, part, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
         updated_at = excluded.updated_at`,
      [
        chapter.id,
        project.id,
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
      ],
    );
  }

  const ids = project.chapters.map((chapter) => chapter.id);
  const placeholders = ids.map((_, index) => `$${index + 2}`).join(", ");
  await db.execute(
    `DELETE FROM chapters WHERE project_id = $1 AND id NOT IN (${placeholders})`,
    [project.id, ...ids],
  );

  await maybeSnapshot(db, project);
}

async function maybeSnapshot(db: Database, project: Project): Promise<void> {
  const now = new Date();
  const hourly = await db.select<{ created_at: string }[]>(
    `SELECT created_at FROM snapshots
     WHERE project_id = $1 AND kind = 'hourly'
     ORDER BY created_at DESC LIMIT 1`,
    [project.id],
  );
  if (shouldTakeSnapshot(hourly[0]?.created_at ?? null, now)) {
    await insertSnapshot(db, project, "hourly");
  }

  const daily = await db.select<{ created_at: string }[]>(
    `SELECT created_at FROM snapshots
     WHERE project_id = $1 AND kind = 'daily'
     ORDER BY created_at DESC LIMIT 1`,
    [project.id],
  );
  const latestDay = daily[0]?.created_at ? localDay(daily[0].created_at) : "";
  if (latestDay !== localDay(now.toISOString())) {
    await insertSnapshot(db, project, "daily");
  }
}

async function insertSnapshot(db: Database, project: Project, kind: SnapshotKind): Promise<void> {
  const notes = await readNotesWith(db, project.id);
  const tasks = await readTasksWith(db, project.id);
  const payload = snapshotPayload(project, notes, tasks);
  await db.execute(
    `INSERT INTO snapshots (id, project_id, created_at, kind, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [crypto.randomUUID(), project.id, new Date().toISOString(), kind, JSON.stringify(payload)],
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
    [project.id, kind, limit],
  );
}

async function readProject(db: Database, projectId?: string): Promise<Project | null> {
  const projects = projectId
    ? await db.select<ProjectRow[]>(
        `SELECT id, title, language, kind, word_goal, created_at, updated_at FROM projects WHERE id = $1`,
        [projectId],
      )
    : await db.select<ProjectRow[]>(
        `SELECT id, title, language, kind, word_goal, created_at, updated_at FROM projects ORDER BY created_at LIMIT 1`,
      );
  const row = projects[0];
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
    language: row.language === "sl" ? "sl" : "en",
    kind: row.kind === "stories" || row.kind === "article" ? row.kind : "novel",
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
    projectId: row.project_id,
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

export function withDb<T>(work: (db: Database) => Promise<T>): Promise<T> {
  return enqueue(async () => work(await database()));
}

export function keepSnapshot(project: Project): Promise<void> {
  return enqueue(async () => {
    await insertSnapshot(await database(), project, "manual");
  });
}

/** Keeps a snapshot of the book as it is saved right now, for callers that don't hold the project. */
export function snapshotSavedProject(projectId: string): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    const project = await readProject(db, projectId);
    if (!project) throw new Error(t("errNoteBookMissing"));
    await insertSnapshot(db, project, "manual");
  });
}

/** Runs after every write already queued, so nothing lands in the file mid-checkpoint. */
export function checkpointDatabase(): Promise<void> {
  return enqueue(async () => {
    const db = await database();
    await db.select("PRAGMA wal_checkpoint(TRUNCATE)");
  });
}

/** Runs after every write already queued, so a pending save can't land in the next book's file. */
export function switchProjectFile(absolutePath: string): Promise<void> {
  return enqueue(async () => {
    const previous = connectionUrl();
    savePrefs({ ...loadPrefs(), projectPath: absolutePath });
    try {
      await (await database()).close(previous);
    } catch {
      // The previous file may have failed to open, or its pool is already closed.
    }
    databasePromise = null;
    await database();
  });
}

/** Adds the snapshot's or backup's notes and to-dos that the book no longer has. Existing ones stay as they are. */
async function addMissingNotesAndTasks(
  db: Database,
  projectId: string,
  notes: Note[] | undefined,
  tasks: Task[] | undefined,
): Promise<void> {
  const noteIds = await db.select<{ id: string }[]>(`SELECT id FROM notes WHERE project_id = $1`, [projectId]);
  for (const note of missingItems(notes, noteIds.map((row) => row.id))) {
    await writeNoteWith(db, normalizeNote(note, projectId));
  }
  const taskIds = await db.select<{ id: string }[]>(`SELECT id FROM tasks WHERE project_id = $1`, [projectId]);
  for (const task of missingItems(tasks, taskIds.map((row) => row.id))) {
    await writeTaskWith(db, normalizeTask(task, projectId));
  }
}

/** Replaces the open book's chapters with a Drive backup's, after keeping a "Before restore" snapshot. */
export function restoreFromBackup(backup: {
  project: Pick<Project, "title" | "chapters"> & Partial<Pick<Project, "language" | "kind">>;
  notes: Note[];
  tasks: Task[];
}): Promise<Project> {
  return enqueue(async () => {
    const db = await database();
    const current = await readProject(db);
    if (!current) throw new Error(t("errOpenBookFirst"));
    await insertSnapshot(db, current, "before-restore");
    const restored = projectFromBackup(current, backup.project);
    await writeProject(db, restored);
    await addMissingNotesAndTasks(db, restored.id, backup.notes, backup.tasks);
    return restored;
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
): Promise<{ projectId: string; payload: SnapshotPayload }> {
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
  return { projectId: row.project_id, payload };
}

export function readSnapshotChapters(snapshotId: string): Promise<Chapter[]> {
  return enqueue(async () => {
    const { payload } = await readSnapshotPayload(await database(), snapshotId);
    return payload.chapters.map(normalizeChapter);
  });
}

export function restoreChapter(snapshotId: string, chapterId: string): Promise<Project> {
  return enqueue(async () => {
    const db = await database();
    const { projectId, payload } = await readSnapshotPayload(db, snapshotId);
    const older = payload.chapters.find((chapter) => chapter.id === chapterId);
    if (!older) throw new Error(t("errChapterNotInSnapshot"));
    const current = await readProject(db, projectId);
    if (!current) throw new Error(t("errSnapshotProjectMissing"));
    await insertSnapshot(db, current, "before-restore");
    const restored = withRestoredChapter(current, older);
    await writeProject(db, restored);
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
 * A brand-new book file, including the one made on first launch, opens on the welcome page.
 * It starts in the interface language: someone using Pensieve in Slovenian likely writes in it too.
 */
function newBook(): Project {
  const language = loadPrefs().uiLanguage;
  const project = createProject();
  return {
    ...project,
    title: translate(language, "untitled"),
    language,
    chapters: firstChapters(project.id, project.kind, project.title, language),
  };
}

export const sqliteStorage: Storage = {
  save(project) {
    return enqueue(async () => {
      await writeProject(await database(), project);
    });
  },

  load() {
    return enqueue(async () => {
      const db = await database();
      const existing = await readProject(db);
      if (existing && existing.chapters.length > 0) return existing;
      const project = existing ?? newBook();
      if (existing && existing.chapters.length === 0) {
        const now = new Date().toISOString();
        project.chapters = [
          {
            id: crypto.randomUUID(),
            projectId: project.id,
            title: chapterTitle(project.kind, project.language, 1),
            position: 0,
            contentJson: { type: "doc", content: [{ type: "paragraph" }] },
            plainText: "",
            synopsis: "",
            status: "draft",
            language: "",
            wordGoal: 0,
            part: "",
            updatedAt: now,
          },
        ];
      }
      await writeProject(db, project);
      return project;
    });
  },

  listSnapshots(projectId) {
    return enqueue(async () => {
      const rows = await (
        await database()
      ).select<SnapshotRow[]>(
        `SELECT id, project_id, created_at, kind FROM snapshots
         WHERE project_id = $1
         ORDER BY created_at DESC`,
        [projectId],
      );
      return rows.map(
        (row): SnapshotInfo => ({
          id: row.id,
          projectId: row.project_id,
          createdAt: row.created_at,
          kind:
            row.kind === "daily" || row.kind === "manual" || row.kind === "before-restore"
              ? row.kind
              : "hourly",
        }),
      );
    });
  },

  restore(snapshotId) {
    return enqueue(async () => {
      const db = await database();
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

      const current = await readProject(db, row.project_id);
      if (!current) throw new Error(t("errSnapshotProjectMissing"));

      await insertSnapshot(db, current, "before-restore");
      const restored = projectFromSnapshot(current, payload);
      await writeProject(db, restored);
      await addMissingNotesAndTasks(db, restored.id, payload.notes, payload.tasks);

      const keep = restored.chapters.map((chapter) => chapter.id);
      const placeholders = keep.map((_, index) => `$${index + 2}`).join(", ");
      await db.execute(
        `DELETE FROM chapters
         WHERE project_id = $1
           AND id NOT IN (${placeholders})`,
        [restored.id, ...keep],
      );
      return restored;
    });
  },
};
