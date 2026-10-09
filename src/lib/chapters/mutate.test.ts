import { describe, expect, it } from "vitest";
import { createChapter, type Writing } from "$lib/model";
import { insertChapterAfter } from "./mutate";

const NOW = "2026-10-09T12:00:00.000Z";

function book(...parts: string[]): Writing {
  return {
    id: "book",
    title: "Dolga testna knjiga",
    createdAt: NOW,
    updatedAt: NOW,
    language: "sl",
    split: true,
    wordGoal: 0,
    chapters: parts.map((part, position) => ({ ...createChapter("book", `Poglavje ${position + 1}`, position, NOW), part })),
  };
}

const order = (writing: Writing) =>
  [...writing.chapters].sort((a, b) => a.position - b.position).map((chapter) => `${chapter.title}|${chapter.part}`);

describe("a chapter added after another", () => {
  it("comes right after it, in its part, and the chapters after it move down", () => {
    const before = book("Prvi del", "Prvi del", "Drugi del");
    const made = insertChapterAfter(before, before.chapters[1].id, "Poglavje 3", NOW);
    expect(made && order(made.writing)).toEqual(["Poglavje 1|Prvi del", "Poglavje 2|Prvi del", "Poglavje 3|Prvi del", "Poglavje 3|Drugi del"]);
    expect(made?.writing.chapters.find((chapter) => chapter.id === made.activeId)?.title).toBe("Poglavje 3");
  });

  it("leaves the book as it was when the chapter isn't in it", () => {
    expect(insertChapterAfter(book(""), "elsewhere", "Poglavje 2", NOW)).toBeNull();
  });
});
