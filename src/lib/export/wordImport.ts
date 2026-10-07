import type { MammothDocument, MammothElement } from "mammoth";
import { createChapter, emptyDocument, type Chapter, type DocumentJson, type Writing } from "$lib/model";
import { WORD_STYLES } from "./wordStyles";
import { t } from "$lib/ui.svelte";

/** A chapter read from a Word file, ready to become part of a book. */
export type ImportedChapter = {
  title: string;
  contentJson: DocumentJson;
  plainText: string;
  /** The part it is in, when the file says: Pensieve's own files, where a Heading 1 begins a part. */
  part?: string;
};

export type WordImport = {
  /** The document's Title paragraph, or "" when it has none. */
  title: string;
  chapters: ImportedChapter[];
  /** True when the file was written by Pensieve, so its structure maps back exactly. */
  fromPensieve: boolean;
};

type JsonMark = { type: string; attrs?: Record<string, unknown> };
type JsonNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
  marks?: JsonMark[];
};

const PICTURE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]);

/** Reads a .docx file into chapters. */
export async function readWordFile(data: ArrayBuffer, fallbackTitle = "Imported"): Promise<WordImport> {
  // Explorer's New > Microsoft Word Document makes an empty file: nothing to read, and no zip to open.
  if (data.byteLength === 0) throw new Error(t("errWordEmpty"));
  const mammoth = await import("mammoth");
  const captured: { document: MammothDocument | null } = { document: null };
  // The app runs mammoth's browser build, which reads an ArrayBuffer; under Node (tests) it needs a Buffer.
  const input = typeof window === "undefined" ? { buffer: Buffer.from(data) } : { arrayBuffer: data };
  try {
    await mammoth.convertToHtml(input, {
      transformDocument: (document) => {
        captured.document = document;
        return document;
      },
    });
  } catch {
    // A password-protected, damaged or renamed file: the reader says so in technical English.
    throw new Error(t("errWordUnreadable"));
  }
  if (!captured.document) throw new Error(t("errWordUnreadable"));
  return wordToChapters(captured.document, await readPictures(captured.document), fallbackTitle);
}

async function readPictures(document: MammothDocument): Promise<Map<MammothElement, string>> {
  const found: MammothElement[] = [];
  const walk = (element: MammothElement) => {
    if (element.type === "image") found.push(element);
    element.children?.forEach(walk);
  };
  walk(document);
  const pictures = new Map<MammothElement, string>();
  for (const image of found) {
    if (!PICTURE_TYPES.has(image.contentType ?? "")) continue;
    try {
      const base64 = await image.readAsBase64String?.();
      if (base64) pictures.set(image, `data:${image.contentType};base64,${base64}`);
    } catch {
      // A picture Pensieve can't read is left out; the text still comes in.
    }
  }
  return pictures;
}

function headingLevel(paragraph: MammothElement): number | null {
  const match = /^heading\s*(\d)$/i.exec(paragraph.styleName ?? "") ?? /^heading(\d)$/i.exec(paragraph.styleId ?? "");
  return match ? Number(match[1]) : null;
}

const isBookTitle = (p: MammothElement) => p.styleId === WORD_STYLES.title || p.styleName === "Pensieve Book Title";
const isOldTitle = (p: MammothElement) => p.styleId === WORD_STYLES.oldTitle || p.styleName === "Pensieve Title";
const isArticleTitle = (p: MammothElement) => p.styleId === WORD_STYLES.articleTitle || p.styleName === "Pensieve Article Title";
const isPensieveTitle = (p: MammothElement) => isBookTitle(p) || isOldTitle(p) || isArticleTitle(p);
const isTitle = (p: MammothElement) => isPensieveTitle(p) || /^title$/i.test(p.styleName ?? "") || p.styleId === "Title";
const isLabel = (p: MammothElement) => p.styleId === WORD_STYLES.chapterLabel || p.styleName === "Chapter Label";
const isDropCap = (p: MammothElement) => p.styleId === WORD_STYLES.dropCap || p.styleName === "Drop Cap";
const isQuote = (p: MammothElement) => /^(intense )?quote$/i.test(p.styleName ?? "") || p.styleId === "Quote";

const CHAPTER_LINE = /^(chapter|poglavje|prologue|prolog|epilogue|epilog)\b/i;
// Slovenian puts the number first: "Prvo poglavje", "3. poglavje", "Prva zgodba".
const SLOVENIAN_LABEL = /^(\d{1,3}\.|\p{L}+)\s+(poglavje|zgodba)$/iu;
const NUMBER_LINE = /^(\d{1,3}|[IVXLCDM]{1,8})\.?$/;

/** A short line such as "Chapter 3", "Prvo poglavje" or "IV", in a file without heading styles. */
export function looksLikeChapterTitle(text: string): boolean {
  const line = text.trim();
  if (!line || line.length > 60) return false;
  if (NUMBER_LINE.test(line) || SLOVENIAN_LABEL.test(line)) return true;
  return CHAPTER_LINE.test(line) && !/[.!?]$/.test(line);
}

function plainOf(element: MammothElement): string {
  if (element.type === "text") return element.value ?? "";
  if (element.type === "tab") return "\t";
  if (element.type === "break") return element.breakType === "line" ? "\n" : "";
  return (element.children ?? []).map(plainOf).join("");
}

function withMark(marks: JsonMark[], mark: JsonMark): JsonMark[] {
  return [...marks.filter((item) => item.type !== mark.type), mark];
}

function runMarks(run: MammothElement, marks: JsonMark[]): JsonMark[] {
  let next = marks;
  if (run.isBold) next = withMark(next, { type: "bold" });
  if (run.isItalic) next = withMark(next, { type: "italic" });
  if (run.isUnderline) next = withMark(next, { type: "underline" });
  if (run.isStrikethrough) next = withMark(next, { type: "strike" });
  if (run.verticalAlignment === "superscript") next = withMark(next, { type: "superscript" });
  if (run.highlight || run.styleId === WORD_STYLES.highlight || run.styleName === "Pensieve Highlight") {
    next = withMark(next, { type: "highlight" });
  }
  if (run.styleId === WORD_STYLES.accent || run.styleName === "Pensieve Accent") next = withMark(next, { type: "textColor" });
  return next;
}

function textNode(text: string, marks: JsonMark[]): JsonNode {
  return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

type Reader = {
  pictures: Map<MammothElement, string>;
  /** A footnote's (or endnote's) text, read from the note the reference points to. */
  noteText: (reference: MammothElement) => string | null;
  /** The comment a reference points to, as a mark for the words before it. */
  comment: (reference: MammothElement) => JsonMark | null;
};

/**
 * Word records where a comment ends, but mammoth drops where it starts, so the comment goes on the
 * word just before its reference.
 */
function commentLastWord(out: JsonNode[], mark: JsonMark) {
  for (let index = out.length - 1; index >= 0; index -= 1) {
    const node = out[index];
    if (node.type !== "text" || !node.text?.trim()) continue;
    const match = /(\S+)(\s*)$/u.exec(node.text);
    if (!match) continue;
    const before = node.text.slice(0, match.index);
    const marks = node.marks ?? [];
    out.splice(
      index,
      1,
      ...(before ? [textNode(before, marks)] : []),
      textNode(match[1], [...marks, mark]),
      ...(match[2] ? [textNode(match[2], marks)] : []),
    );
    return;
  }
}

function inlineNodes(elements: MammothElement[], marks: JsonMark[], out: JsonNode[], images: JsonNode[], reader: Reader) {
  for (const element of elements) {
    if (element.type === "text") {
      if (element.value) out.push(textNode(element.value, marks));
    } else if (element.type === "tab") {
      out.push(textNode("\t", marks));
    } else if (element.type === "break") {
      if (element.breakType === "line") out.push({ type: "hardBreak" });
    } else if (element.type === "run") {
      inlineNodes(element.children ?? [], runMarks(element, marks), out, images, reader);
    } else if (element.type === "hyperlink") {
      const linked = element.href ? withMark(marks, { type: "link", attrs: { href: element.href } }) : marks;
      inlineNodes(element.children ?? [], linked, out, images, reader);
    } else if (element.type === "image") {
      const src = reader.pictures.get(element);
      if (src) images.push({ type: "image", attrs: { src, alt: element.altText ?? "" } });
    } else if (element.type === "noteReference") {
      const text = reader.noteText(element);
      if (text !== null) out.push({ type: "footnote", attrs: { text } });
    } else if (element.type === "commentReference") {
      const mark = reader.comment(element);
      if (mark) commentLastWord(out, mark);
    } else if (element.children) {
      inlineNodes(element.children, marks, out, images, reader);
    }
  }
}

function paragraphAttrs(paragraph: MammothElement): Record<string, unknown> | undefined {
  const attrs: Record<string, unknown> = {};
  if (paragraph.alignment === "center") attrs.textAlign = "center";
  else if (paragraph.alignment === "right" || paragraph.alignment === "end") attrs.textAlign = "right";
  else if (paragraph.alignment === "both") attrs.textAlign = "justify";
  const start = Number(paragraph.indent?.start ?? 0);
  // Word stores indents in twips; one Pensieve indent step is about a quarter inch.
  const level = Math.min(6, Math.round(start / 360));
  if (level > 0) attrs.indent = level;
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

function hasText(nodes: JsonNode[]): boolean {
  return nodes.some((node) => (node.type === "text" && node.text?.trim()) || node.type === "hardBreak");
}

/** The text of a chapter the way the editor reports it, for word counts and search. */
export function documentText(nodes: JsonNode[]): string {
  const block = (node: JsonNode): string => {
    if (node.type === "text") return node.text ?? "";
    if (node.type === "hardBreak") return "\n";
    return (node.content ?? []).map(block).join(node.type === "listItem" || node.type === "blockquote" ? "\n\n" : "");
  };
  return nodes.map(block).join("\n\n");
}

/** `implicit` marks the bucket for text that comes before the first chapter title. */
type Building = { title: string; nodes: JsonNode[]; implicit: boolean; part?: string };

/** Turns mammoth's document model into chapters. Exported for tests. */
export function wordToChapters(
  document: MammothDocument,
  pictures: Map<MammothElement, string>,
  fallbackTitle = "Imported",
): WordImport {
  const items = document.children ?? [];
  const paragraphs = items.filter((item) => item.type === "paragraph");
  const fromPensieve = paragraphs.some((p) => isLabel(p) || isPensieveTitle(p));
  // Until 6 October Pensieve made every chapter's title a Heading 1, under a "Pensieve Title" (with a
  // chapter label in a novel or stories, never in an article). Its files since then have a "Pensieve
  // Book Title" and follow the page: a Heading 1 begins a part and a Heading 2 is a chapter's title.
  const withParts = paragraphs.some(isBookTitle) && !paragraphs.some(isLabel);
  // A one-page article stays one page: its part line is a Heading 1, and its own headings are one level
  // below where they are on the page.
  const article = paragraphs.some(isArticleTitle);
  const levels = paragraphs.map(headingLevel).filter((level): level is number => level !== null);
  const chapterLevel = article ? null : withParts ? 2 : fromPensieve ? 1 : levels.length > 0 ? Math.min(...levels) : null;
  const titled = chapterLevel !== null && paragraphs.some((p) => headingLevel(p) === chapterLevel);
  let part = "";
  // A part line with no chapter under it yet. As on the page, it still gets one, an untitled chapter.
  let partOpen = false;
  const byLines = !article && chapterLevel === null && paragraphs.some((p) => looksLikeChapterTitle(plainOf(p)));

  let title = "";
  const chapters: Building[] = [];
  let current: Building | null = null;
  let lists: { node: JsonNode; level: number; ordered: boolean }[] = [];
  let quote: JsonNode | null = null;
  let pendingCap = "";

  const start = (name: string, implicit = false) => {
    current = { title: name.trim() || t("untitled"), nodes: [], implicit, ...(withParts || article ? { part } : {}) };
    chapters.push(current);
    partOpen = false;
    lists = [];
    quote = null;
  };
  const chapter = (): Building => {
    // Text before the first chapter title is a chapter named after the book; right under a part line
    // in a book of chapters, an untitled one, as on the page.
    if (!current) start(partOpen && titled ? t("untitled") : title || fallbackTitle, true);
    return current as unknown as Building;
  };
  const comments = new Map((document.comments ?? []).map((comment) => [comment.commentId, comment]));
  const importedAt = new Date().toISOString();
  const reader: Reader = {
    pictures,
    noteText: (reference) => {
      const note = document.notes?.resolve(reference);
      return note ? note.body.map(plainOf).join(" ").trim() : null;
    },
    comment: (reference) => {
      const comment = comments.get(reference.commentId ?? "");
      if (!comment) return null;
      const text = comment.body.map(plainOf).map((line) => line.trim()).filter(Boolean).join("\n");
      return { type: "comment", attrs: { id: crypto.randomUUID(), text, createdAt: importedAt } };
    },
  };

  const addList = (paragraph: JsonNode, level: number, ordered: boolean) => {
    while (lists.length > 0 && lists[lists.length - 1].level > level) lists.pop();
    let top = lists[lists.length - 1];
    if (top && top.level === level && top.ordered !== ordered) {
      lists.pop();
      top = lists[lists.length - 1];
    }
    if (!top || top.level < level) {
      const list: JsonNode = { type: ordered ? "orderedList" : "bulletList", content: [] };
      const parentItem = top?.node.content?.[top.node.content.length - 1];
      if (parentItem) parentItem.content?.push(list);
      else chapter().nodes.push(list);
      lists.push({ node: list, level, ordered });
      top = lists[lists.length - 1];
    }
    top.node.content?.push({ type: "listItem", content: [paragraph] });
  };

  for (const item of items) {
    if (item.type === "table") {
      lists = [];
      quote = null;
      for (const row of item.children ?? []) {
        const cells = (row.children ?? []).map((cell) => (cell.children ?? []).map(plainOf).join(" ").trim());
        const text = cells.join("\t");
        if (text.trim()) chapter().nodes.push({ type: "paragraph", content: [textNode(text, [])] });
      }
      continue;
    }
    if (item.type !== "paragraph") continue;
    const text = plainOf(item).trim();

    if (isTitle(item)) {
      if (!title) title = text;
      continue;
    }
    if (fromPensieve && isLabel(item)) continue;
    const level = headingLevel(item);
    // An article's part line is a Heading 1 before anything else; any other Heading 1 is one of its own
    // headings, and its words stay in the text.
    if (article && level === 1 && !current && !part) {
      part = text;
      continue;
    }
    if (withParts && level === 1) {
      if (partOpen) start(t("untitled"));
      // The chapters from here on are in this part, until the next one begins.
      part = text;
      partOpen = true;
      current = null;
      continue;
    }
    if ((chapterLevel !== null && level === chapterLevel) || (byLines && looksLikeChapterTitle(text))) {
      start(text);
      continue;
    }
    if (isDropCap(item)) {
      pendingCap += plainOf(item);
      continue;
    }

    const content: JsonNode[] = [];
    const images: JsonNode[] = [];
    inlineNodes(item.children ?? [], [], content, images, reader);
    if (pendingCap) {
      const first = content[0];
      if (first?.type === "text" && !first.marks) first.text = pendingCap + first.text;
      else content.unshift(textNode(pendingCap, []));
      pendingCap = "";
    }
    // An empty line (Word's Enter after a heading) neither opens a chapter nor closes a part line.
    if (!hasText(content) && images.length === 0) continue;
    const target = chapter();

    if (hasText(content)) {
      if (level !== null && (article || (chapterLevel !== null && level > chapterLevel))) {
        lists = [];
        quote = null;
        // Inside a chapter every heading is a subheading, as Heading 1 and 2 begin parts and chapters;
        // an article's own headings go back up the level they went down.
        const headingAttrs = { ...paragraphAttrs(item), level: article ? Math.max(1, Math.min(3, level - 1)) : 3 };
        target.nodes.push({ type: "heading", attrs: headingAttrs, content });
      } else if (item.numbering) {
        quote = null;
        addList({ type: "paragraph", content }, Number(item.numbering.level) || 0, item.numbering.isOrdered);
      } else if (isQuote(item)) {
        lists = [];
        if (!quote) {
          quote = { type: "blockquote", content: [] };
          target.nodes.push(quote);
        }
        quote.content?.push({ type: "paragraph", attrs: paragraphAttrs(item), content });
      } else {
        lists = [];
        quote = null;
        const attrs = paragraphAttrs(item);
        target.nodes.push(attrs ? { type: "paragraph", attrs, content } : { type: "paragraph", content });
      }
    }
    if (images.length > 0) {
      lists = [];
      quote = null;
      target.nodes.push(...images);
    }
  }

  if (partOpen) start(t("untitled"));

  const built = chapters
    .filter((entry) => !entry.implicit || entry.nodes.length > 0)
    .map((entry) => {
      const nodes = entry.nodes;
      return {
        title: entry.title,
        contentJson: nodes.length > 0 ? ({ type: "doc", content: nodes } as DocumentJson) : emptyDocument(),
        plainText: documentText(nodes),
        ...(entry.part !== undefined ? { part: entry.part } : {}),
      };
    });

  if (built.length === 0) throw new Error(t("errWordEmpty"));
  return { title, chapters: built, fromPensieve };
}

const normalTitle = (value: string) => value.trim().toLowerCase();

/**
 * Replaces the book's chapters with the imported ones. A chapter with the same title (or, failing
 * that, in the same place) keeps its id, status, synopsis, goal, part and language, so notes and
 * to-dos stay linked to it. A file that has parts (Pensieve's own) sets the parts.
 */
export function replaceBookChapters(project: Writing, imported: ImportedChapter[], now = new Date().toISOString()): Writing {
  const existing = [...project.chapters].sort((a, b) => a.position - b.position);
  const used = new Set<string>();
  const byTitle = new Map<string, Chapter>();
  for (const chapter of existing) {
    if (!byTitle.has(normalTitle(chapter.title))) byTitle.set(normalTitle(chapter.title), chapter);
  }
  const taken = (chapter: Chapter | undefined) => (chapter && !used.has(chapter.id) ? chapter : undefined);
  const titled = imported.map((item) => taken(byTitle.get(normalTitle(item.title))));
  titled.forEach((chapter) => chapter && used.add(chapter.id));
  const chapters = imported.map((item, index): Chapter => {
    let match = titled[index];
    if (!match) {
      match = taken(existing[index]);
      if (match) used.add(match.id);
    }
    const base = match ?? createChapter(project.id, item.title, index, now);
    const part = item.part !== undefined ? { part: item.part } : {};
    return { ...base, title: item.title, position: index, contentJson: item.contentJson, plainText: item.plainText, ...part, updatedAt: now };
  });
  return { ...project, chapters, updatedAt: now };
}

/** Adds the imported chapters after the book's last chapter. */
export function appendBookChapters(project: Writing, imported: ImportedChapter[], now = new Date().toISOString()): Writing {
  let position = project.chapters.reduce((max, chapter) => Math.max(max, chapter.position), -1);
  const added = imported.map((item) => {
    position += 1;
    const part = item.part !== undefined ? { part: item.part } : {};
    return { ...createChapter(project.id, item.title, position, now), contentJson: item.contentJson, plainText: item.plainText, ...part };
  });
  return { ...project, chapters: [...project.chapters, ...added], updatedAt: now };
}
