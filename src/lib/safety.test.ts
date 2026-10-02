import { describe, expect, it } from "vitest";
import { createChapter, createProject } from "$lib/model";
import { manuscriptText, projectFromSnapshot, withRestoredChapter } from "$lib/storage/restore";
import { backupFile } from "$lib/storage/backupFile";
import { wordsFor } from "$lib/editor/counts";
import { replaceInDocument, searchChapters } from "$lib/editor/find";
import { chaptersToDocx, chaptersToMarkdown, documentToBlocks } from "$lib/export/document";
import mammoth from "mammoth";

describe("restore drill", () => {
  it("restores snapshot text, including č š ž", () => {
    const current = createProject();
    current.chapters[0].plainText = "Current čšž";
    const saved = structuredClone(current.chapters);
    saved[0].plainText = "Saved čšž";
    const restored = projectFromSnapshot(current, { title: "Book", language: "sl", chapters: saved });
    expect(manuscriptText(restored)).toBe("Saved čšž");
    expect(restored.language).toBe("sl");
    const again = projectFromSnapshot(restored, { title: current.title, chapters: current.chapters });
    expect(manuscriptText(again)).toBe("Current čšž");
  });

  it("restores one chapter and leaves the others", () => {
    const project = createProject();
    const second = createChapter(project.id, "Two", 1);
    second.plainText = "keep me";
    project.chapters.push(second);
    const older = { ...project.chapters[0], plainText: "brought back" };
    const next = withRestoredChapter(project, older);
    expect(next.chapters.find((chapter) => chapter.id === second.id)?.plainText).toBe("keep me");
    expect(next.chapters.find((chapter) => chapter.id === older.id)?.plainText).toBe("brought back");
  });
});

describe("backup file", () => {
  it("keeps the manuscript text in the JSON", () => {
    const project = createProject();
    project.chapters[0].plainText = "Drive copy";
    const file = backupFile(project, [], [], "2026-10-02T00:00:00.000Z");
    const parsed = JSON.parse(JSON.stringify(file));
    expect(parsed.kind).toBe("pensieve-backup");
    expect(manuscriptText(parsed.project)).toBe("Drive copy");
  });
});

describe("word counts", () => {
  it("recounts a chapter only when its text changes", () => {
    const first = wordsFor("a", "one two");
    const second = wordsFor("a", "one two");
    const third = wordsFor("a", "one two three");
    expect(first).toBe(2);
    expect(second).toBe(2);
    expect(third).toBe(3);
    expect(wordsFor("b", "one two")).toBe(2);
  });
});

describe("find", () => {
  it("lists matches by chapter", () => {
    const hits = searchChapters(
      [
        { id: "1", title: "One", plainText: "cat and cat" },
        { id: "2", title: "Two", plainText: "dog" },
      ],
      "cat",
    );
    expect(hits).toEqual([{ chapterId: "1", title: "One", count: 2 }]);
  });

  it("replaces in the chapter document and the plain text", () => {
    const next = replaceInDocument(
      { type: "doc", content: [{ type: "text", text: "Cat cat" }] },
      "Cat cat",
      "cat",
      "dog",
    );
    expect(next.count).toBe(2);
    expect(next.plainText).toBe("dog dog");
  });
});

describe("export", () => {
  it("writes markdown headings", () => {
    const chapter = createChapter("p", "Chapter", 0);
    chapter.contentJson = {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Dawn" }] }],
    };
    expect(chaptersToMarkdown("Book", [chapter])).toContain("# Book");
    expect(chaptersToMarkdown("Book", [chapter])).toContain("# Dawn");
  });

  it("keeps a heading and italics through Word export", async () => {
    const chapter = createChapter("p", "Chapter", 0);
    chapter.contentJson = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Dawn" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "soft light", marks: [{ type: "italic" }] }],
        },
      ],
    };
    const blob = await chaptersToDocx("Book", [chapter]);
    const result = await mammoth.convertToHtml({
      buffer: Buffer.from(await blob.arrayBuffer()),
    } as unknown as { arrayBuffer: ArrayBuffer });
    expect(result.value).toContain("Dawn");
    expect(result.value.toLowerCase()).toContain("<em>soft light</em>");
    const blocks = documentToBlocks(chapter.contentJson);
    expect(blocks[0]?.kind).toBe("h1");
    expect(blocks[1]?.inlines[0]?.italic).toBe(true);
  });
});
