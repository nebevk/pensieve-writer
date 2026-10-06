import { describe, expect, it } from "vitest";
import { countWords } from "$lib/editor/counts";
import { notesInChapter } from "$lib/chapters/mentions";
import { buildLongBook } from "./longBook";

describe("the long test book", () => {
  const { project, notes, tasks } = buildLongBook("book", "Long test book", (n) => `Chapter ${n}`);

  it("has about 150,000 words in 15 chapters of about 10,000", () => {
    const counts = project.chapters.map((chapter) => countWords(chapter.plainText));
    expect(counts).toHaveLength(15);
    for (const words of counts) expect(words).toBeGreaterThanOrEqual(10_000);
    const total = counts.reduce((sum, words) => sum + words, 0);
    expect(total).toBeGreaterThan(150_000);
    expect(total).toBeLessThan(160_000);
    expect(project.wordGoal).toBe(150_000);
  });

  it("comes out the same every time", () => {
    const again = buildLongBook("other", "Long test book", (n) => `Chapter ${n}`);
    expect(again.project.chapters.map((chapter) => chapter.plainText)).toEqual(project.chapters.map((chapter) => chapter.plainText));
  });

  it("has notes the chapters mention and to-dos that point at real chapters and notes", () => {
    const here = notesInChapter(notes, project.chapters[3]);
    expect(here.length).toBeGreaterThanOrEqual(6);
    expect(here[0].count).toBeGreaterThan(50);
    const chapterIds = new Set(project.chapters.map((chapter) => chapter.id));
    const noteIds = new Set(notes.map((note) => note.id));
    for (const task of tasks) {
      if (task.chapterId) expect(chapterIds.has(task.chapterId)).toBe(true);
      if (task.noteId) expect(noteIds.has(task.noteId)).toBe(true);
    }
    expect(new Set(tasks.map((task) => task.todoState))).toEqual(new Set(["todo", "doing", "done"]));
  });
});
