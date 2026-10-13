import { describe, expect, it } from "vitest";
import type { ProjectText } from "$lib/storage/sqlite";
import { PAGE_CHARACTERS, searchHits, shownHits, type SearchSource } from "./searchAll";

const ANY = { matchCase: false, wholeWord: false };
const project = (path: string, name: string, text: ProjectText): SearchSource => ({ path, name, text });
const reka = project("C:\\K\\Reka\\pensieve.db", "Zgodbe ob reki", {
  writings: [
    {
      id: "w1",
      title: "Pod lipo",
      split: true,
      chapters: [
        { id: "c1", title: "1. poglavje", text: "Nika je odprla vrata. Za vrati je stala stara hiša ob reki, in reka je šumela." },
        { id: "c2", title: "Reka", text: "Zjutraj je deževalo." },
      ],
    },
    { id: "w2", title: "Most", split: false, chapters: [{ id: "c3", title: "Most", text: "Most čez Savo je bil star." }] },
  ],
  notes: [{ id: "n1", title: "Reka Sava", text: "Teče skozi Ljubljano? Ne, mimo." }],
});
const brod = project("C:\\K\\Brod\\pensieve.db", "Brod", {
  writings: [{ id: "w9", title: "Brod", split: true, chapters: [{ id: "c9", title: "Prvo poglavje", text: "Brodnik je čakal ob REKI." }] }],
  notes: [],
});
const where = (result: ReturnType<typeof searchHits>) =>
  result.groups.flatMap((group) => group.hits.map((hit) => [group.name, hit.kind, hit.title, hit.chapter, hit.page, hit.nth, hit.match]));

describe("Find's list, through projects", () => {
  it("lists every time the words are, in any case, project by project, each chapter by its number", () => {
    const result = searchHits([reka, brod], "reki", ANY);
    expect(where(result)).toEqual([
      ["Zgodbe ob reki", "chapter", "Pod lipo", 1, 0, 0, "reki"],
      ["Brod", "chapter", "Brod", 1, 0, 0, "REKI"],
    ]);
    expect(result.groups.map((group) => group.count)).toEqual([1, 1]);
    expect(result.total).toBe(2);
    expect(result.groups[1].hits[0]).toMatchObject({ writingId: "w9", chapterId: "c9", path: brod.path });
  });

  it("counts a chapter's title and a note's name first, each time once", () => {
    const result = searchHits([reka], "reka", ANY);
    expect(where(result)).toEqual([
      ["Zgodbe ob reki", "chapter", "Pod lipo", 1, 0, 0, "reka"],
      ["Zgodbe ob reki", "chapter", "Pod lipo", 2, 0, 0, "Reka"],
      ["Zgodbe ob reki", "note", "Reka Sava", 0, 0, 0, "Reka"],
    ]);
  });

  it("knows a place in a writing of one page by its page", () => {
    const long = project("l", "L", {
      writings: [{ id: "w", title: "Dolga", split: false, chapters: [{ id: "c", title: "Dolga", text: `${"a".repeat(PAGE_CHARACTERS * 2 + 10)} reka` }] }],
      notes: [],
    });
    expect(searchHits([long], "reka", ANY).groups[0].hits[0]).toMatchObject({ chapter: 0, page: 3 });
    expect(searchHits([reka], "most", ANY).groups[0].hits.map((hit) => [hit.chapter, hit.page, hit.nth])).toEqual([
      [0, 1, 0],
      [0, 1, 1],
    ]);
  });

  it("tells č and c apart, and keeps Aa and ab", () => {
    expect(searchHits([reka], "cez", ANY).total).toBe(0);
    expect(searchHits([reka], "čez", ANY).total).toBe(1);
    expect(searchHits([reka, brod], "REKI", { matchCase: true, wholeWord: false }).total).toBe(1);
    expect(searchHits([reka], "rek", { matchCase: false, wholeWord: true }).total).toBe(0);
  });

  it("shows the words with a little of the text around them, at whole words and on one line", () => {
    const long = "Prvi stavek je tu. ".repeat(10) + "Tu je iskana beseda sredi besedila. " + "Potem pride še nekaj stavkov. ".repeat(10);
    const hit = searchHits([project("x", "X", { writings: [{ id: "w", title: "W", chapters: [{ id: "c", title: "C", text: long }] }], notes: [] })], "iskana", ANY).groups[0].hits[0];
    expect(hit.match).toBe("iskana");
    expect(hit.before.startsWith("…") && hit.after.endsWith("…")).toBe(true);
    expect(hit.before.length).toBeLessThanOrEqual(52);
    expect(/^…\S/.test(hit.before) && /\S…$/.test(hit.after)).toBe(true);
  });

  it("counts every time but lists at most so many, and says so", () => {
    const many = project("m", "M", { writings: [{ id: "w", title: "W", chapters: [{ id: "c", title: "C", text: "reka ".repeat(30) }] }], notes: [] });
    const result = searchHits([many], "reka", ANY, 10);
    expect(result.total).toBe(30);
    expect(result.groups[0].count).toBe(30);
    expect(result.groups[0].hits.length).toBe(10);
    expect(result.capped).toBe(true);
    expect(searchHits([many], "  ", ANY).groups).toEqual([]);
  });

  it("shows the first few of each project, more of one she opens, numbered down the list", () => {
    const result = searchHits([reka, brod], "re", ANY);
    const first = shownHits(result.groups, {}, 2);
    expect(first.map((group) => [group.shown.map((row) => row.index), group.more])).toEqual([
      [[0, 1], result.groups[0].hits.length - 2],
      [[2], 0],
    ]);
    const opened = shownHits(result.groups, { [reka.path]: 50 }, 2);
    expect(opened[0].more).toBe(0);
    expect(opened[1].shown[0].index).toBe(result.groups[0].hits.length);
  });
});
