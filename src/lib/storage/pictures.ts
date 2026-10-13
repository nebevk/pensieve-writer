import type Database from "@tauri-apps/plugin-sql";

/**
 * Pictures kept once (IMP-6). In the project's file a chapter, a note or an earlier version holds
 * "pensieve-picture:<id>" where a picture is, and the picture itself is one row of the pictures table, its
 * id the SHA-256 of its data. However many saves, earlier versions and copies hold a picture, the file keeps
 * it once. Everything outside the storage sees pictures as before: data: URLs in the document.
 *
 * Rows are never deleted: an earlier version may still need one.
 */
export const PICTURES_TABLE = `CREATE TABLE IF NOT EXISTS pictures (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
)`;

const PREFIX = "pensieve-picture:";
const REFERENCE = /"src":"pensieve-picture:([0-9a-f]{64})"/g;
const isData = (value: unknown): value is string => typeof value === "string" && value.startsWith("data:image/");

/**
 * The ids of pictures met lately, by their data, so a save doesn't hash the same picture again: a picture
 * read from the file arrives with its id. Kept to about 32 million characters of pictures.
 */
const idsByData = new Map<string, string>();
let remembered = 0;
const BUDGET = 32_000_000;

function remember(data: string, id: string) {
  if (idsByData.has(data)) return;
  idsByData.set(data, id);
  remembered += data.length;
  for (const [old] of idsByData) {
    if (remembered <= BUDGET) break;
    idsByData.delete(old);
    remembered -= old.length;
  }
}

/** The pictures each open file is known to hold, by its connection. */
const storedIn = new Map<string, Set<string>>();

export async function pictureId(data: string): Promise<string> {
  const known = idsByData.get(data);
  if (known) return known;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  const id = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  remember(data, id);
  return id;
}

/** Every picture's data in a document (or anything holding documents), each once. */
function picturesIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) picturesIn(item, found);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "src" && isData(item)) found.add(item);
      else if (item && typeof item === "object") picturesIn(item, found);
    }
  }
  return found;
}

/**
 * JSON for the file: each picture in `value` (a document, or an earlier version holding several) kept in
 * the pictures table, before anything that names it is written, and named by its id.
 */
export async function storedJson(db: Database, value: unknown): Promise<string> {
  const found = picturesIn(value);
  if (found.size === 0) return JSON.stringify(value);
  const ids = new Map<string, string>();
  for (const data of found) ids.set(data, await pictureId(data));
  let stored = storedIn.get(db.path);
  if (!stored) {
    // The table comes with a file's first picture, whichever way the file was opened.
    await db.execute(PICTURES_TABLE);
    stored = new Set((await db.select<{ id: string }[]>("SELECT id FROM pictures")).map((row) => row.id));
    storedIn.set(db.path, stored);
  }
  for (const [data, id] of ids) {
    if (stored.has(id)) continue;
    await db.execute("INSERT OR IGNORE INTO pictures (id, data, created_at) VALUES ($1, $2, $3)", [id, data, new Date().toISOString()]);
    stored.add(id);
  }
  return JSON.stringify(value, (key, item) => (key === "src" && isData(item) ? `${PREFIX}${ids.get(item)}` : item));
}

/**
 * JSON from the file with each picture's data back in place of its id, ready to parse. A picture the file
 * lacks keeps its id, so nothing more is lost when the text is saved again. A file that can't be read fails
 * here: never a document without its pictures.
 */
export async function shownJson(db: Database, raw: string): Promise<string> {
  if (!raw.includes(PREFIX)) return raw;
  const wanted = [...new Set([...raw.matchAll(REFERENCE)].map((match) => match[1]))];
  if (wanted.length === 0) return raw;
  const rows = await db.select<{ id: string; data: string }[]>(
    `SELECT id, data FROM pictures WHERE id IN (${wanted.map((_, index) => `$${index + 1}`).join(", ")})`,
    wanted,
  );
  const data = new Map(rows.map((row) => [row.id, row.data]));
  for (const [id, picture] of data) remember(picture, id);
  return raw.replace(REFERENCE, (whole, id: string) => {
    const picture = data.get(id);
    return picture ? `"src":${JSON.stringify(picture)}` : whole;
  });
}
