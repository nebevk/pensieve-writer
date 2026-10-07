import { describe, expect, it } from "vitest";
import { createChapter, createWriting, type Chapter, type Writing } from "$lib/model";
import { bookProgress, summarize, summarizeOutline, summarizeProject } from "./progress";

function book(split: boolean, chapters: Partial<Chapter>[], wordGoal = 0): Writing {
  const writing = createWriting();
  return {
    ...writing,
    split,
    wordGoal,
    chapters: chapters.map((patch, index) => ({ ...createChapter(writing.id, `Chapter ${index + 1}`, index), ...patch })),
  };
}

describe("a writing's progress on Home", () => {
  it("measures a novel against its target", () => {
    const summary = summarize(book(true, [{ plainText: "one two three" }, { plainText: "four" }], 8));
    expect(summary.words).toBe(4);
    expect(summary.target).toBe(8);
    expect(bookProgress(summary)).toBe(0.5);
  });

  it("adds up the chapter goals when the book has no target", () => {
    const summary = summarize(book(true, [{ plainText: "a b", wordGoal: 2 }, { plainText: "c", wordGoal: 6 }]));
    expect(summary.target).toBe(8);
    expect(bookProgress(summary)).toBe(3 / 8);
  });

  it("counts finished chapters when there is no target", () => {
    const summary = summarize(book(true, [{ status: "final" }, { status: "revised" }, { status: "final" }, {}]));
    expect(summary.finished).toBe(2);
    expect(summary.chapters).toBe(4);
    expect(bookProgress(summary)).toBe(0.5);
  });

  it("follows a one-page writing's status", () => {
    expect(bookProgress(summarize(book(false, [{ plainText: "draft words" }])))).toBeCloseTo(1 / 3);
    expect(bookProgress(summarize(book(false, [{ plainText: "done", status: "final" }])))).toBe(1);
    expect(bookProgress(summarize(book(false, [{}])))).toBe(0);
  });

  it("adds a project's writings up, closed ones from their outline", () => {
    const open = summarize(book(true, [{ plainText: "one two" }]));
    const closed = summarizeOutline({
      id: "w2",
      title: "Svetilnik",
      folder: "",
      position: 1,
      split: true,
      language: "sl",
      wordGoal: 0,
      deletedAt: "",
      openedAt: "",
      openedChapter: "",
      updatedAt: "2026-10-07T08:00:00.000Z",
      chapters: [
        { id: "a", title: "Prvo", part: "", position: 0, status: "final", words: 3, empty: false },
        { id: "b", title: "Drugo", part: "", position: 1, status: "draft", words: 4, empty: false },
      ],
    });
    expect(closed).toMatchObject({ words: 7, chapters: 2, finished: 1, title: "Svetilnik" });
    const project = summarizeProject([open, closed]);
    expect(project.words).toBe(9);
    expect(project.writings.map((item) => item.title)).toEqual([open.title, "Svetilnik"]);
  });

  it("never goes past the end", () => {
    expect(bookProgress(summarize(book(true, [{ plainText: "one two three" }], 2)))).toBe(1);
  });

  it("knows when the book was last edited", () => {
    const summary = summarize(book(true, [{ updatedAt: "2026-10-01T10:00:00.000Z" }, { updatedAt: "2026-10-03T09:00:00.000Z" }]));
    expect(summary.editedAt).toBe("2026-10-03T09:00:00.000Z");
  });
});
