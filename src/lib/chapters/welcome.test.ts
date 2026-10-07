import { describe, expect, it } from "vitest";
import { chapterTitle, firstChapters, newWritingChapters } from "./welcome";

describe("a new writing's first chapters", () => {
  it("opens the first writing in chapters on the welcome page, with an empty chapter after it", () => {
    const [welcome, next, ...rest] = firstChapters("writing", true, "Untitled");
    expect(rest).toHaveLength(0);
    expect(welcome).toMatchObject({ title: "Welcome", position: 0, writingId: "writing" });
    expect(welcome.plainText).toContain("Delete this page");
    expect(next).toMatchObject({ title: "Chapter 1", position: 1, plainText: "" });
    expect(welcome.id).not.toBe(next.id);
  });

  it("opens a one-page writing on the welcome page alone, under its title", () => {
    const page = firstChapters("writing", false, "Why I write");
    expect(page).toHaveLength(1);
    expect(page[0].title).toBe("Why I write");
    expect(page[0].plainText).toContain("Erase these lines");
  });

  it("starts any other writing with one empty chapter, or one empty page under its title", () => {
    expect(newWritingChapters("w", true, "Svetilnik", "sl").map((chapter) => chapter.title)).toEqual(["Poglavje 1"]);
    expect(newWritingChapters("w", false, "Why I write").map((chapter) => [chapter.title, chapter.plainText])).toEqual([["Why I write", ""]]);
  });

  it("calls a chapter a chapter, in either language", () => {
    expect(chapterTitle("en", 3)).toBe("Chapter 3");
    expect(chapterTitle("sl", 3)).toBe("Poglavje 3");
  });
});
