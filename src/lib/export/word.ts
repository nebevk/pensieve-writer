import {
  AlignmentType,
  BorderStyle,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
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
  type ICommentOptions,
  type ISectionOptions,
} from "docx";
import { APP_NAME } from "$lib/edition";
import type { Chapter, DocumentJson, WritingLanguage } from "$lib/model";
import { startsPart } from "$lib/chapters/page";
import { WORD_STYLES } from "./wordStyles";
import { HIGHLIGHTS, TEXT_COLOURS, highlightColour, textColour } from "$lib/editor/colours";
import { fontName, pointSize } from "$lib/prefs";
import { WORD_FONTS } from "./wordFonts";

/**
 * Writes a book as a Word document that looks like the page in Pensieve: the manuscript font, the
 * app's text size and line spacing, paragraphs a little apart with no indent, and each chapter on a
 * new page under its title as Heading 2, after its part's name as Heading 1 where a part begins,
 * with subheadings as Heading 3. A running head with page numbers is the one thing Word has that the
 * page doesn't.
 */

export type WordBook = {
  title: string;
  /** "Split into chapters": off, the writing is one page and keeps its headings' own levels. */
  split: boolean;
  language: WritingLanguage;
  chapters: Pick<Chapter, "title" | "position" | "contentJson" | "language" | "part">[];
};

export type WordLook = {
  /** The font name Word shows, such as "Literata". */
  font: string;
  /** The writing's text size in points, as set in Settings. */
  sizePt: number;
  pageWidth: "narrow" | "book" | "wide";
  /** The sheets she writes on (Settings → Paper → Pages): the file's pages are the same. Without, A4 as wide as the page. */
  paper?: "a4" | "a5";
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

const INK = "2A2622";
const INK_2 = "3D3731";
const ACCENT = "A94F2E";
const META = "A0968A";
const RULE = "C98A6C";

const PAGE_WIDTH = 11906; // A4, in twips
const PAGE_HEIGHT = 16838;
const SHEET_PX = { narrow: 520, book: 600, wide: 720 } as const;
const SHEET_PADDING_PX = 76;
// A4 and A5 in twips, with the margins of the sheets in Pensieve: 2.5 cm and 2 cm (see PAPER in prefs.ts).
const PAPER_TWIPS = {
  a4: { width: PAGE_WIDTH, height: PAGE_HEIGHT, margin: 1417 },
  a5: { width: 8391, height: 11906, margin: 1134 },
} as const;
const TWIPS_PER_PX = 15; // 1 CSS pixel = 0.75 pt = 15 twips
const LEADING = 1.5; // the page's line height, as a multiple of the text size
const PARAGRAPH_GAP = 0.6; // the space between two paragraphs on the page, in the same measure

type Measures = {
  halfPoints: number;
  pt: number;
  page: { width: number; height: number };
  /** The margin above and below the text. */
  top: number;
  textWidth: number;
  side: number;
  paragraphGap: number;
  indentStep: number;
};

function measures(look: WordLook): Measures {
  const pt = Math.round(look.sizePt * 2) / 2;
  const paper = look.paper ? PAPER_TWIPS[look.paper] : null;
  const textWidth = paper ? paper.width - 2 * paper.margin : (SHEET_PX[look.pageWidth] - 2 * SHEET_PADDING_PX) * TWIPS_PER_PX;
  return {
    halfPoints: Math.round(pt * 2),
    pt,
    page: paper ? { width: paper.width, height: paper.height } : { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    top: paper ? paper.margin : 1440,
    textWidth,
    side: paper ? paper.margin : Math.round((PAGE_WIDTH - textWidth) / 2),
    paragraphGap: Math.round(PARAGRAPH_GAP * pt * 20),
    indentStep: Math.round(1.5 * pt * 20),
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
  /** A one-page article, whose headings keep their levels in Word. */
  article?: boolean;
  assets: WordAssets;
  /** The chapter's language when it differs from the book's; the book's is the document default. */
  language?: { value: string };
  lists: { next: number };
  /** Word's footnotes for the whole book, numbered across chapters. */
  footnotes: { next: number; items: Record<string, { children: Paragraph[] }> };
  /** Word's comments for the whole book. */
  comments: ICommentOptions[];
  /** In this chapter: each comment's Word number once it has opened, and how many of its runs are still to come. */
  commentRuns: { numbers: Map<string, number>; left: Map<string, number> };
};

type RunOptions = Exclude<ConstructorParameters<typeof TextRun>[0], string>;
type Inline = TextRun | ExternalHyperlink | CommentRangeStart | CommentRangeEnd;

function commentIds(marks: JsonMark[] | undefined): string[] {
  return (marks ?? []).flatMap((mark) =>
    mark.type === "comment" && typeof mark.attrs?.id === "string" && mark.attrs.id ? [mark.attrs.id] : [],
  );
}

/** How many runs each comment covers, met in the same order inlines() writes them. Code blocks carry no marks. */
function commentRunCounts(nodes: JsonNode[] | undefined, counts = new Map<string, number>()): Map<string, number> {
  for (const node of nodes ?? []) {
    if (node.type === "codeBlock") continue;
    if (node.type === "text") {
      for (const id of commentIds(node.marks)) counts.set(id, (counts.get(id) ?? 0) + 1);
    } else commentRunCounts(node.content, counts);
  }
  return counts;
}

/** Word wants a comment's reference in a run of its own; docx's types leave it out of a run's children. */
function commentReference(number: number): TextRun {
  type RunChild = NonNullable<RunOptions["children"]>[number];
  return new TextRun({ children: [new CommentReference(number) as unknown as RunChild] });
}

function commentBody(mark: JsonMark): ICommentOptions["children"] {
  const lines = String(mark.attrs?.text ?? "").split(/\n+/);
  return lines.map((line) => new Paragraph({ children: [new TextRun(line)] }));
}
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
  // A run takes one character style, one per colour (TOOL-5); it lets the importer bring the mark back.
  const lit = has("highlight") ? highlightColour(marks.find((mark) => mark.type === "highlight")?.attrs?.color) : null;
  const ink = has("textColor") ? textColour(marks.find((mark) => mark.type === "textColor")?.attrs?.color) : null;
  const style = lit ? lit.style : ink ? ink.style : undefined;
  return {
    style,
    bold: has("bold") || undefined,
    italics: has("italic") || undefined,
    underline: has("underline") ? {} : undefined,
    strike: has("strike") || undefined,
    superScript: has("superscript") || undefined,
    color: ink ? ink.hex : undefined,
    shading: lit ? { type: ShadingType.CLEAR, fill: lit.hex, color: "auto" } : undefined,
    // A font and size of their own (TOOL-6), as Word names the manuscript's fonts; sizes in half-points.
    font: has("code") ? "Consolas" : has("font") ? WORD_FONTS[fontName(marks.find((mark) => mark.type === "font")?.attrs?.name)].name : undefined,
    size: has("fontSize") ? Math.round(pointSize(marks.find((mark) => mark.type === "fontSize")?.attrs?.pt) * 2) : undefined,
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
      const runs = ctx.commentRuns;
      // A comment opens before its first run and closes after its last, even in a later paragraph.
      for (const mark of marks) {
        const [id] = commentIds([mark]);
        if (!id || runs.numbers.has(id)) continue;
        closeLink();
        const number = ctx.comments.length;
        const created = new Date(String(mark.attrs?.createdAt ?? ""));
        ctx.comments.push({
          id: number,
          author: APP_NAME,
          initials: APP_NAME.split(" ").map((word) => word[0]).join(""),
          date: Number.isNaN(created.getTime()) ? new Date() : created,
          children: commentBody(mark),
        });
        runs.numbers.set(id, number);
        out.push(new CommentRangeStart(number));
      }
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
      for (const id of commentIds(marks)) {
        const left = (runs.left.get(id) ?? 1) - 1;
        runs.left.set(id, left);
        const number = runs.numbers.get(id);
        if (left > 0 || number === undefined) continue;
        closeLink();
        out.push(new CommentRangeEnd(number), commentReference(number));
      }
    } else if (node.type === "hardBreak") {
      closeLink();
      out.push(new TextRun({ text: "", break: 1, language: ctx.language }));
    } else if (node.type === "footnote") {
      closeLink();
      const id = ctx.footnotes.next;
      ctx.footnotes.next += 1;
      const text = String(node.attrs?.text ?? "");
      ctx.footnotes.items[id] = { children: [new Paragraph({ children: [new TextRun({ text, language: ctx.language })] })] };
      out.push(new FootnoteReferenceRun(id));
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
  /** Right after another paragraph, so a little space above it, as on the page. */
  spaced?: boolean;
  numbering?: ParagraphOptions["numbering"];
  extraLeft?: number;
};

function paragraph(node: JsonNode, ctx: Context, options: BlockOptions = {}): Paragraph {
  const level = Number(node.attrs?.indent ?? 0) || 0;
  const left = level * ctx.m.indentStep + (options.extraLeft ?? 0);
  return new Paragraph({
    style: options.quote ? WORD_STYLES.quote : undefined,
    alignment: alignmentOf(node.attrs?.textAlign),
    indent: left ? { left } : undefined,
    spacing: options.spaced ? { before: ctx.m.paragraphGap } : undefined,
    numbering: options.numbering,
    children: inlines(node.content, ctx),
  });
}

function heading(node: JsonNode, ctx: Context): Paragraph {
  // Inside a book's chapter every heading is a subheading: Heading 1 and 2 are parts and chapter titles.
  if (!ctx.article) {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, alignment: alignmentOf(node.attrs?.textAlign), children: inlines(node.content, ctx) });
  }
  // A one-page article keeps its levels, one below its title: Heading 1 becomes Word's Heading 2, and
  // so on. Heading 2 opens a chapter in a book, with no space above, so here it gets some.
  const level = Number(node.attrs?.level ?? 3);
  return new Paragraph({
    heading: level <= 1 ? HeadingLevel.HEADING_2 : level === 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
    spacing: level <= 1 ? { before: Math.round(ctx.m.halfPoints * 1.55) * 12 } : undefined,
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

/** A list's items as numbered or bulleted paragraphs; `spaced` puts the page's gap above the first. */
function listParagraphs(list: JsonNode, ctx: Context, level: number, quote: boolean, spaced = false): Paragraph[] {
  const ordered = list.type === "orderedList";
  const reference = ordered ? "pv-numbers" : "pv-bullets";
  // Each numbered list gets its own instance, so it starts again at 1.
  const instance = ordered ? ++ctx.lists.next : 0;
  const out: Paragraph[] = [];
  for (const item of list.content ?? []) {
    let first = true;
    let previous = "";
    for (const child of item.content ?? []) {
      if (child.type === "bulletList" || child.type === "orderedList") {
        out.push(...listParagraphs(child, ctx, Math.min(level + 1, 5), quote));
      } else if (child.type === "paragraph") {
        out.push(
          paragraph(child, ctx, {
            quote,
            numbering: first ? { reference, level, instance } : undefined,
            extraLeft: first ? 0 : listIndent(level),
            // A paragraph right after another in the same item sits apart from it, as on the page.
            spaced: out.length === 0 ? spaced : previous === "paragraph",
          }),
        );
        first = false;
      } else {
        out.push(...blocks([child], ctx, { quote }));
      }
      previous = child.type ?? "";
    }
  }
  return out;
}

function listIndent(level: number): number {
  return 360 * (level + 1);
}

function blocks(nodes: JsonNode[], ctx: Context, options: { quote?: boolean } = {}): Paragraph[] {
  const out: Paragraph[] = [];
  // What came before, for the space above: after a paragraph or a list, a paragraph sits a little apart.
  let previous = "";
  for (const node of nodes) {
    if (node.type === "paragraph") {
      out.push(paragraph(node, ctx, { quote: options.quote, spaced: previous === "paragraph" || previous === "list" }));
    } else if (node.type === "heading") {
      out.push(heading(node, ctx));
    } else if (node.type === "blockquote") {
      out.push(...blocks(node.content ?? [], ctx, { quote: true }));
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      out.push(...listParagraphs(node, ctx, 0, options.quote ?? false, previous !== ""));
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
      out.push(...blocks(node.content, ctx, { quote: options.quote }));
    }
    previous = node.type === "bulletList" || node.type === "orderedList" ? "list" : (node.type ?? "");
  }
  return out;
}

/** A chapter's text, in reading order and once each, so footnotes and comments are numbered as they appear. */
function chapterBody(doc: DocumentJson, ctx: Context): Paragraph[] {
  return blocks((doc.content ?? []) as JsonNode[], ctx);
}

/** The part's name as Heading 1, where chapter `index` begins a part. */
function partLine(chapters: WordBook["chapters"], index: number): Paragraph[] {
  if (!startsPart(chapters, index)) return [];
  return [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(chapters[index].part.trim())] })];
}

/** A chapter's title as Heading 2, after its part's name as Heading 1 where a part begins. */
function chapterHead(chapters: WordBook["chapters"], index: number): Paragraph[] {
  return [...partLine(chapters, index), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(chapters[index].title)] })];
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
    size: m.page,
    margin: { top: m.top, bottom: m.top, left: m.side, right: m.side, header: 720, footer: 720 },
  };
  const lists = { next: 0 };
  const footnotes: Context["footnotes"] = { next: 1, items: {} };
  const comments: ICommentOptions[] = [];
  const chapters = [...book.chapters].sort((a, b) => a.position - b.position);
  const article = !book.split && chapters.length === 1;
  const contextFor = (chapter: WordBook["chapters"][number]): Context => ({
    m,
    article,
    assets,
    lists,
    footnotes,
    comments,
    commentRuns: { numbers: new Map(), left: commentRunCounts(chapter.contentJson.content as JsonNode[] | undefined) },
    language:
      chapter.language && chapter.language !== book.language ? { value: languageTag(chapter.language) } : undefined,
  });
  const headers = look.runningHead ? { default: runningHead(book.title, m), first: new Header({ children: [] }) } : undefined;

  let sections: ISectionOptions[];
  if (!book.split) {
    sections = [
      {
        properties: { page },
        headers,
        children: [
          ...(article ? partLine(chapters, 0) : []),
          new Paragraph({ style: article ? WORD_STYLES.articleTitle : WORD_STYLES.title, children: [new TextRun(book.title)] }),
          ...chapters.flatMap((chapter, index) => [
            ...(chapters.length > 1 ? chapterHead(chapters, index) : []),
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
          children: [...chapterHead(chapters, index), ...chapterBody(chapter.contentJson, contextFor(chapter))],
        }),
      ),
    ];
  }

  const font = look.font;
  const headingRun = (size: number) => ({ font, size, bold: false, italics: false, color: INK });
  const headingSpacing = (size: number) => ({ before: Math.round(size * 12), after: Math.round(size * 4), line: 300 });
  const partSize = Math.round(m.halfPoints * 1.9);
  const chapterSize = Math.round(m.halfPoints * 1.55);
  const subheadingSize = Math.round(m.halfPoints * 1.2);
  const bulletGlyphs = ["•", "◦", "▪"];
  const numberFormats = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];

  return new Document({
    title: book.title,
    footnotes: footnotes.items,
    comments: comments.length > 0 ? { children: comments } : undefined,
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
        // A part's name and a chapter's title open a page, so they have no space above.
        heading1: { run: headingRun(partSize), paragraph: { spacing: { before: 0, after: Math.round(partSize * 6), line: 300 }, keepNext: true } },
        heading2: { run: headingRun(chapterSize), paragraph: { spacing: { before: 0, after: Math.round(chapterSize * 6), line: 300 }, keepNext: true } },
        heading3: { run: headingRun(subheadingSize), paragraph: { spacing: headingSpacing(subheadingSize), keepNext: true } },
        // An article's Heading 3, one below its Heading 2.
        heading4: { run: headingRun(m.halfPoints), paragraph: { spacing: headingSpacing(m.halfPoints), keepNext: true } },
        hyperlink: { run: { color: ACCENT, underline: {} } },
      },
      paragraphStyles: [
        // Word's Title, under a name that tells the importer this file came from Pensieve (or Hushed Tales, IMP-29).
        { id: WORD_STYLES.title, name: `${APP_NAME} Book Title`, basedOn: "Title", next: "Normal" },
        { id: WORD_STYLES.articleTitle, name: `${APP_NAME} Article Title`, basedOn: "Title", next: "Normal" },
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
      // A character style for each highlight and text colour (TOOL-5): yellow's and the accent's are the
      // Pensieve Highlight and Pensieve Accent of files written before.
      characterStyles: [
        ...HIGHLIGHTS.map((lit) => ({
          id: lit.style,
          name: lit.styleName,
          basedOn: "DefaultParagraphFont",
          run: { shading: { type: ShadingType.CLEAR, fill: lit.hex, color: "auto" } },
        })),
        ...TEXT_COLOURS.map((ink) => ({ id: ink.style, name: ink.styleName, basedOn: "DefaultParagraphFont", run: { color: ink.hex } })),
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
