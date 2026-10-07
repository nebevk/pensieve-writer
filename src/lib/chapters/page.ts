import { createChapter, type Chapter, type DocumentJson, type Writing } from "$lib/model";
import { isUntitled } from "$lib/i18n";

/**
 * A chapter's page in Write. The page shows only the writer's text: its first line is the chapter's
 * title as Heading 2, after the part's name as Heading 1 where a part begins. A Heading 1 or 2 further
 * down starts a new part or chapter there, once it has words. Chapters are still saved one by one,
 * title and part apart from the text, so a long book stays quick and everything else reads them as
 * before. A writing with "Split into chapters" off is one page, so its headings start nothing.
 */

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: { type: string }[] };

/** What one chapter's stretch of a page holds: the part it begins (null when none), its title and its text. */
export type PagePiece = { part: string | null; title: string; content: Node[] };

const level = (node: Node | undefined) => (node?.type === "heading" ? Number(node.attrs?.level) : 0);
/** A line's words, with a line break as a space. */
const textOf = (node: Node): string => (node.type === "hardBreak" ? " " : (node.text ?? (node.content ?? []).map(textOf).join("")));
/** Whether a line holds a footnote, a comment or a note link, which a title or part line has no place for. */
const holdsNotes = (node: Node) =>
  (node.content ?? []).some(
    (child) => child.type === "footnote" || (child.marks ?? []).some((mark) => mark.type === "comment" || mark.type === "noteLink"),
  );
/**
 * A Heading 1 or 2 that starts a part or chapter: one with words, and nothing in it that its title
 * line would lose. An empty one starts nothing yet, so its name can still be typed; one with a comment
 * or footnote stays a heading in this chapter until they are moved into the text.
 */
const startsChapter = (node: Node) => (level(node) === 1 || level(node) === 2) && textOf(node).trim() !== "" && !holdsNotes(node);
const line = (lineLevel: 1 | 2, text: string): Node => ({
  type: "heading",
  attrs: { level: lineLevel },
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
const docOf = (content: Node[]): DocumentJson => ({ type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] });

/** The little of an open editor's document that these helpers read, so they need no editor code. */
type OpenPage = {
  childCount: number;
  child(index: number): { type: { name: string }; attrs: Record<string, unknown>; nodeSize: number; textContent: string; toJSON(): unknown };
};

const openLevel = (page: OpenPage, index: number) => {
  if (index >= page.childCount) return 0;
  const node = page.child(index);
  return node.type.name === "heading" ? Number(node.attrs.level) : 0;
};

/** How many lines at the top of an open page are its part and title lines (0, 1 or 2). */
export function leadLines(page: OpenPage): number {
  let lines = openLevel(page, 0) === 1 ? 1 : 0;
  if (openLevel(page, lines) === 2) lines += 1;
  return lines;
}

/**
 * Where a Heading 1 or 2 with words, below the title line, begins another part or chapter on an open
 * page, or -1. While block `typing` is that heading, the writer is still naming it: -1 until she leaves it.
 */
export function chapterBreak(page: OpenPage, typing = -1): number {
  for (let index = leadLines(page); index < page.childCount; index += 1) {
    // The same test as readPage's, as a split cuts the page here and readPage moves the text from here on.
    if (opensChapter(page, index)) return index === typing ? -1 : index;
  }
  return -1;
}

/** Whether block `index` of an open page, below its first lines, starts a part or chapter. */
export function opensChapter(page: OpenPage, index: number): boolean {
  const level = openLevel(page, index);
  if (index < leadLines(page) || (level !== 1 && level !== 2) || page.child(index).textContent.trim() === "") return false;
  return startsChapter(page.child(index).toJSON() as Node);
}

/**
 * The first Heading 1 or 2 with words, below the first lines, that stays a heading because it holds a
 * comment, footnote or note link, other than block `typing`; or -1.
 */
export function heldHeading(page: OpenPage, typing = -1): number {
  for (let index = leadLines(page); index < page.childCount; index += 1) {
    const level = openLevel(page, index);
    if (index === typing || (level !== 1 && level !== 2) || page.child(index).textContent.trim() === "") continue;
    if (holdsNotes(page.child(index).toJSON() as Node)) return index;
  }
  return -1;
}

/** Whether block `index` of an open page is its part or title line, which hold plain text only. */
export function isLeadLine(page: OpenPage, index: number): boolean {
  return index < leadLines(page);
}

/** Where the text below an open page's part and title lines begins. */
export function textStart(page: OpenPage): number {
  let position = 0;
  for (let index = 0; index < leadLines(page); index += 1) position += page.child(index).nodeSize;
  return position;
}

/** Whether chapter `index` begins a part: it has one, and the chapter before it is in another. */
export function startsPart(chapters: Pick<Chapter, "part">[], index: number): boolean {
  const part = chapters[index]?.part.trim() ?? "";
  return part !== "" && (index === 0 || chapters[index - 1].part.trim() !== part);
}

/** Gives chapter `index`, and the chapters after it that were in the same part, the part `name`. */
export function setPartFrom(chapters: Chapter[], index: number, name: string): void {
  // Names that differ only by spaces are one part, as the chapter list and Word show them.
  const old = chapters[index].part.trim();
  for (let at = index; at < chapters.length && (at === index || chapters[at].part.trim() === old); at += 1) {
    chapters[at] = { ...chapters[at], part: name };
  }
}

/**
 * The page for chapter `index` of `chapters` (in book order). Headings 1 and 2 already in its text
 * become Heading 3, as on the page they would now start a part or a chapter; in an article, which is
 * one page (`split` false), they stay as they are.
 */
export function composePage(chapters: Chapter[], index: number, split = true): DocumentJson {
  const chapter = chapters[index];
  const body = ((chapter.contentJson.content ?? []) as Node[]).map((node) =>
    split && startsChapter(node) ? { ...node, attrs: { ...node.attrs, level: 3 } } : node,
  );
  return {
    type: "doc",
    content: [
      ...(startsPart(chapters, index) ? [line(1, chapter.part.trim())] : []),
      line(2, isUntitled(chapter.title) ? "" : chapter.title.trim()),
      ...(body.length > 0 ? body : [{ type: "paragraph" }]),
    ],
  };
}

/**
 * Reads an edited page: its own part line, title and text, then one piece for every part or chapter
 * that a Heading 1 or 2 further down begins. `starts` holds where each of those pieces begins. With
 * `split` false (an article), the whole page is one piece.
 */
export function readPage(doc: DocumentJson, split = true): { first: PagePiece; more: PagePiece[]; starts: number[] } {
  const nodes = (doc.content ?? []) as Node[];
  let at = 0;
  const take = (): PagePiece => {
    let part: string | null = null;
    let title = "";
    if (level(nodes[at]) === 1) {
      part = textOf(nodes[at]).trim();
      at += 1;
    }
    if (level(nodes[at]) === 2 && !holdsNotes(nodes[at])) {
      title = textOf(nodes[at]).trim();
      at += 1;
    }
    const content: Node[] = [];
    while (at < nodes.length && !(split && startsChapter(nodes[at]))) {
      content.push(nodes[at]);
      at += 1;
    }
    return { part, title, content };
  };
  const first = take();
  const more: PagePiece[] = [];
  const starts: number[] = [];
  while (at < nodes.length) {
    starts.push(at);
    more.push(take());
  }
  return { first, more, starts };
}

/**
 * A page with every Heading 1 and 2 below its first lines made a line of text again, so none of them
 * starts a part or chapter: what taking a split back leaves.
 */
export function withoutBreaks(doc: DocumentJson): DocumentJson {
  const nodes = (doc.content ?? []) as Node[];
  let lead = level(nodes[0]) === 1 ? 1 : 0;
  if (level(nodes[lead]) === 2) lead += 1;
  const plain = (node: Node): Node => ({ type: "paragraph", ...(node.content ? { content: node.content } : {}) });
  return { ...doc, content: nodes.map((node, index) => (index >= lead && (level(node) === 1 || level(node) === 2) ? plain(node) : node)) };
}

/** A page's text as the word count reads it: blocks apart by a blank line, as the editor gives it. */
export function pageText(content: Node[]): string {
  const block = (node: Node): string => {
    if (node.type === "text") return node.text ?? "";
    if (node.type === "hardBreak") return "\n";
    const nested = ["bulletList", "orderedList", "listItem", "blockquote"].includes(node.type);
    return (node.content ?? []).map(block).join(nested ? "\n\n" : "");
  };
  return content.map(block).join("\n\n");
}

/**
 * Puts an edited page back into the book: the chapter's title, part and text, and a new chapter right
 * after it for every Heading 1 or 2 further down. New chapters keep the chapter's status and language,
 * and its part unless a Heading 1 begins a new one, which then also covers the chapters after it that
 * were in the old part, as in one long manuscript. Returns the ids of the new chapters, in order.
 *
 * `began` says whether the page showed a part line when it was last read (or opened), and the result's
 * `began` says it for this read, to pass the next time. The chapters may have been reordered since, and
 * the page is read against what it showed, not against the new order. `split` false (a one-page writing) keeps
 * the page in one piece.
 */
export function applyPage(
  writing: Writing,
  chapterId: string,
  doc: DocumentJson,
  now: string,
  untitled: string,
  options: { began?: boolean; split?: boolean } = {},
): { writing: Writing; created: string[]; began: boolean } {
  const chapters = [...writing.chapters].sort((a, b) => a.position - b.position);
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index < 0) return { writing, created: [], began: false };
  const { first, more } = readPage(doc, options.split ?? true);
  const source = chapters[index];
  const began = options.began ?? startsPart(chapters, index);
  chapters[index] = {
    ...source,
    // An empty title line keeps a title that already says "no title", in either language.
    title: first.title || (isUntitled(source.title) ? source.title : untitled),
    contentJson: docOf(first.content),
    plainText: pageText(first.content),
    updatedAt: now,
  };

  // The part line: kept as it was, renamed, added, or taken away so the chapter joins the part before.
  // An empty one changes nothing, so a name can be cleared and typed again.
  if (first.part === null) {
    if (began) setPartFrom(chapters, index, index > 0 ? chapters[index - 1].part : "");
  } else if (first.part && (!began || first.part !== source.part.trim())) {
    setPartFrom(chapters, index, first.part);
  }

  const created = more.map(
    (piece): Chapter => ({
      ...createChapter(writing.id, piece.title || untitled, 0, now),
      contentJson: docOf(piece.content),
      plainText: pageText(piece.content),
      status: source.status,
      language: source.language,
      part: chapters[index].part,
    }),
  );
  chapters.splice(index + 1, 0, ...created);
  more.forEach((piece, offset) => {
    if (piece.part) setPartFrom(chapters, index + 1 + offset, piece.part);
  });
  return {
    writing: { ...writing, chapters: chapters.map((chapter, position) => ({ ...chapter, position })) },
    created: created.map((chapter) => chapter.id),
    // A named part line now, none, or an empty one that changes nothing.
    began: first.part === null ? false : first.part ? true : began,
  };
}

/** Words past which one page gets slow to type in on an older laptop, so joining asks with a warning. */
export const LONG_PAGE_WORDS = 20000;

/**
 * A writing's chapters joined into one page, for turning "Split into chapters" off: each chapter's title
 * becomes a Heading 2 in the text (an untitled one's is left out), and a part's name a Heading 1 where the
 * part begins. The first chapter stays, under the writing's title, so to-dos and notes linked to it keep
 * their place; `removed` names the chapters that went into it. Each chapter's status, summary and goal go.
 */
export function joinWriting(writing: Writing, now: string): { writing: Writing; kept: string; removed: string[] } {
  const chapters = [...writing.chapters].sort((a, b) => a.position - b.position);
  const first = chapters[0];
  if (!first) return { writing: { ...writing, split: false }, kept: "", removed: [] };
  const content: Node[] = [];
  chapters.forEach((chapter, index) => {
    if (startsPart(chapters, index)) content.push(line(1, chapter.part.trim()));
    if (!isUntitled(chapter.title) && chapter.title.trim()) content.push(line(2, chapter.title.trim()));
    content.push(...((chapter.contentJson.content ?? []) as Node[]));
  });
  const page: Chapter = {
    ...first,
    title: writing.title,
    part: "",
    position: 0,
    synopsis: "",
    wordGoal: 0,
    contentJson: docOf(content),
    plainText: pageText(content),
    updatedAt: now,
  };
  return {
    writing: { ...writing, split: false, chapters: [page], updatedAt: now },
    kept: first.id,
    removed: chapters.slice(1).map((chapter) => chapter.id),
  };
}

/**
 * A one-page writing split into chapters, for turning "Split into chapters" on: its page is read as a
 * page of a book, so each Heading 2 with words starts a chapter and each Heading 1 a part. A page that
 * opens with a chapter's heading (one joined before) starts with that chapter; one that opens with text
 * keeps that text as a first chapter under the writing's title.
 */
export function splitWriting(writing: Writing, now: string, untitled: string): Writing {
  const only = writing.chapters.length === 1 ? writing.chapters[0] : null;
  if (!only) return { ...writing, split: true };
  const body = (only.contentJson.content ?? []) as Node[];
  const head = level(body[0]) === 1 && startsChapter(body[0]) ? 1 : 0;
  const opensWithChapter = level(body[head]) === 2 && startsChapter(body[head]);
  const page = opensWithChapter ? docOf(body) : composePage(writing.chapters, 0, false);
  return { ...applyPage(writing, only.id, page, now, untitled, { split: true, began: false }).writing, split: true, updatedAt: now };
}
