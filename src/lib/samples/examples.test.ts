import { describe, expect, it } from "vitest";
import { wordFile } from "$lib/export/word";
import { readWordFile } from "$lib/export/wordImport";
import { EXAMPLE_BOOKS, EXAMPLE_PROJECTS, buildExample, prose } from "./examples";

const writingsOf = (slug: string) => buildExample(EXAMPLE_PROJECTS.find((example) => example.slug === slug)!, "project");

describe("example projects", () => {
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

  it("keeps a novel in chapters and an article on one page, in a folder, in one project", () => {
    const lantern = EXAMPLE_PROJECTS.find((example) => example.slug === "the-lantern-series")!;
    expect(lantern.books.map((book) => [book.title, book.split, book.folder ?? ""])).toEqual([
      ["The Lantern House", true, ""],
      ["Why I write by hand first", false, "Published"],
    ]);
    expect(EXAMPLE_BOOKS.some((book) => book.language === "sl")).toBe(true);
    const { writings } = writingsOf("the-lantern-series");
    expect(writings.map((item) => item.folder)).toEqual(["", "Published"]);
    expect(new Set(writings.map((item) => item.writing.id)).size).toBe(2);
  });

  for (const example of EXAMPLE_PROJECTS) {
    it(`builds "${example.title}" with every link pointing somewhere real`, () => {
      const { writings, notes, tasks } = buildExample(example, "project");
      const chapters = writings.flatMap((item) => item.writing.chapters);
      const chapterIds = new Set(chapters.map((chapter) => chapter.id));
      const noteIds = new Set(notes.map((note) => note.id));
      const titles = new Set(notes.map((note) => note.title.toLowerCase()));
      for (const { writing } of writings) {
        expect(writing.chapters.map((chapter) => chapter.position)).toEqual(writing.chapters.map((_, index) => index));
        expect(writing.chapters.every((chapter) => chapter.writingId === writing.id)).toBe(true);
      }
      expect(notes.every((note) => note.projectId === "project")).toBe(true);
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
    const { writings, notes, tasks } = writingsOf("the-lantern-series");
    const project = writings[0].writing;
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
    // Some passages carry comments, to try the margin with.
    expect(text.match(/"type":"comment"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(text).not.toContain("{{");
  });

  it("keeps Slovenian letters in the story collection", () => {
    const project = writingsOf("zgodbe-ob-reki").writings[0].writing;
    const text = project.chapters.map((chapter) => chapter.plainText).join(" ");
    expect(text).toMatch(/č/);
    expect(text).toMatch(/š/);
    expect(text).toMatch(/ž/);
  });

  it("survives a trip through Word", async () => {
    const project = writingsOf("the-lantern-series").writings[0].writing;
    const bytes = await wordFile(project, { font: "Literata", sizePt: 13, pageWidth: "book", runningHead: true });
    const back = await readWordFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(back.title).toBe(project.title);
    expect(back.chapters.map((chapter) => chapter.title)).toEqual(project.chapters.map((chapter) => chapter.title));
    expect(back.chapters.map((chapter) => chapter.plainText)).toEqual(project.chapters.map((chapter) => chapter.plainText));
  });
});
