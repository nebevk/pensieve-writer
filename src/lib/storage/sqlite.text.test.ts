/*
 * Where her text is kept (ARCH-14): sqlite.ts against a real SQLite, sql.js, standing in for the SQL plugin
 * (sqlStandIn.ts). Each test makes a project file of its own.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chapter, Writing } from "$lib/model";
import { translate } from "$lib/i18n";
import type { BackupContent } from "./backupFile";
import type { Note } from "./organize";
import { writeNoteWith } from "./noteRows";
import { standIn } from "./sqlStandIn";
import {
  addWriting,
  copyOpenProject,
  keepSnapshot,
  loadWriting,
  moveProjectFile,
  openProject,
  openShelf,
  readSnapshotChapters,
  restoreFromBackup,
  sqliteStorage,
  switchProjectFile,
  withDb,
  withProjectDb,
} from "./sqlite";

vi.mock("@tauri-apps/plugin-sql", async () => ({ default: (await import("./sqlStandIn")).standIn.plugin }));
vi.mock("@tauri-apps/api/core", async () => {
  const { standIn } = await import("./sqlStandIn");
  return { invoke: (command: string, args: Record<string, unknown> = {}) => standIn.invoke(command, args) };
});

const stored = new Map<string, string>();
vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
vi.stubGlobal("localStorage", {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => void stored.set(key, value),
  removeItem: (key: string) => void stored.delete(key),
});

afterEach(() => {
  standIn.failAt(null);
  vi.useRealTimers();
});

const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const PICTURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let made = 0;

/** A new project, opened as Pensieve opens one: its file is made, with its first writing. */
async function openNew(title: string) {
  made += 1;
  const path = `${LIBRARY}\\${title} ${made}\\pensieve.db`;
  await switchProjectFile(path);
  return { path, ...(await openShelf("", { title, writingTitle: title, welcome: false })) };
}

function chapter(writing: Writing, id: string, title: string, text: string, position: number, picture = false): Chapter {
  const paragraph = { type: "paragraph", content: [{ type: "text", text }] };
  return {
    id,
    writingId: writing.id,
    title,
    position,
    contentJson: { type: "doc", content: picture ? [paragraph, { type: "image", attrs: { src: PICTURE } }] : [paragraph] },
    plainText: text,
    synopsis: "",
    status: "draft",
    language: "",
    wordGoal: 0,
    part: "",
    updatedAt: new Date().toISOString(),
  };
}

const withChapters = (writing: Writing, chapters: Chapter[]): Writing => ({ ...writing, chapters });
/** One page holding `text`, in the writing's first chapter. */
const withText = (writing: Writing, text: string): Writing =>
  withChapters(writing, [chapter(writing, writing.chapters[0].id, writing.chapters[0].title, text, 0)]);

/** What the file itself holds, chapter by chapter, read past sqlite.ts. */
const textIn = (path: string, writingId?: string) =>
  standIn
    .rows(path, `SELECT plain_text FROM chapters ${writingId ? `WHERE project_id = '${writingId}'` : ""} ORDER BY position`)
    .map(([text]) => text);

function note(id: string, text: string, updatedAt: string): Note {
  return {
    id,
    projectId: openProject(),
    title: id,
    contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
    plainText: text,
    category: "characters",
    tags: "",
    aliases: "",
    fields: [],
    todoState: null,
    chapterIds: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

const kinds = async (writingId: string) => {
  const counts: Record<string, number> = {};
  for (const snapshot of await sqliteStorage.listSnapshots(writingId)) counts[snapshot.kind] = (counts[snapshot.kind] ?? 0) + 1;
  return counts;
};

describe("her text, saved and read back", () => {
  it("comes back as she wrote it, č, š and ž included, and each picture is kept once", async () => {
    const { path, writing } = await openNew("Zgodbe ob reki");
    const saved = withChapters(writing, [
      chapter(writing, "pog-1", "Čez reko", "Čez šumeče žito je priletel čmrlj.", 0, true),
      chapter(writing, "pog-2", "Žabe in štorklje", "Še enkrat ista slika, ista žaba.", 1, true),
    ]);
    await sqliteStorage.save(saved);

    // The file holds the picture once, by its id, and the words as they are.
    expect(standIn.rows(path, "SELECT COUNT(*) FROM pictures")).toEqual([[1]]);
    expect(standIn.rows(path, "SELECT content_json FROM chapters").every(([json]) => !String(json).includes("data:image"))).toBe(true);
    expect(textIn(path)).toEqual(["Čez šumeče žito je priletel čmrlj.", "Še enkrat ista slika, ista žaba."]);

    // Opened again, from the file: every word and the picture.
    await switchProjectFile(`${LIBRARY}\\Drugje\\pensieve.db`);
    await switchProjectFile(path);
    const read = await loadWriting(writing.id);
    expect(read.chapters.map((item) => [item.id, item.title, item.plainText])).toEqual([
      ["pog-1", "Čez reko", "Čez šumeče žito je priletel čmrlj."],
      ["pog-2", "Žabe in štorklje", "Še enkrat ista slika, ista žaba."],
    ]);
    expect(read.chapters.map((item) => item.contentJson)).toEqual(saved.chapters.map((item) => item.contentJson));
  });

  it("a save never touches another writing's chapters", async () => {
    const { path, writing: first } = await openNew("Dve besedili");
    const second = await addWriting({ title: "Pisma", folder: "", split: true, language: "sl" });
    await sqliteStorage.save(withChapters(first, [chapter(first, "a-1", "Ena", "Prvo besedilo.", 0), chapter(first, "a-2", "Dve", "Še malo prvega.", 1)]));
    await sqliteStorage.save(withText(second, "Drago pismo, čakam odgovor."));

    // A page that still held the other writing's chapter (a switch half done): nothing is saved.
    const stale = withChapters(first, [chapter(first, second.chapters[0].id, "Tuje", "Prepisano.", 0)]);
    await expect(sqliteStorage.save(stale)).rejects.toThrow(translate("en", "errChapterInOtherWriting"));
    expect(textIn(path, second.id)).toEqual(["Drago pismo, čakam odgovor."]);
    expect(textIn(path, first.id)).toEqual(["Prvo besedilo.", "Še malo prvega."]);

    // A chapter taken out goes from its own writing only.
    await sqliteStorage.save(withChapters(first, [chapter(first, "a-1", "Ena", "Prvo besedilo.", 0)]));
    expect(textIn(path, first.id)).toEqual(["Prvo besedilo."]);
    expect(textIn(path, second.id)).toEqual(["Drago pismo, čakam odgovor."]);
  });

  it("a save cut short as she splits a chapter leaves the text in both chapters, never in neither", async () => {
    const { path, writing } = await openNew("Deljeno poglavje");
    await sqliteStorage.save(withChapters(writing, [chapter(writing, "cel", "Celo", "Prvi del. Drugi del o šoli.", 0)]));

    // A heading typed in the middle: the new chapter takes the second half. The disk fills between the writes.
    const split = withChapters(writing, [chapter(writing, "cel", "Celo", "Prvi del.", 0), chapter(writing, "nov", "Novo", "Drugi del o šoli.", 1)]);
    standIn.failAt("INSERT INTO chapters", 1);
    await expect(sqliteStorage.save(split)).rejects.toThrow("disk is full");
    expect(textIn(path)).toEqual(["Prvi del. Drugi del o šoli.", "Drugi del o šoli."]);

    // The next save puts it right.
    await sqliteStorage.save(split);
    expect(textIn(path)).toEqual(["Prvi del.", "Drugi del o šoli."]);
  });
});

describe("earlier versions", () => {
  it("are taken hourly and daily, and the oldest go past 48 hourly, 30 daily and 20 kept by hand", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date(2026, 0, 5, 8, 0).getTime();
    const hour = 60 * 60 * 1000;
    vi.setSystemTime(start);
    const { writing } = await openNew("Dnevnik");
    expect(await kinds(writing.id)).toEqual({ hourly: 1, daily: 1 });

    // Saves within the hour take none.
    vi.setSystemTime(start + 20 * 60 * 1000);
    await sqliteStorage.save(withText(writing, "Še isto uro."));
    expect(await kinds(writing.id)).toEqual({ hourly: 1, daily: 1 });

    for (let hours = 1; hours <= 50; hours += 1) {
      vi.setSystemTime(start + hours * hour);
      await sqliteStorage.save(withText(writing, `Ura ${hours}: čšž.`));
    }
    const hourly = (await sqliteStorage.listSnapshots(writing.id)).filter((snapshot) => snapshot.kind === "hourly");
    expect(hourly).toHaveLength(48);
    // The newest are kept: the last holds the last save's words.
    expect((await readSnapshotChapters(hourly[0].id))[0].plainText).toBe("Ura 50: čšž.");
    expect(hourly.at(-1)?.createdAt).toBe(new Date(start + 3 * hour).toISOString());

    for (let days = 3; days <= 40; days += 1) {
      vi.setSystemTime(start + days * 24 * hour);
      await sqliteStorage.save(withText(writing, `Dan ${days}.`));
    }
    const daily = (await sqliteStorage.listSnapshots(writing.id)).filter((snapshot) => snapshot.kind === "daily");
    expect(daily).toHaveLength(30);
    expect((await readSnapshotChapters(daily[0].id))[0].plainText).toBe("Dan 40.");

    for (let kept = 1; kept <= 22; kept += 1) {
      vi.setSystemTime(start + 41 * 24 * hour + kept * 1000);
      await keepSnapshot(withText(writing, `Shranjeno ${kept}.`));
    }
    expect(await kinds(writing.id)).toEqual({ hourly: 48, daily: 30, manual: 20 });
  });

  it("restoring one keeps the text as it is first, and brings back notes the project no longer has", async () => {
    const { path, writing } = await openNew("Vrnitev");
    await withProjectDb(openProject(), (db) => writeNoteWith(db, note("Špela", "Glavna junakinja.", "2026-10-01T10:00:00.000Z")));
    await keepSnapshot(withText(writing, "Prva različica: čšž."));
    const [kept] = await sqliteStorage.listSnapshots(writing.id).then((list) => list.filter((item) => item.kind === "manual"));

    await withDb((db) => db.execute("DELETE FROM notes"));
    await sqliteStorage.save(withText(writing, "Druga različica."));
    const restored = await sqliteStorage.restore(kept.id);

    expect(restored.chapters.map((item) => item.plainText)).toEqual(["Prva različica: čšž."]);
    expect(textIn(path)).toEqual(["Prva različica: čšž."]);
    const before = (await sqliteStorage.listSnapshots(writing.id)).find((item) => item.kind === "before-restore");
    expect(before && (await readSnapshotChapters(before.id))[0].plainText).toBe("Druga različica.");
    expect(standIn.rows(path, "SELECT plain_text FROM notes")).toEqual([["Glavna junakinja."]]);
  });

  it("a backup puts its writings back after keeping them as they were, and a rescue copy's newer notes win", async () => {
    const { path, shelf, writing } = await openNew("Iz varnostne kopije");
    await sqliteStorage.save(withText(writing, "Kar je zdaj."));
    await withProjectDb(openProject(), (db) => writeNoteWith(db, note("Miha", "Stari opis.", "2026-10-16T10:00:00.000Z")));
    const page = { ...withText(writing, "Kar je bilo v kopiji."), folder: "", position: 0 };
    // A writing the project no longer has, whose chapter id the open writing's chapter has taken since.
    const lost = { ...withText({ ...writing, id: "izgubljeno" }, "Besedilo, ki ga projekt nima več."), title: "Izgubljeno", folder: "Osnutki", position: 1 };
    const backup = (rescue: boolean, writings: BackupContent["writings"]): BackupContent => ({
      format: 2,
      savedAt: "2026-10-16T12:00:00.000Z",
      projectId: shelf.projectId,
      title: shelf.title,
      folders: rescue ? [] : ["Osnutki"],
      writings,
      notes: [note("Miha", "Novejši opis.", "2026-10-16T11:00:00.000Z")],
      tasks: [],
      rescue,
    });

    expect(await restoreFromBackup(backup(false, [page, lost]))).toBe(writing.id);
    expect(textIn(path, writing.id)).toEqual(["Kar je bilo v kopiji."]);
    const before = (await sqliteStorage.listSnapshots(writing.id)).find((item) => item.kind === "before-restore");
    expect(before && (await readSnapshotChapters(before.id))[0].plainText).toBe("Kar je zdaj.");
    // The writing the project no longer had comes back as one of its own, its chapter under a new id.
    expect(textIn(path, "izgubljeno")).toEqual(["Besedilo, ki ga projekt nima več."]);
    expect(standIn.rows(path, "SELECT folders_json FROM shelf")).toEqual([['["Osnutki"]']]);
    // A backup's notes never write over hers…
    expect(standIn.rows(path, "SELECT plain_text FROM notes")).toEqual([["Stari opis."]]);
    // …but a rescue copy's (the open writing, with the notes and to-dos waiting) are the words that couldn't be saved.
    await restoreFromBackup(backup(true, [page]));
    expect(standIn.rows(path, "SELECT plain_text FROM notes")).toEqual([["Novejši opis."]]);
  });
});

describe("switching and moving projects", () => {
  it("a save asked for before a switch lands in the project it was written in", async () => {
    const first = await openNew("Prvi");
    const projectId = openProject();
    const second = `${LIBRARY}\\Drugi\\pensieve.db`;
    const saving = sqliteStorage.save(withText(first.writing, "Zadnje besede v prvem: čšž."));
    const switching = switchProjectFile(second);
    await Promise.all([saving, switching]);
    expect(textIn(first.path)).toEqual(["Zadnje besede v prvem: čšž."]);
    expect(textIn(second)).toEqual([]);

    // A note still waiting from the project she left is refused, never written into this one.
    await openShelf("", { title: "Drugi", writingTitle: "Drugi", welcome: false });
    await expect(withProjectDb(projectId, (db) => writeNoteWith(db, note("Ana", "Iz prvega.", "2026-10-16T10:00:00.000Z")))).rejects.toThrow(
      translate("en", "errOtherProject"),
    );
    expect(standIn.rows(second, "SELECT COUNT(*) FROM notes")).toEqual([[0]]);
  });

  it("a move that fails, or a moved file that won't open, leaves her saving where she was", async () => {
    const { path, writing } = await openNew("Selitev");
    const moved = `${LIBRARY}\\Preimenovana\\pensieve.db`;
    const rename = (from: string, to: string) => {
      const file = standIn.files.get(from);
      if (!file) throw new Error(`no file ${from}`);
      standIn.files.set(to, file);
      standIn.files.delete(from);
    };
    const move = async () => {
      rename(path, moved);
      return moved;
    };
    const back = async () => rename(moved, path);

    // Windows refuses the rename.
    await expect(moveProjectFile(() => Promise.reject(new Error("Access is denied.")), back)).rejects.toThrow("Access is denied.");
    await sqliteStorage.save(withText(writing, "Ostala sem tu."));
    expect(textIn(path)).toEqual(["Ostala sem tu."]);

    // Renamed, but it won't open there: moved back, and it opens where it was.
    standIn.failAt(`load ${moved}`);
    await expect(moveProjectFile(move, back)).rejects.toThrow("unable to open");
    expect(standIn.files.has(moved)).toBe(false);
    await sqliteStorage.save(withText(writing, "Še vedno tu: čšž."));
    expect(textIn(path)).toEqual(["Še vedno tu: čšž."]);

    // It moves: a save asked for meanwhile lands in the file where it went, which it says, for the page to
    // remember; storage itself writes nothing to the settings (ARCH-12).
    const moving = moveProjectFile(move, back);
    const saving = sqliteStorage.save(withText(writing, "Na novem mestu."));
    expect(await moving).toBe(moved);
    await saving;
    expect(textIn(moved)).toEqual(["Na novem mestu."]);
    expect(stored.has("pensieve-prefs")).toBe(false);
  });

  it("a copy into the library takes the words typed a moment before, and one that fails leaves her saving", async () => {
    const { path, writing } = await openNew("Zunaj knjižnice");
    const folder = `${LIBRARY}\\Zunaj knjižnice`;

    // The disk fills as SQLite writes the copy.
    standIn.failAt("VACUUM INTO");
    await expect(copyOpenProject(folder)).rejects.toThrow("disk is full");
    expect(standIn.files.has(`${folder}\\pensieve.db`)).toBe(false);
    await sqliteStorage.save(withText(writing, "Shranjeno kljub vsemu."));
    expect(textIn(path)).toEqual(["Shranjeno kljub vsemu."]);

    const saving = sqliteStorage.save(withText(writing, "Besede tik pred selitvijo: čšž."));
    const copying = copyOpenProject(folder);
    await saving;
    expect(await copying).toBe(`${folder}\\pensieve.db`);
    expect(textIn(`${folder}\\pensieve.db`)).toEqual(["Besede tik pred selitvijo: čšž."]);
    expect(standIn.files.has(`${folder}\\pensieve.db.writing`)).toBe(false);
  });
});

describe("a file from an older Pensieve", () => {
  const doc = (text: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  /** A file as version 3 left it: one book, no shelf, no pictures table, no words counted. */
  const VERSION_3 = [
    "CREATE TABLE schema_version (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL)",
    "INSERT INTO schema_version (id, version) VALUES (1, 3)",
    `CREATE TABLE projects (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'novel', word_goal INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE chapters (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, title TEXT NOT NULL, position INTEGER NOT NULL,
      content_json TEXT NOT NULL, plain_text TEXT NOT NULL, synopsis TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
      language TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, word_goal INTEGER NOT NULL DEFAULT 0, part TEXT NOT NULL DEFAULT '')`,
    "CREATE TABLE snapshots (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, created_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'hourly', payload TEXT NOT NULL)",
    `CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, title TEXT NOT NULL, content_json TEXT NOT NULL,
      plain_text TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'ideas', tags TEXT NOT NULL DEFAULT '', todo_state TEXT,
      fields_json TEXT NOT NULL DEFAULT '[]', aliases TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    "CREATE TABLE note_chapters (note_id TEXT NOT NULL, chapter_id TEXT NOT NULL, PRIMARY KEY (note_id, chapter_id))",
    `CREATE TABLE tasks (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, title TEXT NOT NULL, todo_state TEXT NOT NULL,
      updated_at TEXT NOT NULL, chapter_id TEXT NOT NULL DEFAULT '', note_id TEXT NOT NULL DEFAULT '')`,
    "INSERT INTO projects (id, title, language, created_at, updated_at) VALUES ('knjiga', 'Moja knjiga', 'sl', '2025-03-01T09:00:00.000Z', '2026-09-30T18:00:00.000Z')",
    `INSERT INTO chapters (id, project_id, title, position, content_json, plain_text, updated_at)
      VALUES ('p1', 'knjiga', 'Začetek', 0, '${doc("Ko je Špela odprla okno, je zadišalo po žitu.")}', 'Ko je Špela odprla okno, je zadišalo po žitu.', '2026-09-30T18:00:00.000Z')`,
    `INSERT INTO chapters (id, project_id, title, position, content_json, plain_text, updated_at)
      VALUES ('p2', 'knjiga', 'Konec', 1, '${doc("Čez tri dni se je vrnila.")}', 'Čez tri dni se je vrnila.', '2026-09-30T18:00:00.000Z')`,
  ];

  it("opens as a project with its book as the first writing, after a copy of it is kept as it was", async () => {
    const path = `${LIBRARY}\\Moja knjiga\\pensieve.db`;
    await standIn.make(path, VERSION_3);
    await switchProjectFile(path);
    const { shelf, writing } = await openShelf("", { title: "Nov projekt", writingTitle: "Nov", welcome: false });

    expect(standIn.rows(`${path}.before-projects`, "SELECT version FROM schema_version")).toEqual([[3]]);
    expect(textIn(`${path}.before-projects`)).toEqual(["Ko je Špela odprla okno, je zadišalo po žitu.", "Čez tri dni se je vrnila."]);

    expect(standIn.rows(path, "SELECT version FROM schema_version")).toEqual([[4]]);
    expect([shelf.projectId, shelf.title, writing.id, writing.language]).toEqual(["knjiga", "Moja knjiga", "knjiga", "sl"]);
    expect(writing.chapters.map((item) => item.plainText)).toEqual(["Ko je Špela odprla okno, je zadišalo po žitu.", "Čez tri dni se je vrnila."]);
    expect(shelf.writings[0].chapters.map((item) => item.words)).toEqual([9, 6]);

    await sqliteStorage.save(withChapters(writing, [...writing.chapters, chapter(writing, "p3", "Dodatek", "Nova stran v stari knjigi.", 2)]));
    expect(textIn(path)).toHaveLength(3);
  });

  it("a file from a newer Pensieve isn't opened", async () => {
    const path = `${LIBRARY}\\Iz prihodnosti\\pensieve.db`;
    await standIn.make(path, [...VERSION_3.slice(0, 1), "INSERT INTO schema_version (id, version) VALUES (1, 5)", ...VERSION_3.slice(2)]);
    await expect(switchProjectFile(path)).rejects.toThrow(translate("en", "errSchemaVersion", { version: "5", expected: "4" }));
  });
});
