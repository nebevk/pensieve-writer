import { describe, expect, it } from "vitest";
import { createChapter, type DocumentJson } from "$lib/model";
import { chaptersToMarkdown, chaptersToPlain, documentToBlocks } from "./document";
import { decodeText, markdownToChapters, plainTextToChapters, readTextFile } from "./textImport";

const text = (value: string, marks: object[] = []) => (marks.length ? { type: "text", text: value, marks } : { type: "text", text: value });
const para = (...content: object[]) => ({ type: "paragraph", content });
const doc = (...content: object[]) => ({ type: "doc", content }) as DocumentJson;
const picture = "data:image/png;base64,iVBORw0KGgo=";

describe("Text files", () => {
  it("reads UTF-8 with or without its mark, UTF-16, and Notepad's old Central European text", () => {
    const utf8 = new TextEncoder().encode("Čaša, šola, žaba");
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe("Čaša, šola, žaba");
    expect(decodeText(utf8)).toBe("Čaša, šola, žaba");
    // "ča" in UTF-16, as Notepad's "Unicode" saves it.
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x0d, 0x01, 0x61, 0x00]))).toBe("ča");
    // Windows-1250, where ž, č and š are 9E, E8 and 9A.
    expect(decodeText(new Uint8Array([0x9e, 0x61, 0x62, 0x61, 0x20, 0xe8, 0x9a]))).toBe("žaba čš");
  });

  it("makes each line a paragraph, keeps scene breaks, and begins chapters at chapter lines", () => {
    const book = plainTextToChapters(
      "Pod lipo\r\n\r\n1. poglavje\r\n\r\nNika je odprla vrata.\r\n\t“Kje si bil?” je vprašala.\r\n\r\n* * *\r\n\r\nZjutraj je deževalo.\r\n\r\n2. poglavje\r\n\r\nKonec.\r\n",
      "rokopis",
    );
    expect(book.title).toBe("Pod lipo");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["1. poglavje", "2. poglavje"]);
    expect(book.chapters[0].contentJson.content).toEqual([
      para(text("Nika je odprla vrata.")),
      para(text("“Kje si bil?” je vprašala.")),
      { type: "paragraph", attrs: { textAlign: "center" }, content: [text("* * *")] },
      para(text("Zjutraj je deževalo.")),
    ]);
    expect(book.chapters[1].plainText).toBe("Konec.");
  });

  it("keeps text without chapter lines as one chapter named after the file, its first line included", () => {
    const note = plainTextToChapters("Ideja za zgodbo\n\nStara hiša ob reki.", "zapiski");
    expect(note.title).toBe("");
    expect(note.chapters).toHaveLength(1);
    expect(note.chapters[0].title).toBe("zapiski");
    expect(note.chapters[0].plainText).toBe("Ideja za zgodbo\n\nStara hiša ob reki.");
  });

  it("joins hard-wrapped lines back into paragraphs, and leaves a poem's lines alone", () => {
    const wrapped = [
      "It was the best of times, it was the worst of times, it was the age",
      "of wisdom, it was the age of foolishness, it was the epoch of belief,",
      "it was the epoch of incredulity, it was the season of Light.",
      "",
      "There were a king with a large jaw and a queen with a plain face, on",
      "the throne of England; there were a king with a large jaw and a queen",
      "with a fair face, on the throne of France. In both countries it was",
      "clearer than crystal to the lords of the State preserves of loaves",
      "and fishes, that things in general were settled for ever.",
    ].join("\n");
    const prose = plainTextToChapters(wrapped, "Dickens");
    expect(prose.chapters[0].contentJson.content).toHaveLength(2);
    expect(prose.chapters[0].plainText).toMatch(/^It was the best of times, it was the worst of times, it was the age of wisdom, it was/);
    const poem = plainTextToChapters("Kdo je mar?\nKdo je pa ti?\nKje so tvoje\nsanje?", "pesem");
    expect(poem.chapters[0].contentJson.content).toHaveLength(4);
  });

  it("gives no chapters for an empty file", () => {
    expect(plainTextToChapters("", "prazno").chapters).toEqual([]);
    expect(readTextFile(new Uint8Array(), "prazno", true).chapters).toEqual([]);
    expect(readTextFile(new Uint8Array([0xef, 0xbb, 0xbf]), "prazno", false).chapters).toEqual([]);
  });

  it("reads Pensieve's own text export back into its chapters", () => {
    const chapters = [
      { ...createChapter("w", "1. poglavje", 0), contentJson: doc(para(text("Nika je odprla vrata.")), para(text("Čaša, šola, žaba."))) },
      { ...createChapter("w", "2. poglavje", 1), contentJson: doc(para(text("Konec."))) },
    ];
    const book = plainTextToChapters(chaptersToPlain("Pod lipo", chapters), "datoteka");
    expect(book.title).toBe("Pod lipo");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["1. poglavje", "2. poglavje"]);
    expect(book.chapters.map((chapter) => chapter.contentJson)).toEqual(chapters.map((chapter) => chapter.contentJson));
  });
});

describe("Markdown files", () => {
  it("reads Pensieve's own Markdown export back as it was written", () => {
    const first = {
      ...createChapter("w", "Prvo poglavje", 0),
      contentJson: doc(
        para(text("Nika je "), text("odprla", [{ type: "bold" }]), text(" vrata "), text("počasi", [{ type: "italic" }]), text(".")),
        para(
          text("Both", [{ type: "bold" }, { type: "italic" }]),
          text(" and "),
          text("under", [{ type: "underline" }]),
          text(", "),
          text("gone", [{ type: "strike" }]),
          text(", x"),
          text("2", [{ type: "superscript" }]),
          text(" and "),
          text("marked", [{ type: "highlight" }]),
        ),
        para(text("A line"), { type: "hardBreak" }, text("and the next, with a "), text("link", [{ type: "link", attrs: { href: "https://example.com/a" } }]), text(".")),
        { type: "heading", attrs: { level: 3 }, content: [text("Zjutraj")] },
        { type: "blockquote", content: [para(text("First line of the letter.")), para(text("Second paragraph."))] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [para(text("Keys")), { type: "orderedList", content: [{ type: "listItem", content: [para(text("brass"))] }] }] },
            { type: "listItem", content: [para(text("Lamp"))] },
          ],
        },
        { type: "image", attrs: { src: picture, alt: "The lantern house" } },
        para(text("A note"), { type: "footnote", attrs: { text: "Written in 1920." } }, text(" here.")),
        { type: "horizontalRule" },
        para(text("Čaša, šola, žaba.")),
      ),
    };
    const second = { ...createChapter("w", "Drugo poglavje", 1), contentJson: doc(para(text("Konec."))) };
    const book = markdownToChapters(chaptersToMarkdown("Pod lipo", [first, second]), "datoteka");
    expect(book.title).toBe("Pod lipo");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["Prvo poglavje", "Drugo poglavje"]);
    expect(documentToBlocks(book.chapters[0].contentJson)).toEqual(documentToBlocks(first.contentJson));
    expect(documentToBlocks(book.chapters[1].contentJson)).toEqual(documentToBlocks(second.contentJson));
    expect(book.chapters[1].plainText).toBe("Konec.");
  });

  it("makes a blog post one page, titled from its front matter, with its headings as they are", () => {
    const post = markdownToChapters(
      '---\ntitle: "Jesen v Ljubljani"\ndate: 2026-10-01\n---\n\n# Jesen v Ljubljani\n\nPrvi odstavek.\n\n## Tržnica\n\nJabolka in _kostanj_.\n',
      "jesen",
    );
    expect(post.title).toBe("Jesen v Ljubljani");
    expect(post.chapters).toHaveLength(1);
    expect(post.chapters[0].title).toBe("Jesen v Ljubljani");
    expect(post.chapters[0].contentJson.content).toEqual([
      para(text("Prvi odstavek.")),
      { type: "heading", attrs: { level: 2 }, content: [text("Tržnica")] },
      para(text("Jabolka in "), text("kostanj", [{ type: "italic" }]), text(".")),
    ]);
  });

  it("makes notes with text before their first heading one page, and a book of chapter headings a book", () => {
    const notes = markdownToChapters("Kaj še manjka.\n\n# Liki\n\nNika, Ana.\n\n# Kraji\n\nReka.", "zapiski");
    expect(notes.chapters).toHaveLength(1);
    expect((notes.chapters[0].contentJson.content as { type: string }[]).filter((node) => node.type === "heading")).toHaveLength(2);
    const book = markdownToChapters("Posvetilo.\n\n# 1. poglavje\n\nZačetek.\n\n# 2. poglavje\n\nKonec.", "knjiga");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["knjiga", "1. poglavje", "2. poglavje"]);
  });

  it("leaves underscores inside words, lone stars and pictures from elsewhere as they are", () => {
    const page = markdownToChapters("snake_case_name, 2 * 3 * 4, ![map](images/map.png) and [x] alone.", "x");
    expect(page.chapters[0].plainText).toBe("snake_case_name, 2 * 3 * 4, ![map](images/map.png) and [x] alone.");
    expect(JSON.stringify(page.chapters[0].contentJson)).not.toContain("marks");
  });

  it("keeps a line written alone on its own line, and joins only hard-wrapped ones", () => {
    const poem = markdownToChapters("Kdo je mar?\nKdo je pa ti?", "pesem");
    expect(poem.chapters[0].contentJson.content).toEqual([para(text("Kdo je mar?"), { type: "hardBreak" }, text("Kdo je pa ti?"))]);
  });
});
