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
import { createChapter, createProject, type DocumentJson } from "$lib/model";
import { wordFile, type WordBook, type WordLook } from "./word";
import { appendBookChapters, looksLikeChapterTitle, readWordFile, replaceBookChapters } from "./wordImport";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pictureSrc = `data:image/png;base64,${png}`;
const look: WordLook = { font: "Literata", sizePx: 17, pageWidth: "book", runningHead: true };
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
        text(" link", [{ type: "link", attrs: { href: "https://example.com" } }]),
        text(" slovensko", [{ type: "textLanguage", attrs: { lang: "sl" } }]),
        text(" line one"),
        { type: "hardBreak" },
        text("line two"),
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
  return { title: "The Lantern House", kind: "novel", language: "en", chapters: [one, two] };
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
    expect(xml).toContain("<w:hyperlink");
    expect(xml).toContain('w:lang w:val="sl-SI"');
    expect(xml).toMatch(/line one<\/w:t>[\s\S]*?<w:br\/>[\s\S]*?line two/);
    expect(xml).toContain('w:pStyle w:val="Quote"');
    expect(xml).toContain("<w:drawing>");
    expect(xml).toContain('w:pStyle w:val="PensieveChapterLabel"');
    expect(xml).toContain(">Chapter One<");
    expect(xml).toContain('w:pStyle w:val="PensieveDropCap"');
    expect(xml).toContain('w:dropCap="drop"');
    expect(xml).toContain('<w:type w:val="nextPage"/>');
    const numIds = new Set([...xml.matchAll(/w:numId w:val="(\d+)"/g)].map((match) => match[1]));
    expect(numIds.size).toBe(3);
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

  it("keeps the drop cap within two lines at every font and size", async () => {
    for (const font of ["Literata", "EB Garamond", "Courier New"]) {
      for (const sizePx of [13, 17, 24]) {
        const zip = await JSZip.loadAsync(await wordFile(book(), { ...look, font, sizePx }));
        const styles = await zip.file("word/styles.xml")!.async("string");
        const textLine = Number(/<w:pPrDefault>[\s\S]*?w:line="(\d+)"/.exec(styles)![1]);
        const cap = /<w:style [^>]*w:styleId="PensieveDropCap"[\s\S]*?<\/w:style>/.exec(styles)![0];
        const spacing = /<w:spacing [^>]*\/>/.exec(cap)![0];
        expect(spacing).toContain('w:lineRule="exact"');
        const height = Number(/w:before="(\d+)"/.exec(spacing)![1]) + Number(/w:line="(\d+)"/.exec(spacing)![1]);
        // Any taller and Word wraps a third line around the letter.
        expect(height).toBeGreaterThan(textLine);
        expect(height).toBeLessThan(2 * textLine);
      }
    }
  });
});

describe("Word import", () => {
  it("brings a Pensieve Word file back unchanged in structure", async () => {
    const assets = { images: new Map([[pictureSrc, { type: "png" as const, data: Buffer.from(png, "base64"), width: 1, height: 1 }]]) };
    const result = await readWordFile(arrayBufferOf(await wordFile(book(), look, assets)));
    expect(result.fromPensieve).toBe(true);
    expect(result.title).toBe("The Lantern House");
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Grandmother's Keys", "The Attic"]);

    const nodes = (result.chapters[0].contentJson.content ?? []) as Node[];
    // The drop cap is joined back to its paragraph.
    expect(result.chapters[0].plainText.startsWith("The keys hung on a nail, bold and italic")).toBe(true);
    expect(marked(nodes, "bold")).toContain("bold");
    expect(marked(nodes, "italic")).toContain("italic");
    expect(marked(nodes, "underline")).toContain("under");
    expect(marked(nodes, "strike")).toContain(" struck");
    expect(marked(nodes, "superscript")).toContain("2");
    expect(marked(nodes, "highlight")).toContain(" marked");
    expect(marked(nodes, "textColor")).toContain(" accent");
    const link = all(nodes).find((node) => node.text === " link");
    expect(link?.marks?.find((mark) => mark.type === "link")?.attrs?.href).toBe("https://example.com");
    expect(all(nodes).some((node) => node.type === "hardBreak")).toBe(true);
    expect(nodes.find((node) => node.content?.[0]?.text === "* *")?.attrs?.textAlign).toBe("center");
    expect(nodes.some((node) => node.type === "blockquote")).toBe(true);
    expect(nodes.find((node) => node.type === "image")?.attrs?.src).toBe(pictureSrc);
    expect(nodes.filter((node) => node.type === "orderedList")).toHaveLength(2);
    expect(nodes.some((node) => node.type === "bulletList")).toBe(true);
    expect(nodes.find((node) => node.content?.[0]?.text === "indented")?.attrs?.indent).toBe(2);
    expect(nodes.find((node) => node.type === "heading")?.attrs?.level).toBe(1);
    expect(result.chapters[0].plainText).toContain("Čaša, šal, žaba.");
    expect(result.chapters[1].plainText).toBe("Ana climbed the stairs.");
  });

  it("labels a Slovenian story collection in Slovenian and reads it back", async () => {
    const stories = { ...book(), kind: "stories" as const, language: "sl" as const };
    const bytes = await wordFile(stories, look);
    const xml = await documentXml(bytes);
    expect(xml).toContain(">Prva zgodba<");
    expect(xml).toContain(">Druga zgodba<");
    const result = await readWordFile(arrayBufferOf(bytes));
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Grandmother's Keys", "The Attic"]);
  });

  it("keeps an exported article in one piece", async () => {
    const article = { ...book(), kind: "article" as const, chapters: [book().chapters[0]] };
    const result = await readWordFile(arrayBufferOf(await wordFile(article, look)));
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].title).toBe("The Lantern House");
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
                new TextRun("Plain, "),
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
    expect(first.plainText).toContain("line one\nline two");
    expect(first.plainText).toContain("cell A\tcell B");
    expect(first.plainText).toContain("A footnote about the keys.");
    expect(marked(nodes, "superscript")).toContain("1");
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
    const project = createProject();
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
    const project = createProject();
    const id = project.chapters[0].id;
    const next = replaceBookChapters(project, [{ title: "Renamed in Word", contentJson: { type: "doc", content: [] }, plainText: "" }]);
    expect(next.chapters[0].id).toBe(id);
    expect(next.chapters[0].title).toBe("Renamed in Word");
  });

  it("adds imported chapters after the last one", () => {
    const project = createProject();
    const next = appendBookChapters(project, [{ title: "Imported", contentJson: { type: "doc", content: [] }, plainText: "" }]);
    expect(next.chapters.map((chapter) => chapter.position)).toEqual([0, 1]);
  });
});
