import { describe, expect, it } from "vitest";
import type { ProjectText } from "$lib/storage/sqlite";
import { searchProjects, type SearchSource } from "./searchAll";

const project = (path: string, name: string, text: ProjectText): SearchSource => ({ path, name, text });
const reka = project("C:\\K\\Reka\\pensieve.db", "Zgodbe ob reki", {
  writings: [
    {
      id: "w1",
      title: "Pod lipo",
      chapters: [
        { id: "c1", title: "1. poglavje", text: "Nika je odprla vrata. Za vrati je stala stara hiša ob reki, in reka je šumela." },
        { id: "c2", title: "Reka", text: "Zjutraj je deževalo." },
      ],
    },
    { id: "w2", title: "Most", chapters: [{ id: "c3", title: "Most", text: "Most čez Savo je bil star." }] },
  ],
  notes: [{ id: "n1", title: "Reka Sava", text: "Teče skozi Ljubljano? Ne, mimo." }],
});
const brod = project("C:\\K\\Brod\\pensieve.db", "Brod", {
  writings: [{ id: "w9", title: "Brod", chapters: [{ id: "c9", title: "Prvo poglavje", text: "Brodnik je čakal ob REKI." }] }],
  notes: [],
});

describe("Search across projects", () => {
  it("finds the words in any case, in chapters, their titles and notes, project by project", () => {
    const result = searchProjects([reka, brod], "reki");
    expect(result.groups.map((group) => group.name)).toEqual(["Zgodbe ob reki", "Brod"]);
    expect(result.groups[0].places.map((place) => [place.kind, place.label, place.count])).toEqual([["chapter", "Pod lipo › 1. poglavje", 1]]);
    expect(result.groups[1].places[0]).toMatchObject({ kind: "chapter", writingId: "w9", chapterId: "c9", label: "Brod › Prvo poglavje", match: "REKI" });
    expect(result.places).toBe(2);
  });

  it("counts every time, looks in titles and notes' names, and names a one-page writing alone", () => {
    const result = searchProjects([reka], "reka");
    const places = result.groups[0].places.map((place) => [place.kind, place.label, place.count]);
    expect(places).toEqual([
      ["chapter", "Pod lipo › 1. poglavje", 1],
      ["chapter", "Pod lipo › Reka", 1],
      ["note", "Reka Sava", 1],
    ]);
    expect(searchProjects([reka], "most").groups[0].places[0]).toMatchObject({ label: "Most", count: 2 });
  });

  it("tells č and c apart, as Find does", () => {
    expect(searchProjects([reka], "cez").places).toBe(0);
    expect(searchProjects([reka], "čez").places).toBe(1);
  });

  it("shows the words with a little of the text around them, at whole words and on one line", () => {
    const long = "Prvi stavek je tu. ".repeat(10) + "Tu je iskana beseda sredi besedila. " + "Potem pride še nekaj stavkov. ".repeat(10);
    const result = searchProjects([project("x", "X", { writings: [{ id: "w", title: "W", chapters: [{ id: "c", title: "C", text: long }] }], notes: [] })], "iskana");
    const place = result.groups[0].places[0];
    expect(place.match).toBe("iskana");
    expect(place.before.startsWith("…")).toBe(true);
    expect(place.after.endsWith("…")).toBe(true);
    expect(place.before.length).toBeLessThanOrEqual(52);
    expect(/^…\S/.test(place.before) && /\S…$/.test(place.after)).toBe(true);
  });

  it("stops at the most it shows, and says so", () => {
    const many = project("m", "M", {
      writings: [{ id: "w", title: "W", chapters: Array.from({ length: 30 }, (_, index) => ({ id: `c${index}`, title: `${index}`, text: "reka" })) }],
      notes: [],
    });
    const result = searchProjects([many], "reka", 10);
    expect(result.places).toBe(10);
    expect(result.capped).toBe(true);
    expect(searchProjects([many], "  ").groups).toEqual([]);
  });
});
