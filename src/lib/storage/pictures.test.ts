import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type Database from "@tauri-apps/plugin-sql";
import { pictureId, shownJson, storedJson } from "./pictures";

/** A project file with only what pictures.ts asks of it: the pictures table. */
function fakeFile() {
  const rows = new Map<string, string>();
  let inserts = 0;
  let reads = 0;
  const db = {
    path: `sqlite:test-${Math.random()}`,
    async select(query: string, values: string[] = []) {
      reads += 1;
      if (query.startsWith("SELECT id FROM pictures")) return [...rows.keys()].map((id) => ({ id }));
      if (query.startsWith("SELECT id, data FROM pictures")) return values.filter((id) => rows.has(id)).map((id) => ({ id, data: rows.get(id) }));
      throw new Error(`unexpected ${query}`);
    },
    async execute(query: string, values: string[]) {
      if (query.startsWith("CREATE TABLE")) return { rowsAffected: 0 };
      inserts += 1;
      if (!rows.has(values[0])) rows.set(values[0], values[1]);
      return { rowsAffected: 1 };
    },
  };
  return { db: db as unknown as Database, rows, inserts: () => inserts, reads: () => reads };
}

const RED = `data:image/png;base64,${"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="}`;
const BLUE = `data:image/jpeg;base64,${"/9j/4AAQSkZJRgABAQEASABIAAD".repeat(40)}`;
const doc = (...content: unknown[]) => ({ type: "doc", content });
const text = (words: string) => ({ type: "paragraph", content: [{ type: "text", text: words }] });
const picture = (src: string) => ({ type: "image", attrs: { src, alt: "", title: null } });

describe("pictures kept once", () => {
  it("leaves a document without pictures as it was, without asking the file anything", async () => {
    const file = fakeFile();
    const plain = doc(text("Čez reko je padal mrak, šepetal je žerjav."));
    expect(await storedJson(file.db, plain)).toBe(JSON.stringify(plain));
    expect(await shownJson(file.db, JSON.stringify(plain))).toBe(JSON.stringify(plain));
    expect(file.inserts() + file.reads()).toBe(0);
  });

  it("keeps each picture once, named by the SHA-256 of its data, and the text as it was", async () => {
    const file = fakeFile();
    const chapter = doc(text("Pred sliko: č, š, ž."), picture(RED), text("Med slikama."), picture(RED), picture(BLUE));
    const stored = await storedJson(file.db, chapter);
    expect(stored).not.toContain("data:image");
    expect(stored).toContain(`pensieve-picture:${createHash("sha256").update(RED).digest("hex")}`);
    expect(await pictureId(BLUE)).toBe(createHash("sha256").update(BLUE).digest("hex"));
    expect([...file.rows.values()].sort()).toEqual([BLUE, RED].sort());
    expect(JSON.parse(await shownJson(file.db, stored))).toEqual(chapter);
  });

  it("doesn't write a picture the file already holds again, save after save", async () => {
    const file = fakeFile();
    const chapter = doc(text("Ena."), picture(BLUE));
    await storedJson(file.db, chapter);
    const after = file.inserts();
    for (let save = 0; save < 5; save += 1) await storedJson(file.db, doc(text(`Ena ${save}.`), picture(BLUE)));
    expect(file.inserts()).toBe(after);
    expect(file.rows.size).toBe(1);
  });

  it("keeps an earlier version's chapters and notes the same way", async () => {
    const file = fakeFile();
    const payload = {
      title: "Reka",
      chapters: [{ id: "a", title: "Prvo", contentJson: doc(picture(RED), text("Žaba.")) }],
      notes: [{ id: "n", title: "Kraj", contentJson: doc(picture(BLUE)) }],
      tasks: [],
    };
    const stored = await storedJson(file.db, payload);
    expect(stored).not.toContain("data:image");
    expect(JSON.parse(await shownJson(file.db, stored))).toEqual(payload);
  });

  it("leaves a picture the file lacks named, so saving again loses nothing more", async () => {
    const file = fakeFile();
    const stored = await storedJson(file.db, doc(picture(RED)));
    file.rows.clear();
    const shown = await shownJson(file.db, stored);
    expect(shown).toBe(stored);
    expect(await storedJson(file.db, JSON.parse(shown))).toBe(stored);
  });

  it("doesn't touch words that only look like a picture's name", async () => {
    const file = fakeFile();
    const words = doc(text(`pensieve-picture:${"a".repeat(64)}`));
    expect(await shownJson(file.db, JSON.stringify(words))).toBe(JSON.stringify(words));
    expect(file.reads()).toBe(0);
  });
});
