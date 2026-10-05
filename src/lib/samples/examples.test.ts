import { describe, expect, it } from "vitest";
import { wordFile } from "$lib/export/word";
import { readWordFile } from "$lib/export/wordImport";
import { EXAMPLE_BOOKS, buildExample, prose } from "./examples";

describe("example books", () => {
  it("turns readable lines into a document", () => {
    const doc = prose(["One *quiet* and **loud** line.", "* *", "> Quoted.", "> Still quoted.", "## A heading"]);
    expect(doc.content).toHaveLength(4);
    expect(JSON.stringify(doc.content?.[0])).toContain('"text":"quiet","marks":[{"type":"italic"}]');
    expect(JSON.stringify(doc.content?.[0])).toContain('"text":"loud","marks":[{"type":"bold"}]');
    expect(doc.content?.[1]).toMatchObject({ attrs: { textAlign: "center" } });
    expect(doc.content?.[2]).toMatchObject({ type: "blockquote" });
    expect((doc.content?.[2] as { content: unknown[] }).content).toHaveLength(2);
    expect(doc.content?.[3]).toMatchObject({ type: "heading" });
  });

  it("has one book of each kind", () => {
    expect(EXAMPLE_BOOKS.map((book) => book.kind).sort()).toEqual(["article", "novel", "stories"]);
    expect(EXAMPLE_BOOKS.some((book) => book.language === "sl")).toBe(true);
  });

  for (const example of EXAMPLE_BOOKS) {
    it(`builds "${example.title}" with every link pointing somewhere real`, () => {
      const { project, notes, tasks } = buildExample(example, "book");
      const chapterIds = new Set(project.chapters.map((chapter) => chapter.id));
      const noteIds = new Set(notes.map((note) => note.id));
      const titles = new Set(notes.map((note) => note.title.toLowerCase()));
      expect(project.chapters.map((chapter) => chapter.position)).toEqual(project.chapters.map((_, index) => index));
      for (const task of tasks) {
        if (task.chapterId) expect(chapterIds.has(task.chapterId)).toBe(true);
        if (task.noteId) expect(noteIds.has(task.noteId)).toBe(true);
      }
      for (const note of notes) {
        for (const id of note.chapterIds) expect(chapterIds.has(id)).toBe(true);
        for (const match of note.plainText.matchAll(/\[\[(.+?)\]\]/g)) expect(titles.has(match[1].toLowerCase())).toBe(true);
      }
    });
  }

  it("fills the novel with every status, note kind and to-do state", () => {
    const { project, notes, tasks } = buildExample(EXAMPLE_BOOKS.find((book) => book.kind === "novel")!, "book");
    expect(new Set(project.chapters.map((chapter) => chapter.status))).toEqual(new Set(["final", "revised", "draft"]));
    expect(project.chapters.some((chapter) => !chapter.plainText.trim())).toBe(true);
    expect(new Set(project.chapters.map((chapter) => chapter.part).filter(Boolean)).size).toBe(2);
    expect(new Set(notes.map((note) => note.category))).toEqual(new Set(["characters", "places", "research", "ideas"]));
    expect(new Set(tasks.map((task) => task.todoState))).toEqual(new Set(["todo", "doing", "done"]));
    // Names in the chapters link to their notes, and some passages carry footnotes.
    const text = JSON.stringify(project.chapters.map((chapter) => chapter.contentJson));
    const linked = [...text.matchAll(/"noteId":"([^"]+)"/g)].map((match) => match[1]);
    expect(linked.length).toBeGreaterThan(2);
    for (const id of linked) expect(notes.some((note) => note.id === id)).toBe(true);
    expect(text).toContain('"type":"footnote"');
    expect(text).not.toContain("[[");
  });

  it("keeps Slovenian letters in the story collection", () => {
    const { project } = buildExample(EXAMPLE_BOOKS.find((book) => book.language === "sl")!, "book");
    const text = project.chapters.map((chapter) => chapter.plainText).join(" ");
    expect(text).toMatch(/č/);
    expect(text).toMatch(/š/);
    expect(text).toMatch(/ž/);
  });

  it("survives a trip through Word", async () => {
    const { project } = buildExample(EXAMPLE_BOOKS[0], "book");
    const bytes = await wordFile(project, { font: "Literata", sizePx: 17, pageWidth: "book", runningHead: true });
    const back = await readWordFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(back.title).toBe(project.title);
    expect(back.chapters.map((chapter) => chapter.title)).toEqual(project.chapters.map((chapter) => chapter.title));
    expect(back.chapters.map((chapter) => chapter.plainText)).toEqual(project.chapters.map((chapter) => chapter.plainText));
  });
});
