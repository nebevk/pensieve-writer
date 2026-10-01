import Database from "@tauri-apps/plugin-sql";
import {
  createProject,
  type Chapter,
  type DocumentJson,
  type Project,
  type SnapshotInfo,
} from "$lib/model";
import type { Storage } from "./types";

const DB_URL = "sqlite:pensieve.db";
const SCHEMA_VERSION = 1;
const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;
const SNAPSHOT_LIMIT = 48;

type ProjectRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChapterRow = {
  id: string;
  project_id: string;
  title: string;
  position: number;
  content_json: string;
  plain_text: string;
  updated_at: string;
};

type SnapshotRow = {
  id: string;
  project_id: string;
  created_at: string;
  payload?: string;
};

type SnapshotPayload = {
  title: string;
  chapters: Chapter[];
};

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
  const db = await Database.load(DB_URL);
  await db.select("PRAGMA journal_mode = WAL");
  await db.select("PRAGMA busy_timeout = 5000");
  const versions = await db.select<{ version: number }[]>(
    "SELECT version FROM schema_version WHERE id = 1",
  );
  const version = versions[0]?.version;
  if (version !== SCHEMA_VERSION) {
    throw new Error(
      version == null
        ? "The project file has no schema version"
        : `This project uses schema version ${version}, and this app only opens version ${SCHEMA_VERSION}`,
    );
  }
  return db;
}

export function shouldTakeSnapshot(latestCreatedAt: string | null, now: Date): boolean {
  if (!latestCreatedAt) return true;
  const latest = Date.parse(latestCreatedAt);
  if (Number.isNaN(latest)) return true;
  return now.getTime() - latest >= SNAPSHOT_INTERVAL_MS;
}

async function writeProject(db: Database, project: Project): Promise<void> {
  const updatedAt = new Date().toISOString();
  await db.execute(
    `INSERT INTO projects (id, title, created_at, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       updated_at = excluded.updated_at`,
    [project.id, project.title, project.createdAt, updatedAt],
  );

  if (project.chapters.length === 0) {
    throw new Error("A project needs at least one chapter");
  }

  for (const chapter of project.chapters) {
    await db.execute(
      `INSERT INTO chapters (
         id, project_id, title, position, content_json, plain_text, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         position = excluded.position,
         content_json = excluded.content_json,
         plain_text = excluded.plain_text,
         updated_at = excluded.updated_at`,
      [
        chapter.id,
        project.id,
        chapter.title,
        chapter.position,
        JSON.stringify(chapter.contentJson),
        chapter.plainText,
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
  const latest = await db.select<{ created_at: string }[]>(
    `SELECT created_at FROM snapshots
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [project.id],
  );
  if (!shouldTakeSnapshot(latest[0]?.created_at ?? null, new Date())) return;
  await insertSnapshot(db, project);
}

async function insertSnapshot(db: Database, project: Project): Promise<void> {
  const payload: SnapshotPayload = {
    title: project.title,
    chapters: project.chapters,
  };
  await db.execute(
    `INSERT INTO snapshots (id, project_id, created_at, payload)
     VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), project.id, new Date().toISOString(), JSON.stringify(payload)],
  );
  await db.execute(
    `DELETE FROM snapshots
     WHERE project_id = $1
       AND id NOT IN (
         SELECT id FROM snapshots
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
    [project.id, SNAPSHOT_LIMIT],
  );
}

async function readProject(db: Database, projectId?: string): Promise<Project | null> {
  const projects = projectId
    ? await db.select<ProjectRow[]>(
        `SELECT id, title, created_at, updated_at FROM projects WHERE id = $1`,
        [projectId],
      )
    : await db.select<ProjectRow[]>(
        `SELECT id, title, created_at, updated_at FROM projects ORDER BY created_at LIMIT 1`,
      );
  const row = projects[0];
  if (!row) return null;

  const chapters = await db.select<ChapterRow[]>(
    `SELECT id, project_id, title, position, content_json, plain_text, updated_at
     FROM chapters
     WHERE project_id = $1
     ORDER BY position ASC, title ASC`,
    [row.id],
  );

  return {
    id: row.id,
    title: row.title,
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
    updatedAt: row.updated_at,
  };
}

export function keepSnapshot(project: Project): Promise<void> {
  return enqueue(async () => {
    await insertSnapshot(await database(), project);
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
        `SELECT id, project_id, created_at FROM snapshots
         WHERE project_id = $1
         ORDER BY created_at DESC`,
        [projectId],
      );
      return rows.map(
        (row): SnapshotInfo => ({
          id: row.id,
          projectId: row.project_id,
          createdAt: row.created_at,
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
        updatedAt: new Date().toISOString(),
        chapters: payload.chapters,
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
