import { describe, expect, it } from "vitest";
import { createChapter, createProject, type Chapter, type Project } from "$lib/model";
import { bookProgress, summarize } from "./progress";

function book(kind: Project["kind"], chapters: Partial<Chapter>[], wordGoal = 0): Project {
  const project = createProject();
  return {
    ...project,
    kind,
    wordGoal,
    chapters: chapters.map((patch, index) => ({ ...createChapter(project.id, `Chapter ${index + 1}`, index), ...patch })),
  };
}

describe("book progress on Home", () => {
  it("measures a novel against its target", () => {
    const summary = summarize(book("novel", [{ plainText: "one two three" }, { plainText: "four" }], 8));
    expect(summary.words).toBe(4);
    expect(summary.target).toBe(8);
    expect(bookProgress(summary)).toBe(0.5);
  });

  it("adds up the chapter goals when the book has no target", () => {
    const summary = summarize(book("novel", [{ plainText: "a b", wordGoal: 2 }, { plainText: "c", wordGoal: 6 }]));
    expect(summary.target).toBe(8);
    expect(bookProgress(summary)).toBe(3 / 8);
  });

  it("counts finished stories in a collection", () => {
    const summary = summarize(book("stories", [{ status: "final" }, { status: "revised" }, { status: "final" }, {}]));
    expect(summary.finished).toBe(2);
    expect(summary.chapters).toBe(4);
    expect(bookProgress(summary)).toBe(0.5);
  });

  it("follows an article's status", () => {
    expect(bookProgress(summarize(book("article", [{ plainText: "draft words" }])))).toBeCloseTo(1 / 3);
    expect(bookProgress(summarize(book("article", [{ plainText: "done", status: "final" }])))).toBe(1);
    expect(bookProgress(summarize(book("article", [{}])))).toBe(0);
  });

  it("never goes past the end", () => {
    expect(bookProgress(summarize(book("novel", [{ plainText: "one two three" }], 2)))).toBe(1);
  });

  it("knows when the book was last edited", () => {
    const summary = summarize(book("novel", [{ updatedAt: "2026-10-01T10:00:00.000Z" }, { updatedAt: "2026-10-03T09:00:00.000Z" }]));
    expect(summary.editedAt).toBe("2026-10-03T09:00:00.000Z");
  });
});
