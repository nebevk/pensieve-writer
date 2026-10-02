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
import type { Storage } from "./types";

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
  updated_at: string;
};

type SnapshotRow = {
  id: string;
  project_id: string;
  created_at: string;
  kind?: string;
  payload?: string;
};

type SnapshotPayload = {
  title: string;
  language?: WritingLanguage;
  chapters: Chapter[];
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
    throw new Error("Open the Pensieve window to save. This page cannot write the project file.");
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
        ? "The project file has no schema version"
        : `This project uses schema version ${version}, and this app only opens version ${SCHEMA_VERSION}`,
    );
  }
  return db;
}

async function columnExists(db: Database, table: string, column: string): Promise<boolean> {
  const rows = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function ensureSchema(db: Database): Promise<void> {
  if (!(await columnExists(db, "projects", "language"))) {
    await db.execute("ALTER TABLE projects ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
  }
  if (!(await columnExists(db, "chapters", "language"))) {
    await db.execute("ALTER TABLE chapters ADD COLUMN language TEXT NOT NULL DEFAULT ''");
  }
  if (!(await columnExists(db, "snapshots", "kind"))) {
    await db.execute("ALTER TABLE snapshots ADD COLUMN kind TEXT NOT NULL DEFAULT 'hourly'");
  }
  if (!(await columnExists(db, "notes", "fields_json"))) {
    await db.execute("ALTER TABLE notes ADD COLUMN fields_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!(await columnExists(db, "tasks", "chapter_id"))) {
    await db.execute("ALTER TABLE tasks ADD COLUMN chapter_id TEXT NOT NULL DEFAULT ''");
  }
  if (!(await columnExists(db, "tasks", "note_id"))) {
    await db.execute("ALTER TABLE tasks ADD COLUMN note_id TEXT NOT NULL DEFAULT ''");
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
    `INSERT INTO projects (id, title, language, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       language = excluded.language,
       updated_at = excluded.updated_at`,
    [project.id, project.title, project.language === "sl" ? "sl" : "en", project.createdAt, updatedAt],
  );

  if (project.chapters.length === 0) {
    throw new Error("A project needs at least one chapter");
  }

  for (const chapter of project.chapters) {
    await db.execute(
      `INSERT INTO chapters (
         id, project_id, title, position, content_json, plain_text, synopsis, status, language, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         position = excluded.position,
         content_json = excluded.content_json,
         plain_text = excluded.plain_text,
         synopsis = excluded.synopsis,
         status = excluded.status,
         language = excluded.language,
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
  const payload: SnapshotPayload = {
    title: project.title,
    language: project.language,
    chapters: project.chapters,
  };
  await db.execute(
    `INSERT INTO snapshots (id, project_id, created_at, kind, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [crypto.randomUUID(), project.id, new Date().toISOString(), kind, JSON.stringify(payload)],
  );
  const limit = kind === "daily" ? DAILY_LIMIT : kind === "manual" ? MANUAL_LIMIT : HOURLY_LIMIT;
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
        `SELECT id, title, language, created_at, updated_at FROM projects WHERE id = $1`,
        [projectId],
      )
    : await db.select<ProjectRow[]>(
        `SELECT id, title, language, created_at, updated_at FROM projects ORDER BY created_at LIMIT 1`,
      );
  const row = projects[0];
  if (!row) return null;

  const chapters = await db.select<ChapterRow[]>(
    `SELECT id, project_id, title, position, content_json, plain_text, synopsis, status, language, updated_at
     FROM chapters
     WHERE project_id = $1
     ORDER BY position ASC, title ASC`,
    [row.id],
  );

  return {
    id: row.id,
    title: row.title,
    language: row.language === "sl" ? "sl" : "en",
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
      throw new Error("Chapter content is not a document");
    }
    contentJson = parsed;
  } catch (error) {
    throw new Error(
      `Could not read “${row.title}”: ${error instanceof Error ? error.message : "invalid content"}`,
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

export async function checkpointDatabase(): Promise<void> {
  const db = await database();
  await db.select("PRAGMA wal_checkpoint(TRUNCATE)");
}

export async function switchProjectFile(absolutePath: string): Promise<void> {
  const previous = connectionUrl();
  const db = await database();
  const prefs = loadPrefs();
  savePrefs({ ...prefs, projectPath: absolutePath });
  try {
    await db.close(previous);
  } catch {
    // The previous pool may already be closed.
  }
  databasePromise = null;
  await database();
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
      const project = existing ?? createProject();
      if (existing && existing.chapters.length === 0) {
        const now = new Date().toISOString();
        project.chapters = [
          {
            id: crypto.randomUUID(),
            projectId: project.id,
            title: "Chapter 1",
            position: 0,
            contentJson: { type: "doc", content: [{ type: "paragraph" }] },
            plainText: "",
            synopsis: "",
            status: "draft",
            language: "",
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
          kind: row.kind === "daily" || row.kind === "manual" ? row.kind : "hourly",
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
      if (!row?.payload) throw new Error("That snapshot could not be found");

      let payload: SnapshotPayload;
      try {
        payload = JSON.parse(row.payload) as SnapshotPayload;
      } catch {
        throw new Error("That snapshot is unreadable");
      }
      if (!payload.chapters?.length) throw new Error("That snapshot has no chapters");

      const current = await readProject(db, row.project_id);
      if (!current) throw new Error("The project for that snapshot is missing");

      const restored: Project = {
        ...current,
        title: payload.title || current.title,
        language: payload.language === "sl" ? "sl" : current.language,
        updatedAt: new Date().toISOString(),
        chapters: payload.chapters.map((chapter) => ({
          ...chapter,
          synopsis: chapter.synopsis ?? "",
          status:
            chapter.status === "revised" || chapter.status === "final" ? chapter.status : "draft",
          language: chapter.language === "en" || chapter.language === "sl" ? chapter.language : "",
        })),
      };
      await writeProject(db, restored);

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
