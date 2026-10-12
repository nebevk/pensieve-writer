import { describe, expect, it } from "vitest";
import type { Note } from "$lib/storage/organize";
import { noteMatches, panelNotes, panelOrder } from "./panelNotes";

const NOW = "2026-10-12T10:00:00.000Z";
function note(id: string, title: string, more: Partial<Note> = {}): Note {
  return {
    id,
    projectId: "p",
    title,
    contentJson: { type: "doc", content: [] },
    plainText: "",
    category: "ideas",
    tags: "",
    aliases: "",
    fields: [],
    todoState: null,
    chapterIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...more,
  };
}

const ana = note("ana", "Ana Novak", { aliases: "Ana", plainText: "Restorer of old furniture." });
const vera = note("vera", "Vera, her mother", { tags: "lives in Krško" });
const attic = note("attic", "The attic", { plainText: "Low beams and one round window facing the river." });
const zebra = note("zebra", "Žiga");
const book = [zebra, attic, vera, ana];

describe("the notes panel's list", () => {
  it("puts the chapter's notes first, as given, then the others by name, č, š and ž in their place", () => {
    const list = panelNotes([{ note: vera, count: 2 }, { note: ana, count: 1 }], book, "");
    expect(list.searching).toBe(false);
    expect(list.here.map((item) => item.note.id)).toEqual(["vera", "ana"]);
    expect(list.others.map((item) => item.title)).toEqual(["The attic", "Žiga"]);
    expect(panelOrder(list)).toEqual(["vera", "ana", "attic", "zebra"]);
  });

  it("searching, lists every note that matches, those named by the words first", () => {
    const list = panelNotes([{ note: vera, count: 2 }], book, "  RIVER ");
    expect(list.searching).toBe(true);
    expect(list.found.map((item) => item.id)).toEqual(["attic"]);
    const named = panelNotes([], [attic, note("nb", "Notebook", { plainText: "Things about Ana" }), ana], "ana");
    expect(panelOrder(named)).toEqual(["ana", "nb"]);
  });

  it("finds by other names and the short description too", () => {
    expect(noteMatches(vera, "krško")).toBe(true);
    expect(noteMatches(ana, "ana")).toBe(true);
    expect(noteMatches(attic, "ana")).toBe(false);
    expect(panelNotes([], book, "nothing like this").found).toEqual([]);
  });
});
