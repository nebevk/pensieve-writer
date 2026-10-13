import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import { createChapter, createWriting, type DocumentJson } from "$lib/model";
import { wordFile, type WordBook, type WordLook } from "./word";
import { appendBookChapters, looksLikeChapterTitle, readWordFile, replaceBookChapters } from "./wordImport";
import { WORD_STYLES } from "./wordStyles";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pictureSrc = `data:image/png;base64,${png}`;
const look: WordLook = { font: "Literata", sizePt: 13, pageWidth: "book", runningHead: true };
const text = (value: string, marks: object[] = []) => (marks.length ? { type: "text", text: value, marks } : { type: "text", text: value });
const para = (...content: object[]) => ({ type: "paragraph", content });

/** A chapter that uses every tool the editor has. */
function richChapter(): DocumentJson {
  return {
    type: "doc",
    content: [
      para(text("The keys hung on a nail, "), text("bold", [{ type: "bold" }]), text(" and "), text("italic", [{ type: "italic" }])),
      para(
        text("under", [{ type: "underline" }]),
        text(" struck", [{ type: "strike" }]),
        text(" x"),
        text("2", [{ type: "superscript" }]),
        text(" marked", [{ type: "highlight" }]),
        text(" accent", [{ type: "textColor" }]),
        text(" red", [{ type: "textColor", attrs: { color: "red" } }]),
        text(" green", [{ type: "highlight", attrs: { color: "green" } }]),
        text(" garamond", [{ type: "font", attrs: { name: "garamond" } }]),
        text(" big", [{ type: "fontSize", attrs: { pt: 16 } }]),
        text(" link", [{ type: "link", attrs: { href: "https://example.com" } }]),
        text(" slovensko", [{ type: "textLanguage", attrs: { lang: "sl" } }]),
        text(" line one"),
        { type: "hardBreak" },
        text("line two"),
        { type: "footnote", attrs: { text: "A note on č, š and ž." } },
      ),
      { type: "paragraph", attrs: { textAlign: "center" }, content: [text("* *")] },
      { type: "blockquote", content: [para(text("A quoted letter."))] },
      { type: "image", attrs: { src: pictureSrc, alt: "" } },
      { type: "orderedList", content: [{ type: "listItem", content: [para(text("first list"))] }] },
      para(text("between")),
      { type: "orderedList", content: [{ type: "listItem", content: [para(text("second list"))] }] },
      { type: "bulletList", content: [{ type: "listItem", content: [para(text("a bullet"))] }] },
      { type: "paragraph", attrs: { indent: 2 }, content: [text("indented")] },
      { type: "heading", attrs: { level: 1 }, content: [text("A heading inside the chapter")] },
      para(text("Čaša, šal, žaba.")),
    ],
  };
}

function book(): WordBook {
  const one = createChapter("p", "Grandmother's Keys", 0);
  one.contentJson = richChapter();
  const two = createChapter("p", "The Attic", 1);
  two.contentJson = { type: "doc", content: [para(text("Ana climbed the stairs."))] };
  two.language = "sl";
  return { title: "The Lantern House", split: true, language: "en", chapters: [one, two] };
}

/** A chapter with one comment across differently formatted words and one across two paragraphs. */
function commentedBook(): WordBook {
  const comment = (id: string, said: string) => ({ type: "comment", attrs: { id, text: said, createdAt: "2026-10-05T10:00:00.000Z" } });
  const date = comment("c-1", "Check the date");
  const long = comment("c-2", "Too long?\nCut a line");
  const chapter = createChapter("p", "The Letter", 0);
  chapter.contentJson = {
    type: "doc",
    content: [
      para(text("The letter came "), text("in March", [date]), text(" from "), text("Krško", [date, { type: "bold" }]), text(".")),
      para(text("She read it twice ", [long])),
      para(text("and put it away.", [long])),
    ],
  };
  return { title: "Comments", split: true, language: "en", chapters: [chapter] };
}

async function documentXml(bytes: Uint8Array): Promise<string> {
  return (await JSZip.loadAsync(bytes)).file("word/document.xml")!.async("string");
}

function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

type Node = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] };
function all(nodes: Node[] | undefined): Node[] {
  return (nodes ?? []).flatMap((node) => [node, ...all(node.content)]);
}
function marked(nodes: Node[], mark: string): string[] {
  return all(nodes).filter((node) => node.marks?.some((item) => item.type === mark)).map((node) => node.text ?? "");
}

describe("Word export", () => {
  it("carries every editor tool into the Word file", async () => {
    const assets = { images: new Map([[pictureSrc, { type: "png" as const, data: Buffer.from(png, "base64"), width: 1, height: 1 }]]) };
    const xml = await documentXml(await wordFile(book(), look, assets));
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:u ");
    expect(xml).toContain("<w:strike/>");
    expect(xml).toContain('w:vertAlign w:val="superscript"');
    expect(xml).toContain('w:rStyle w:val="PensieveHighlight"');
    expect(xml).toContain('w:rStyle w:val="PensieveAccent"');
    expect(xml).toContain('w:rStyle w:val="PensieveRed"');
    expect(xml).toContain('w:rStyle w:val="PensieveHighlightGreen"');
    expect(xml).toContain('w:fill="CFE8C4"');
    // Words in a font and size of their own (TOOL-6): Word's name for the font, the size in half-points.
    expect(xml).toMatch(/w:ascii="EB Garamond"[\s\S]{0,300}?> garamond</);
    expect(xml).toMatch(/<w:sz w:val="32"\/>[\s\S]{0,300}?> big</);
    expect(xml).toContain("<w:hyperlink");
    expect(xml).toContain('w:lang w:val="sl-SI"');
    expect(xml).toMatch(/line one<\/w:t>[\s\S]*?<w:br\/>[\s\S]*?line two/);
    expect(xml).toContain('w:pStyle w:val="Quote"');
    expect(xml).toContain("<w:drawing>");
    // As on the page: a chapter's title is a Heading 2, a heading in its text a Heading 3, and there is
    // no chapter label or drop cap.
    expect(xml).toMatch(/w:pStyle w:val="Heading2"\/>[\s\S]*?>The Attic</);
    expect(xml).toMatch(/w:pStyle w:val="Heading3"\/>[\s\S]*?>A heading inside the chapter</);
    expect(xml).not.toContain("PensieveChapterLabel");
    expect(xml).not.toContain("w:dropCap");
    expect(xml).toContain('<w:type w:val="nextPage"/>');
    expect(xml).toContain("<w:footnoteReference");
    const numIds = new Set([...xml.matchAll(/w:numId w:val="(\d+)"/g)].map((match) => match[1]));
    expect(numIds.size).toBe(3);
  });

  it("spaces the text as the page does: lines 1.5 apart, paragraphs a little apart and not indented", async () => {
    const zip = await JSZip.loadAsync(await wordFile(book(), look));
    const xml = await zip.file("word/document.xml")!.async("string");
    const styles = await zip.file("word/styles.xml")!.async("string");
    // At 13 pt, in twentieths of a point: lines at least 1.5 × 13 pt apart, 0.6 × 13 pt between paragraphs.
    expect(styles).toContain('w:line="390"');
    expect(xml).not.toContain("w:firstLine");
    const paragraphs = xml.split("</w:p>");
    const holding = (words: string) => paragraphs.find((paragraph) => paragraph.includes(words)) ?? "";
    // The chapter's first paragraph sits under its title; the next one has the space above it.
    expect(holding("The keys hung on a nail")).not.toContain('w:before="156"');
    expect(holding(">under<")).toContain('w:before="156"');
    // A list sits apart from the text before and after it, as on the page.
    expect(holding(">first list<")).toContain('w:before="156"');
    expect(holding(">between<")).toContain('w:before="156"');
    expect(holding(">a bullet<")).toContain('w:before="156"');
  });

  it("makes its pages A4 as wide as the page, or the sheets she writes on in Pages", async () => {
    const size = (xml: string) => xml.match(/<w:pgSz [^>]*>/)?.[0] ?? "";
    const margins = (xml: string) => xml.match(/<w:pgMar [^>]*>/)?.[0] ?? "";
    const continuous = await documentXml(await wordFile(book(), look));
    expect(size(continuous)).toContain('w:w="11906"');
    expect(size(continuous)).toContain('w:h="16838"');
    const a5 = await documentXml(await wordFile(book(), { ...look, paper: "a5" }));
    expect(size(a5)).toContain('w:w="8391"');
    expect(size(a5)).toContain('w:h="11906"');
    expect(margins(a5)).toContain('w:left="1134"');
    expect(margins(a5)).toContain('w:top="1134"');
    const a4 = await documentXml(await wordFile(book(), { ...look, paper: "a4" }));
    expect(size(a4)).toContain('w:w="11906"');
    expect(margins(a4)).toContain('w:left="1417"');
  });

  it("packs every style of the manuscript font under one family name", async () => {
    const font = new Uint8Array(64).fill(7);
    const fonts = [
      { family: "EB Garamond", face: "regular" as const, data: font },
      { family: "EB Garamond", face: "italic" as const, data: font },
    ];
    const zip = await JSZip.loadAsync(await wordFile(book(), look, { fonts }));
    const parts = Object.keys(zip.files).filter((name) => name.startsWith("word/fonts/") && name.endsWith(".odttf"));
    expect(parts).toHaveLength(2);
    // A space in a part name makes Word call the whole file corrupted.
    expect(parts.every((name) => !name.includes(" "))).toBe(true);
    const table = await zip.file("word/fontTable.xml")!.async("string");
    expect(table.match(/<w:font /g)).toHaveLength(1);
    expect(table).toContain('w:name="EB Garamond"');
    expect(table).toContain("<w:embedRegular ");
    expect(table).toContain("<w:embedItalic ");
    // Otherwise the first save in Word drops the fonts again.
    expect(await zip.file("word/settings.xml")!.async("string")).toContain("<w:embedTrueTypeFonts/>");
  });

  it("writes a part's name as Heading 1 where the part begins, and reads the parts back", async () => {
    const parted = book();
    parted.chapters = [
      { ...parted.chapters[0], part: "Part One" },
      { ...parted.chapters[1], part: "Part One" },
      { ...createChapter("p", "The Ferry", 2), part: "Part Two", contentJson: { type: "doc", content: [para(text("The ferryman waited."))] } },
    ];
    const bytes = await wordFile(parted, look);
    const xml = await documentXml(bytes);
    expect(xml.match(/w:pStyle w:val="Heading1"/g)).toHaveLength(2);
    expect(xml.indexOf(">Part One<")).toBeLessThan(xml.indexOf(">The Attic<"));
    expect(xml.indexOf(">The Attic<")).toBeLessThan(xml.indexOf(">Part Two<"));
    const result = await readWordFile(arrayBufferOf(bytes));
    expect(result.chapters.map((chapter) => [chapter.title, chapter.part])).toEqual([
      ["Grandmother's Keys", "Part One"],
      ["The Attic", "Part One"],
      ["The Ferry", "Part Two"],
    ]);
    // A part's name is neither a chapter of its own nor text in one.
    expect(result.chapters.some((chapter) => chapter.plainText.includes("Part One"))).toBe(false);
  });

  it("writes comments as Word comments around the words they cover", async () => {
    const zip = await JSZip.loadAsync(await wordFile(commentedBook(), look));
    const xml = await zip.file("word/document.xml")!.async("string");
    const comments = await zip.file("word/comments.xml")!.async("string");
    expect(comments).toContain(">Check the date<");
    expect(comments).toContain(">Cut a line<");
    for (const id of ["0", "1"]) {
      expect(xml.match(new RegExp(`<w:commentRangeStart w:id="${id}"`, "g"))).toHaveLength(1);
      expect(xml.match(new RegExp(`<w:commentRangeEnd w:id="${id}"`, "g"))).toHaveLength(1);
      // Word reads a comment's reference only inside a run.
      expect(xml).toMatch(new RegExp(`<w:r>(?:(?!</w:r>).)*<w:commentReference w:id="${id}"`));
    }
    // The first comment runs from "in March" to "Krško"; the second ends a paragraph later.
    expect(xml.indexOf('<w:commentRangeStart w:id="0"')).toBeLessThan(xml.indexOf("in March"));
    expect(xml.indexOf('<w:commentRangeEnd w:id="0"')).toBeGreaterThan(xml.indexOf("Krško"));
    expect(xml.indexOf('<w:commentRangeEnd w:id="1"')).toBeGreaterThan(xml.indexOf("and put it away."));
  });

  it("numbers footnotes in reading order, once each", async () => {
    const chapter = createChapter("p", "Notes", 0);
    chapter.contentJson = {
      type: "doc",
      content: [
        para(text("Opening"), { type: "footnote", attrs: { text: "first" } }),
        para(text("Second"), { type: "footnote", attrs: { text: "second" } }),
      ],
    };
    const zip = await JSZip.loadAsync(await wordFile({ title: "Notes", split: true, language: "en", chapters: [chapter] }, look));
    const notes = await zip.file("word/footnotes.xml")!.async("string");
    // Word's own separators aside, exactly the two notes, in the order they appear.
    expect(notes.indexOf(">first<")).toBeGreaterThan(-1);
    expect(notes.indexOf(">first<")).toBeLessThan(notes.indexOf(">second<"));
    expect(notes.match(/>second</g)).toHaveLength(1);
  });
});

describe("Word import", () => {
  it("says plainly when a Word file is empty or can't be read, not in the reader's English", async () => {
    // Explorer's New > Microsoft Word Document makes an empty file; a protected one isn't a zip at all.
    await expect(readWordFile(new ArrayBuffer(0))).rejects.toThrow("That Word file has no text to import.");
    await expect(readWordFile(new TextEncoder().encode("not a zip").buffer as ArrayBuffer)).rejects.toThrow("Pensieve couldn't read that Word file.");
  });

  it("brings a Pensieve Word file back unchanged in structure", async () => {
    const assets = { images: new Map([[pictureSrc, { type: "png" as const, data: Buffer.from(png, "base64"), width: 1, height: 1 }]]) };
    const result = await readWordFile(arrayBufferOf(await wordFile(book(), look, assets)));
    expect(result.fromPensieve).toBe(true);
    expect(result.title).toBe("The Lantern House");
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Grandmother's Keys", "The Attic"]);

    const nodes = (result.chapters[0].contentJson.content ?? []) as Node[];
    expect(result.chapters.map((chapter) => chapter.part)).toEqual(["", ""]);
    expect(result.chapters[0].plainText.startsWith("The keys hung on a nail, bold and italic")).toBe(true);
    expect(marked(nodes, "bold")).toContain("bold");
    expect(marked(nodes, "italic")).toContain("italic");
    expect(marked(nodes, "underline")).toContain("under");
    expect(marked(nodes, "strike")).toContain(" struck");
    expect(marked(nodes, "superscript")).toContain("2");
    expect(marked(nodes, "highlight")).toContain(" marked");
    expect(marked(nodes, "textColor")).toContain(" accent");
    // Each colour comes back as it went (TOOL-5): the accent and yellow of files from before, and the rest.
    const colourOf = (words: string, mark: string) => all(nodes).find((node) => node.text === words)?.marks?.find((item) => item.type === mark)?.attrs?.color;
    expect(colourOf(" accent", "textColor")).toBe("accent");
    expect(colourOf(" red", "textColor")).toBe("red");
    expect(colourOf(" marked", "highlight")).toBe("yellow");
    expect(colourOf(" green", "highlight")).toBe("green");
    // And their fonts and sizes, from a file Pensieve wrote (TOOL-6).
    const attrsOf = (words: string, mark: string) => all(nodes).find((node) => node.text === words)?.marks?.find((item) => item.type === mark)?.attrs;
    expect(attrsOf(" garamond", "font")?.name).toBe("garamond");
    expect(attrsOf(" big", "fontSize")?.pt).toBe(16);
    expect(all(nodes).filter((node) => node.marks?.some((item) => item.type === "font" || item.type === "fontSize")).map((node) => node.text)).toEqual([" garamond", " big"]);
    const link = all(nodes).find((node) => node.text === " link");
    expect(link?.marks?.find((mark) => mark.type === "link")?.attrs?.href).toBe("https://example.com");
    expect(all(nodes).some((node) => node.type === "hardBreak")).toBe(true);
    expect(nodes.find((node) => node.content?.[0]?.text === "* *")?.attrs?.textAlign).toBe("center");
    expect(nodes.some((node) => node.type === "blockquote")).toBe(true);
    expect(nodes.find((node) => node.type === "image")?.attrs?.src).toBe(pictureSrc);
    expect(nodes.filter((node) => node.type === "orderedList")).toHaveLength(2);
    expect(nodes.some((node) => node.type === "bulletList")).toBe(true);
    expect(nodes.find((node) => node.content?.[0]?.text === "indented")?.attrs?.indent).toBe(2);
    expect(nodes.find((node) => node.type === "heading")?.attrs?.level).toBe(3);
    expect(result.chapters[0].plainText).toContain("Čaša, šal, žaba.");
    expect(all(nodes).find((node) => node.type === "footnote")?.attrs?.text).toBe("A note on č, š and ž.");
    expect(result.chapters[1].plainText).toBe("Ana climbed the stairs.");
  });

  it("brings Word comments back onto the word each one ends on", async () => {
    const result = await readWordFile(arrayBufferOf(await wordFile(commentedBook(), look)));
    const nodes = all(result.chapters[0].contentJson.content as Node[]);
    const commented = nodes
      .filter((node) => node.marks?.some((mark) => mark.type === "comment"))
      .map((node) => [node.text, node.marks!.find((mark) => mark.type === "comment")!.attrs!.text]);
    expect(commented).toEqual([
      ["Krško", "Check the date"],
      ["away.", "Too long?\nCut a line"],
    ]);
    expect(result.chapters[0].plainText).toContain("The letter came in March from Krško.");
  });

  it("writes a Slovenian story collection under the stories' own titles and reads it back", async () => {
    const stories = { ...book(), split: true as const, language: "sl" as const };
    const bytes = await wordFile(stories, look);
    const xml = await documentXml(bytes);
    expect(xml).not.toContain(">Prva zgodba<");
    expect(xml).not.toContain("PensieveChapterLabel");
    const result = await readWordFile(arrayBufferOf(bytes));
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Grandmother's Keys", "The Attic"]);
  });

  it("still reads Pensieve files from before parts, with chapter labels and drop caps", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ style: "PensieveTitle", children: [new TextRun("The Lantern House")] }),
            new Paragraph({ style: "PensieveChapterLabel", children: [new TextRun("Chapter One")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("The Letter")] }),
            new Paragraph({ style: "PensieveDropCap", children: [new TextRun("T")] }),
            new Paragraph({ children: [new TextRun("he letter came on a Tuesday.")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("A heading inside")] }),
            new Paragraph({ children: [new TextRun("More text.")] }),
            new Paragraph({ style: "PensieveChapterLabel", children: [new TextRun("Chapter Two")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Fog on the Sava")] }),
            new Paragraph({ children: [new TextRun("Fog.")] }),
          ],
        },
      ],
    });
    const result = await readWordFile(arrayBufferOf(new Uint8Array(await Packer.toBuffer(doc))));
    expect(result.fromPensieve).toBe(true);
    expect(result.title).toBe("The Lantern House");
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["The Letter", "Fog on the Sava"]);
    expect(result.chapters[0].plainText.startsWith("The letter came on a Tuesday.")).toBe(true);
    const nodes = (result.chapters[0].contentJson.content ?? []) as Node[];
    expect(nodes.find((node) => node.type === "heading")?.attrs?.level).toBe(3);
    // Those files had no parts, so a book keeps its own.
    expect(result.chapters.every((chapter) => chapter.part === undefined)).toBe(true);
  });

  it("reads an article from before parts as it was written: chapters at Heading 1, no parts", async () => {
    // Articles never had chapter labels, so only the old title style tells these files apart.
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ style: "PensieveTitle", children: [new TextRun("Essay")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Intro")] }),
            new Paragraph({ children: [new TextRun("Why I write by hand.")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The pen is slow")] }),
            new Paragraph({ children: [new TextRun("Slow helps.")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Body")] }),
            new Paragraph({ children: [new TextRun("Then the keyboard.")] }),
          ],
        },
      ],
    });
    const result = await readWordFile(arrayBufferOf(new Uint8Array(await Packer.toBuffer(doc))));
    expect(result.chapters.map((chapter) => [chapter.title, chapter.part])).toEqual([
      ["Intro", undefined],
      ["Body", undefined],
    ]);
    expect((result.chapters[0].contentJson.content as Node[])[1]).toMatchObject({ type: "heading", attrs: { level: 3 } });
  });

  it("gives a part with no chapter under it an untitled one, as the page does", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ style: WORD_STYLES.title, children: [new TextRun("The Lantern House")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Book One")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Part One")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Letter")] }),
            new Paragraph({ children: [new TextRun("It came.")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Part Two")] }),
            new Paragraph({ children: [new TextRun("Text right under the part.")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Part Three")] }),
          ],
        },
      ],
    });
    const result = await readWordFile(arrayBufferOf(new Uint8Array(await Packer.toBuffer(doc))));
    expect(result.chapters.map((chapter) => [chapter.title, chapter.part])).toEqual([
      ["Untitled", "Book One"],
      ["The Letter", "Part One"],
      ["Untitled", "Part Two"],
      ["Untitled", "Part Three"],
    ]);
    expect(result.chapters[2].plainText).toBe("Text right under the part.");
  });

  it("makes headings inside a chapter subheadings in a file from elsewhere", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("One")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("A scene")] }),
            new Paragraph("Text."),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Two")] }),
            new Paragraph("More."),
          ],
        },
      ],
    });
    const result = await readWordFile(arrayBufferOf(new Uint8Array(await Packer.toBuffer(doc))));
    expect(result.fromPensieve).toBe(false);
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["One", "Two"]);
    expect((result.chapters[0].contentJson.content as Node[])[0]).toMatchObject({ type: "heading", attrs: { level: 3 } });
  });

  it("keeps an exported article in one piece", async () => {
    const article = { ...book(), split: false as const, chapters: [book().chapters[0]] };
    const result = await readWordFile(arrayBufferOf(await wordFile(article, look)));
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].title).toBe("The Lantern House");
    expect(result.chapters[0].part).toBe("");
    // A part line on the article's page goes into the file, so it comes back with it.
    const parted = { ...article, chapters: [{ ...article.chapters[0], part: "Kicker" }] };
    const back = await readWordFile(arrayBufferOf(await wordFile(parted, look)));
    expect(back.chapters.map((chapter) => [chapter.title, chapter.part])).toEqual([["The Lantern House", "Kicker"]]);
  });

  it("keeps a Heading 1 added to an article in Word, and an empty line after a part line", async () => {
    // An article edited in Word: a part line above the title, a byline, and a Heading 1 at the end.
    const article = new Document({
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Essay")] }),
            new Paragraph({ style: WORD_STYLES.articleTitle, children: [new TextRun("Why I write by hand first")] }),
            new Paragraph({ children: [new TextRun("by Eva")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The pen is slow")] }),
            new Paragraph({ children: [new TextRun("Slow helps.")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Further reading")] }),
            new Paragraph({ children: [new TextRun("Bird by Bird, Anne Lamott.")] }),
          ],
        },
      ],
    });
    const read = await readWordFile(arrayBufferOf(new Uint8Array(await Packer.toBuffer(article))));
    expect(read.chapters.map((chapter) => [chapter.title, chapter.part])).toEqual([["Why I write by hand first", "Essay"]]);
    expect(read.chapters[0].plainText).toContain("Further reading");
    const levels = (read.chapters[0].contentJson.content as Node[]).filter((node) => node.type === "heading").map((node) => node.attrs?.level);
    expect(levels).toEqual([1, 1]);
    // A book edited in Word: Enter after a new part's name leaves an empty line under it.
    const book = new Document({
      sections: [
        {
          children: [
            new Paragraph({ style: WORD_STYLES.title, children: [new TextRun("The Lantern House")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Part One")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Letter")] }),
            new Paragraph({ children: [new TextRun("It came.")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Part Two")] }),
            new Paragraph({ children: [] }),
          ],
        },
      ],
    });
    const parts = await readWordFile(arrayBufferOf(new Uint8Array(await Packer.toBuffer(book))));
    expect(parts.chapters.map((chapter) => [chapter.title, chapter.part])).toEqual([
      ["The Letter", "Part One"],
      ["Untitled", "Part Two"],
    ]);
  });

  it("keeps an article's headings at their levels, one below its title in Word, and back", async () => {
    const chapter = createChapter("p", "Why I write by hand first", 0);
    chapter.contentJson = {
      type: "doc",
      content: [
        para(text("I start on paper.")),
        { type: "heading", attrs: { level: 1 }, content: [text("The pen is slow")] },
        para(text("Slow helps.")),
        { type: "heading", attrs: { level: 2 }, content: [text("Ink")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Fountain pens")] },
        para(text("Then the keyboard.")),
      ],
    };
    const article = { title: "Why I write by hand first", split: false as const, language: "en" as const, chapters: [chapter] };
    const bytes = await wordFile(article, look);
    const xml = await documentXml(bytes);
    expect(xml).toMatch(/w:pStyle w:val="Heading2"\/>[\s\S]*?>The pen is slow</);
    expect(xml).toMatch(/w:pStyle w:val="Heading3"\/>[\s\S]*?>Ink</);
    expect(xml).toMatch(/w:pStyle w:val="Heading4"\/>[\s\S]*?>Fountain pens</);
    const result = await readWordFile(arrayBufferOf(bytes));
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].title).toBe("Why I write by hand first");
    const headings = (result.chapters[0].contentJson.content as Node[]).filter((node) => node.type === "heading");
    expect(headings.map((node) => [node.attrs?.level, node.content?.[0]?.text])).toEqual([
      [1, "The pen is slow"],
      [2, "Ink"],
      [3, "Fountain pens"],
    ]);
  });

  it("finds chapters in a hand-formatted manuscript", async () => {
    const chapterLine = (value: string) =>
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: value, bold: true, size: 32 })] });
    const doc = new Document({
      footnotes: { 1: { children: [new Paragraph("A footnote about the keys.")] } },
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Zgodbe ob reki")] }),
            chapterLine("Chapter One"),
            new Paragraph({
              children: [
                new TextRun({ text: "Plain, ", font: "EB Garamond", size: 28 }),
                new TextRun({ text: "underlined", underline: {} }),
                new TextRun(", line one"),
                new TextRun({ text: "line two", break: 1 }),
                new FootnoteReferenceRun(1),
              ],
            }),
            new Paragraph({ children: [new ExternalHyperlink({ link: "https://example.com", children: [new TextRun("a link")] })] }),
            new Table({
              rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph("cell A")] }), new TableCell({ children: [new Paragraph("cell B")] })] })],
            }),
            new Paragraph({ children: [new PageBreak()] }),
            chapterLine("Poglavje 2"),
            new Paragraph("Čaša, šal, žaba."),
          ],
        },
      ],
    });
    const result = await readWordFile(arrayBufferOf(new Uint8Array(await Packer.toBuffer(doc))));
    expect(result.fromPensieve).toBe(false);
    expect(result.title).toBe("Zgodbe ob reki");
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Chapter One", "Poglavje 2"]);
    const first = result.chapters[0];
    const nodes = (first.contentJson.content ?? []) as Node[];
    expect(marked(nodes, "underline")).toContain("underlined");
    // Another writer's fonts and sizes stay out: her words take the manuscript's, as when pasted (TOOL-6).
    expect(all(nodes).some((node) => node.marks?.some((item) => item.type === "font" || item.type === "fontSize"))).toBe(false);
    expect(first.plainText).toContain("line one\nline two");
    expect(first.plainText).toContain("cell A\tcell B");
    // A Word footnote comes back as a footnote, not as a number with a list of notes.
    expect(all(nodes).find((node) => node.type === "footnote")?.attrs?.text).toBe("A footnote about the keys.");
    expect(first.plainText).not.toContain("A footnote about the keys.");
    expect(result.chapters[1].plainText).toBe("Čaša, šal, žaba.");
  });

  it("recognises chapter lines but not ordinary sentences", () => {
    expect(looksLikeChapterTitle("Chapter 3")).toBe(true);
    expect(looksLikeChapterTitle("Poglavje tri")).toBe(true);
    expect(looksLikeChapterTitle("Prvo poglavje")).toBe(true);
    expect(looksLikeChapterTitle("3. poglavje")).toBe(true);
    expect(looksLikeChapterTitle("Četrta zgodba")).toBe(true);
    expect(looksLikeChapterTitle("Zgodba se začne pri reki.")).toBe(false);
    expect(looksLikeChapterTitle("IV")).toBe(true);
    expect(looksLikeChapterTitle("12.")).toBe(true);
    expect(looksLikeChapterTitle("Chapter one was the hardest to write.")).toBe(false);
    expect(looksLikeChapterTitle("The keys hung on a nail.")).toBe(false);
  });
});

describe("bringing Word edits back", () => {
  it("keeps each chapter's id and settings when its title matches", () => {
    const project = createWriting();
    const [first] = project.chapters;
    first.title = "The Letter";
    first.status = "final";
    first.wordGoal = 3000;
    const second = { ...createChapter(project.id, "Fog on the Sava", 1), status: "revised" as const };
    project.chapters.push(second);
    const imported = [
      { title: "Fog on the Sava", contentJson: { type: "doc", content: [] }, plainText: "fog, edited in Word" },
      { title: "The Letter", contentJson: { type: "doc", content: [] }, plainText: "letter, edited in Word" },
      { title: "A New Chapter", contentJson: { type: "doc", content: [] }, plainText: "new" },
    ];
    const next = replaceBookChapters(project, imported);
    expect(next.chapters.map((chapter) => chapter.id).slice(0, 2)).toEqual([second.id, first.id]);
    expect(next.chapters[1].status).toBe("final");
    expect(next.chapters[1].wordGoal).toBe(3000);
    expect(next.chapters[1].plainText).toBe("letter, edited in Word");
    expect(next.chapters.map((chapter) => chapter.position)).toEqual([0, 1, 2]);
    expect(next.chapters[2].id).not.toBe(first.id);
  });

  it("matches a renamed chapter by its place in the book", () => {
    const project = createWriting();
    const id = project.chapters[0].id;
    const next = replaceBookChapters(project, [{ title: "Renamed in Word", contentJson: { type: "doc", content: [] }, plainText: "" }]);
    expect(next.chapters[0].id).toBe(id);
    expect(next.chapters[0].title).toBe("Renamed in Word");
  });

  it("takes parts from a file that has them, and keeps the book's own otherwise", () => {
    const project = createWriting();
    project.chapters[0].title = "The Letter";
    project.chapters[0].part = "Part One";
    const empty = { type: "doc", content: [] };
    const kept = replaceBookChapters(project, [{ title: "The Letter", contentJson: empty, plainText: "" }]);
    expect(kept.chapters[0].part).toBe("Part One");
    const set = replaceBookChapters(project, [{ title: "The Letter", contentJson: empty, plainText: "", part: "Beginnings" }]);
    expect(set.chapters[0].part).toBe("Beginnings");
    const added = appendBookChapters(project, [{ title: "Coda", contentJson: empty, plainText: "", part: "Part Two" }]);
    expect(added.chapters.at(-1)?.part).toBe("Part Two");
  });

  it("adds imported chapters after the last one", () => {
    const project = createWriting();
    const next = appendBookChapters(project, [{ title: "Imported", contentJson: { type: "doc", content: [] }, plainText: "" }]);
    expect(next.chapters.map((chapter) => chapter.position)).toEqual([0, 1]);
  });
});
