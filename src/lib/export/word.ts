import {
  AlignmentType,
  BorderStyle,
  Document,
  DropCapType,
  ExternalHyperlink,
  FrameAnchorType,
  FrameWrap,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  ShadingType,
  TabStopType,
  TextRun,
  type ISectionOptions,
} from "docx";
import type { Chapter, DocumentJson, Project, WritingLanguage } from "$lib/model";
import { chapterName } from "$lib/chapters/labels";

/**
 * Writes a book as a Word document that looks like the page in Pensieve: the manuscript font,
 * the app's size and spacing, first-line indents, a drop cap, each chapter on a new page with
 * its label, and a running head with page numbers.
 */

export type WordBook = {
  title: string;
  kind: Project["kind"];
  language: WritingLanguage;
  chapters: Pick<Chapter, "title" | "position" | "contentJson" | "language">[];
};

export type WordLook = {
  /** The font name Word shows, such as "Literata". */
  font: string;
  /** Manuscript text size in CSS pixels, as set in Settings. */
  sizePx: number;
  pageWidth: "narrow" | "book" | "wide";
  runningHead: boolean;
};

export type WordImage = { type: "jpg" | "png" | "gif" | "bmp"; data: Uint8Array; width: number; height: number };

export type FontFace = "regular" | "bold" | "italic" | "boldItalic";

/** One style of a font family, from a static (not variable) TrueType file; Word ignores variable fonts. */
export type WordFont = { family: string; face: FontFace; data: Uint8Array };

export type WordAssets = {
  /** Fonts packed into the file, so it looks the same on computers that don't have them. */
  fonts?: WordFont[];
  /** Pictures by their `src`, measured and in a format Word reads. */
  images?: Map<string, WordImage>;
};

/** Paragraph and character styles the importer recognises when a Pensieve file comes back. */
export const WORD_STYLES = {
  title: "PensieveTitle",
  chapterLabel: "PensieveChapterLabel",
  dropCap: "PensieveDropCap",
  quote: "Quote",
  highlight: "PensieveHighlight",
  accent: "PensieveAccent",
} as const;

const INK = "2A2622";
const INK_2 = "3D3731";
const ACCENT = "A94F2E";
const META = "A0968A";
const RULE = "C98A6C";
const HIGHLIGHT = "F2DC8F";

const PAGE_WIDTH = 11906; // A4, in twips
const PAGE_HEIGHT = 16838;
const SHEET_PX = { narrow: 520, book: 600, wide: 720 } as const;
const SHEET_PADDING_PX = 76;
const TWIPS_PER_PX = 15; // 1 CSS pixel = 0.75 pt = 15 twips
const LEADING = 1.85; // the page's line height, as a multiple of the text size

type DropCap = { size: number; before: number; line: number; lower: number };

/**
 * What Word itself sets for a two-line drop cap at LEADING, per point of text size: the letter's
 * size and how far it is lowered (half-points), the space before it and its exact line height
 * (twips). Measured in Word; anything taller pushes the letter's frame into a third line.
 */
const DROP_CAPS: Record<string, DropCap> = {
  Literata: { size: 6.22, before: 7.3, line: 59.4, lower: 0.56 },
  "EB Garamond": { size: 5.8, before: 10.9, line: 52.16, lower: 0.42 },
  "Courier New": { size: 6.39, before: 14.32, line: 45.3, lower: 0.32 },
};

type Measures = {
  halfPoints: number;
  pt: number;
  textWidth: number;
  side: number;
  firstLine: number;
  indentStep: number;
  dropCap: DropCap;
};

function measures(look: WordLook): Measures {
  const pt = Math.round(look.sizePx * 0.75 * 2) / 2;
  const textWidth = (SHEET_PX[look.pageWidth] - 2 * SHEET_PADDING_PX) * TWIPS_PER_PX;
  const cap = DROP_CAPS[look.font] ?? DROP_CAPS.Literata;
  return {
    halfPoints: Math.round(pt * 2),
    pt,
    textWidth,
    side: Math.round((PAGE_WIDTH - textWidth) / 2),
    firstLine: Math.round(1.6 * pt * 20),
    indentStep: Math.round(1.5 * pt * 20),
    dropCap: {
      size: Math.round(cap.size * pt),
      before: Math.round(cap.before * pt),
      line: Math.round(cap.line * pt),
      lower: Math.round(cap.lower * pt),
    },
  };
}

export function languageTag(language: WritingLanguage): string {
  return language === "sl" ? "sl-SI" : "en-US";
}

type JsonMark = { type?: string; attrs?: Record<string, unknown> };
type JsonNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: JsonMark[];
  content?: JsonNode[];
};

type Context = {
  m: Measures;
  assets: WordAssets;
  /** The chapter's language when it differs from the book's; the book's is the document default. */
  language?: { value: string };
  lists: { next: number };
};

type RunOptions = Exclude<ConstructorParameters<typeof TextRun>[0], string>;
type Inline = TextRun | ExternalHyperlink;
type ParagraphOptions = Exclude<ConstructorParameters<typeof Paragraph>[0], string>;

function alignmentOf(value: unknown) {
  if (value === "center") return AlignmentType.CENTER;
  if (value === "right") return AlignmentType.RIGHT;
  if (value === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

function runOptions(marks: JsonMark[], ctx: Context): RunOptions {
  const has = (type: string) => marks.some((mark) => mark.type === type);
  const lang = marks.find((mark) => mark.type === "textLanguage")?.attrs?.lang;
  const language = lang === "sl" || lang === "en" ? { value: languageTag(lang) } : ctx.language;
  // A run takes one character style; it lets the importer bring the mark back.
  const style = has("highlight") ? WORD_STYLES.highlight : has("textColor") ? WORD_STYLES.accent : undefined;
  return {
    style,
    bold: has("bold") || undefined,
    italics: has("italic") || undefined,
    underline: has("underline") ? {} : undefined,
    strike: has("strike") || undefined,
    superScript: has("superscript") || undefined,
    color: has("textColor") ? ACCENT : undefined,
    shading: has("highlight") ? { type: ShadingType.CLEAR, fill: HIGHLIGHT, color: "auto" } : undefined,
    font: has("code") ? "Consolas" : undefined,
    language,
  };
}

function inlines(nodes: JsonNode[] | undefined, ctx: Context): Inline[] {
  const out: Inline[] = [];
  let link: { href: string; runs: TextRun[] } | null = null;
  const closeLink = () => {
    if (link) out.push(new ExternalHyperlink({ link: link.href, children: link.runs }));
    link = null;
  };
  for (const node of nodes ?? []) {
    if (node.type === "text") {
      const marks = node.marks ?? [];
      const href = marks.find((mark) => mark.type === "link")?.attrs?.href;
      if (typeof href === "string" && href) {
        if (!link || link.href !== href) {
          closeLink();
          link = { href, runs: [] };
        }
        link.runs.push(new TextRun({ text: node.text ?? "", ...runOptions(marks, ctx), style: "Hyperlink" }));
      } else {
        closeLink();
        out.push(new TextRun({ text: node.text ?? "", ...runOptions(marks, ctx) }));
      }
    } else if (node.type === "hardBreak") {
      closeLink();
      out.push(new TextRun({ text: "", break: 1, language: ctx.language }));
    } else {
      closeLink();
      out.push(...inlines(node.content, ctx));
    }
  }
  closeLink();
  return out;
}

type BlockOptions = {
  quote?: boolean;
  firstLine?: boolean;
  numbering?: ParagraphOptions["numbering"];
  extraLeft?: number;
};

function paragraph(node: JsonNode, ctx: Context, options: BlockOptions = {}): Paragraph {
  const alignment = alignmentOf(node.attrs?.textAlign);
  const leftAligned = alignment === undefined || alignment === AlignmentType.JUSTIFIED;
  const level = Number(node.attrs?.indent ?? 0) || 0;
  const left = level * ctx.m.indentStep + (options.extraLeft ?? 0);
  const firstLine = options.firstLine && leftAligned ? ctx.m.firstLine : undefined;
  return new Paragraph({
    style: options.quote ? WORD_STYLES.quote : undefined,
    alignment,
    indent: left || firstLine ? { left: left || undefined, firstLine } : undefined,
    numbering: options.numbering,
    children: inlines(node.content, ctx),
  });
}

function heading(node: JsonNode, ctx: Context): Paragraph {
  const level = Number(node.attrs?.level ?? 1);
  // Chapter titles are Heading 1, so headings inside a chapter sit one level below.
  const style = level <= 1 ? HeadingLevel.HEADING_2 : level === 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4;
  return new Paragraph({
    heading: style,
    alignment: alignmentOf(node.attrs?.textAlign),
    children: inlines(node.content, ctx),
  });
}

function picture(node: JsonNode, ctx: Context): Paragraph {
  const image = ctx.assets.images?.get(String(node.attrs?.src ?? ""));
  if (!image) return new Paragraph({ children: [new TextRun({ text: "[Picture]", color: META })] });
  const maxWidth = Math.floor(ctx.m.textWidth / TWIPS_PER_PX);
  const scale = Math.min(1, maxWidth / Math.max(1, image.width));
  return new Paragraph({
    children: [
      new ImageRun({
        type: image.type,
        data: image.data,
        transformation: {
          width: Math.max(1, Math.round(image.width * scale)),
          height: Math.max(1, Math.round(image.height * scale)),
        },
      }),
    ],
  });
}

function listParagraphs(list: JsonNode, ctx: Context, level: number, quote: boolean): Paragraph[] {
  const ordered = list.type === "orderedList";
  const reference = ordered ? "pv-numbers" : "pv-bullets";
  // Each numbered list gets its own instance, so it starts again at 1.
  const instance = ordered ? ++ctx.lists.next : 0;
  const out: Paragraph[] = [];
  for (const item of list.content ?? []) {
    let first = true;
    for (const child of item.content ?? []) {
      if (child.type === "bulletList" || child.type === "orderedList") {
        out.push(...listParagraphs(child, ctx, Math.min(level + 1, 5), quote));
      } else if (child.type === "paragraph") {
        out.push(
          paragraph(child, ctx, {
            quote,
            numbering: first ? { reference, level, instance } : undefined,
            extraLeft: first ? 0 : listIndent(level),
          }),
        );
        first = false;
      } else {
        out.push(...blocks([child], ctx, { quote }));
      }
    }
  }
  return out;
}

function listIndent(level: number): number {
  return 360 * (level + 1);
}

function blocks(nodes: JsonNode[], ctx: Context, options: { quote?: boolean } = {}): Paragraph[] {
  const out: Paragraph[] = [];
  let previousParagraph = false;
  for (const node of nodes) {
    if (node.type === "paragraph") {
      out.push(paragraph(node, ctx, { quote: options.quote, firstLine: previousParagraph }));
    } else if (node.type === "heading") {
      out.push(heading(node, ctx));
    } else if (node.type === "blockquote") {
      out.push(...blocks(node.content ?? [], ctx, { quote: true }));
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      out.push(...listParagraphs(node, ctx, 0, options.quote ?? false));
    } else if (node.type === "image") {
      out.push(picture(node, ctx));
    } else if (node.type === "horizontalRule") {
      out.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: META, space: 1 } },
          spacing: { before: 280, after: 280 },
        }),
      );
    } else if (node.type === "codeBlock") {
      const lines = (node.content ?? []).map((child) => child.text ?? "").join("").split("\n");
      out.push(
        new Paragraph({
          children: lines.map(
            (line, index) => new TextRun({ text: line, font: "Consolas", break: index > 0 ? 1 : undefined }),
          ),
        }),
      );
    } else if (node.content) {
      out.push(...blocks(node.content, ctx, options));
    }
    previousParagraph = node.type === "paragraph";
  }
  return out;
}

const OPENING_PUNCTUATION = /^[“”"‘’'«»„‚(\[]*/u;

/** The first paragraph of a chapter opens with a drop cap, as on the page. */
function openingParagraphs(node: JsonNode, ctx: Context): Paragraph[] {
  const content = structuredClone(node.content ?? []);
  const first = content.find((child) => child.type === "text" && child.text);
  const alignment = alignmentOf(node.attrs?.textAlign);
  const text = first?.text ?? "";
  const lead = text.match(OPENING_PUNCTUATION)?.[0] ?? "";
  const letter = [...text.slice(lead.length)][0] ?? "";
  if (!first || content[0] !== first || !/\p{L}/u.test(letter) || (alignment && alignment !== AlignmentType.JUSTIFIED)) {
    return [paragraph(node, ctx)];
  }
  first.text = text.slice(lead.length + letter.length);
  const cap = lead + letter;
  return [
    new Paragraph({
      style: WORD_STYLES.dropCap,
      frame: {
        type: "absolute",
        position: { x: 0, y: 0 },
        width: 0,
        height: 0,
        anchor: { horizontal: FrameAnchorType.TEXT, vertical: FrameAnchorType.TEXT },
        dropCap: DropCapType.DROP,
        lines: 2,
        wrap: FrameWrap.AROUND,
      },
      children: [new TextRun({ text: cap, language: ctx.language })],
    }),
    paragraph({ ...node, content }, ctx),
  ];
}

function chapterBody(doc: DocumentJson, ctx: Context): Paragraph[] {
  const nodes = (doc.content ?? []) as JsonNode[];
  if (nodes[0]?.type !== "paragraph") return blocks(nodes, ctx);
  const [opening, ...rest] = nodes;
  const after = blocks(rest, ctx);
  // The paragraph after the opening is indented, as on the page.
  if (rest[0]?.type === "paragraph") after.splice(0, 1, paragraph(rest[0], ctx, { firstLine: true }));
  return [...openingParagraphs(opening, ctx), ...after];
}

function runningHead(title: string, m: Measures): Header {
  const look = { size: 16, color: META, characterSpacing: 26 };
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: m.textWidth }],
        children: [
          new TextRun({ text: title, allCaps: true, ...look }),
          new TextRun({ children: ["\t", PageNumber.CURRENT], ...look }),
        ],
      }),
    ],
  });
}

export function buildWordDocument(book: WordBook, look: WordLook, assets: WordAssets = {}): Document {
  const m = measures(look);
  const page = {
    size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    margin: { top: 1440, bottom: 1440, left: m.side, right: m.side, header: 720, footer: 720 },
  };
  const lists = { next: 0 };
  const chapters = [...book.chapters].sort((a, b) => a.position - b.position);
  const contextFor = (chapter: WordBook["chapters"][number]): Context => ({
    m,
    assets,
    lists,
    language:
      chapter.language && chapter.language !== book.language ? { value: languageTag(chapter.language) } : undefined,
  });
  const headers = look.runningHead ? { default: runningHead(book.title, m), first: new Header({ children: [] }) } : undefined;

  let sections: ISectionOptions[];
  if (book.kind === "article") {
    sections = [
      {
        properties: { page },
        headers,
        children: [
          new Paragraph({ style: WORD_STYLES.title, children: [new TextRun(book.title)] }),
          ...chapters.flatMap((chapter) => [
            ...(chapters.length > 1
              ? [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(chapter.title)] })]
              : []),
            ...chapterBody(chapter.contentJson, contextFor(chapter)),
          ]),
        ],
      },
    ];
  } else {
    sections = [
      {
        properties: { page, verticalAlign: "center" },
        children: [new Paragraph({ style: WORD_STYLES.title, children: [new TextRun(book.title)] })],
      },
      ...chapters.map(
        (chapter, index): ISectionOptions => ({
          properties: { page, type: SectionType.NEXT_PAGE, titlePage: true },
          headers,
          children: [
            new Paragraph({ style: WORD_STYLES.chapterLabel, children: [new TextRun(chapterName(index))] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(chapter.title)] }),
            ...chapterBody(chapter.contentJson, contextFor(chapter)),
          ],
        }),
      ),
    ];
  }

  const font = look.font;
  const headingRun = (size: number) => ({ font, size, bold: false, italics: false, color: INK });
  const headingSpacing = (size: number) => ({ before: Math.round(size * 12), after: Math.round(size * 4), line: 300 });
  const bulletGlyphs = ["•", "◦", "▪"];
  const numberFormats = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];

  return new Document({
    title: book.title,
    // Each style gets its own part with a space-free name; fontTable() then joins them into one family.
    fonts: assets.fonts?.map((entry) => ({ name: fontPartName(entry), data: entry.data as unknown as Buffer })),
    styles: {
      default: {
        document: {
          run: { font, size: m.halfPoints, color: INK, language: { value: languageTag(book.language) } },
          // At least the page's line height, so pictures and drop caps can still take more room.
          paragraph: { spacing: { line: Math.round(LEADING * m.pt * 20), lineRule: LineRuleType.AT_LEAST, before: 0, after: 0 } },
        },
        title: {
          run: { font, size: 56, bold: false, color: INK },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240, line: 300 } },
        },
        heading1: {
          run: headingRun(42),
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 660, line: 300 }, keepNext: true },
        },
        heading2: { run: headingRun(m.halfPoints * 2), paragraph: { spacing: headingSpacing(m.halfPoints * 2), keepNext: true } },
        heading3: {
          run: headingRun(Math.round(m.halfPoints * 1.5)),
          paragraph: { spacing: headingSpacing(Math.round(m.halfPoints * 1.5)), keepNext: true },
        },
        heading4: {
          run: headingRun(Math.round(m.halfPoints * 1.17)),
          paragraph: { spacing: headingSpacing(Math.round(m.halfPoints * 1.17)), keepNext: true },
        },
        hyperlink: { run: { color: ACCENT, underline: {} } },
      },
      paragraphStyles: [
        // Word's Title, under a name that tells the importer this file came from Pensieve.
        { id: WORD_STYLES.title, name: "Pensieve Title", basedOn: "Title", next: "Normal" },
        {
          id: WORD_STYLES.chapterLabel,
          name: "Chapter Label",
          basedOn: "Normal",
          next: "Heading1",
          quickFormat: true,
          run: { allCaps: true, size: 18, color: ACCENT, characterSpacing: 36 },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 1440, after: 180, line: 240 }, keepNext: true },
        },
        {
          id: WORD_STYLES.dropCap,
          name: "Drop Cap",
          basedOn: "Normal",
          next: "Normal",
          run: { color: ACCENT, size: m.dropCap.size, position: `-${m.dropCap.lower / 2}pt` },
          paragraph: {
            keepNext: true,
            spacing: { before: m.dropCap.before, line: m.dropCap.line, lineRule: LineRuleType.EXACT },
          },
        },
        {
          id: WORD_STYLES.quote,
          name: "Quote",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { color: INK_2 },
          paragraph: {
            indent: { left: 400 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: RULE, space: 8 } },
            spacing: { before: 120, after: 120 },
          },
        },
      ],
      characterStyles: [
        {
          id: WORD_STYLES.highlight,
          name: "Pensieve Highlight",
          basedOn: "DefaultParagraphFont",
          run: { shading: { type: ShadingType.CLEAR, fill: HIGHLIGHT, color: "auto" } },
        },
        { id: WORD_STYLES.accent, name: "Pensieve Accent", basedOn: "DefaultParagraphFont", run: { color: ACCENT } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "pv-bullets",
          levels: [0, 1, 2, 3, 4, 5].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: bulletGlyphs[level % 3],
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: listIndent(level), hanging: 280 } } },
          })),
        },
        {
          reference: "pv-numbers",
          levels: [0, 1, 2, 3, 4, 5].map((level) => ({
            level,
            format: numberFormats[level % 3],
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: listIndent(level), hanging: 360 } } },
          })),
        },
      ],
    },
    sections,
  });
}

const FACE_ELEMENTS: Record<FontFace, string> = {
  regular: "w:embedRegular",
  bold: "w:embedBold",
  italic: "w:embedItalic",
  boldItalic: "w:embedBoldItalic",
};

/** Part names inside the .docx can't contain spaces, or Word calls the file corrupted. */
function fontPartName(font: WordFont): string {
  return `${font.family.replace(/[^A-Za-z0-9]/g, "")}-${font.face}`;
}

/** The PANOSE numbers from the font's OS/2 table, which Word uses to pick a similar font if needed. */
function panose(data: Uint8Array): string | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.byteLength < 12) return null;
  const tables = view.getUint16(4);
  for (let index = 0; index < tables; index += 1) {
    const record = 12 + index * 16;
    if (record + 16 > data.byteLength) return null;
    const tag = String.fromCharCode(...data.subarray(record, record + 4));
    if (tag !== "OS/2") continue;
    const offset = view.getUint32(record + 8) + 32;
    if (offset + 10 > data.byteLength) return null;
    return [...data.subarray(offset, offset + 10)].map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join("");
  }
  return null;
}

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/**
 * Word's font table with one entry per family that points at all its embedded styles.
 * The docx library would write one entry per file, which Word can't use as a family.
 */
function fontTable(document: Document, fonts: WordFont[]): string {
  const keys = document.FontTable.fontOptionsWithKey;
  const families = [...new Set(fonts.map((font) => font.family))];
  const entries = families.map((family) => {
    const faces = fonts
      .map((font, index) => ({ font, id: `rId${index + 1}`, key: keys[index].fontKey }))
      .filter(({ font }) => font.family === family);
    const regular = faces.find(({ font }) => font.face === "regular");
    const numbers = regular ? panose(regular.font.data) : null;
    const embeds = (["regular", "bold", "italic", "boldItalic"] as FontFace[]).flatMap((face) => {
      const match = faces.find(({ font }) => font.face === face);
      return match ? [`<${FACE_ELEMENTS[face]} r:id="${match.id}" w:fontKey="{${match.key.toUpperCase()}}"/>`] : [];
    });
    return [
      `<w:font w:name="${escapeXml(family)}">`,
      numbers ? `<w:panose1 w:val="${numbers}"/>` : "",
      '<w:family w:val="roman"/><w:pitch w:val="variable"/>',
      ...embeds,
      "</w:font>",
    ].join("");
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    entries.join("") +
    "</w:fonts>"
  );
}

/**
 * The docx library's settings plus "Embed fonts in the file", so Word packs the fonts in again
 * when the file is saved there. Without it, the first save in Word drops them.
 */
const SETTINGS_EMBEDDING_FONTS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:displayBackgroundShape/><w:embedTrueTypeFonts/>" +
  '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
  "</w:settings>";

export async function wordFile(book: WordBook, look: WordLook, assets: WordAssets = {}): Promise<Uint8Array> {
  const document = buildWordDocument(book, look, assets);
  const fonts = assets.fonts ?? [];
  const overrides =
    fonts.length > 0
      ? [
          { path: "word/fontTable.xml", data: fontTable(document, fonts) },
          { path: "word/settings.xml", data: SETTINGS_EMBEDDING_FONTS },
        ]
      : [];
  return new Uint8Array(await Packer.toArrayBuffer(document, false, overrides));
}
