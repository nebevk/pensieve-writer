import { describe, expect, it } from "vitest";
import { firstChapters } from "./welcome";

describe("a new book's first chapters", () => {
  it("opens a novel on the welcome page, with an empty chapter after it", () => {
    const [welcome, next, ...rest] = firstChapters("book", "novel", "Untitled");
    expect(rest).toHaveLength(0);
    expect(welcome).toMatchObject({ title: "Welcome", position: 0, projectId: "book" });
    expect(welcome.plainText).toContain("Delete this page");
    expect(next).toMatchObject({ title: "Chapter 1", position: 1, plainText: "" });
    expect(welcome.id).not.toBe(next.id);
  });

  it("starts a story collection with a story and an article as one page", () => {
    expect(firstChapters("book", "stories", "Zgodbe").map((chapter) => chapter.title)).toEqual(["Welcome", "Story 1"]);
    const article = firstChapters("book", "article", "Why I write");
    expect(article).toHaveLength(1);
    expect(article[0].title).toBe("Why I write");
    expect(article[0].plainText).toContain("Erase these lines");
  });
});
