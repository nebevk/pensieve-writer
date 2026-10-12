import type { DocumentJson } from "$lib/model";
import { emptyDocument } from "$lib/model";
import { documentText, looksLikeChapterTitle, type ImportedChapter, type WordImport } from "./wordImport";

/** Text and Markdown files read into chapters, as Word files are by wordImport.ts. */

type JsonMark = { type: string; attrs?: Record<string, unknown> };
type JsonNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
  marks?: JsonMark[];
};

/**
 * A file's text: UTF-8 (with or without its mark), UTF-16 with its mark, else Windows' Central European
 * code page, in which Notepad saved Slovenian text before Windows 10.
 */
export function decodeText(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** Reads a .txt or .md file into chapters; an empty file has none. */
export function readTextFile(data: ArrayBuffer | Uint8Array, fallbackTitle: string, markdown: boolean): WordImport {
  const text = decodeText(data);
  return markdown ? markdownToChapters(text, fallbackTitle) : plainTextToChapters(text, fallbackTitle);
}

const linesOf = (text: string) =>
  text
    .replace(/\r\n?|\f/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""));

/** A line that only marks a break between scenes: "* * *", "***", "#", "~~~". */
const SCENE_LINE = /^(?=.*[*#~•·◊§=_-])[*#~•·◊§=_\s-]{1,15}$/u;

/**
 * Whether the text was broken into lines of about the same length, with a blank line between paragraphs,
 * as old e-books and e-mails are: then a paragraph's lines join back up. Prose written one paragraph to a
 * line, and poems, keep their lines.
 */
function hardWrapped(lines: string[]): boolean {
  let inner = 0;
  let wide = 0;
  for (let index = 0; index + 1 < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || !lines[index + 1].trim()) continue;
    if (line.length > 100) return false;
    inner += 1;
    if (line.length >= 40) wide += 1;
  }
  return inner >= 5 && wide >= inner * 0.8 && lines.some((line) => !line.trim());
}

const textNode = (text: string, marks: JsonMark[] = []): JsonNode => (marks.length > 0 ? { type: "text", text, marks } : { type: "text", text });
const paragraph = (content: JsonNode[], attrs?: Record<string, unknown>): JsonNode => ({
  type: "paragraph",
  ...(attrs ? { attrs } : {}),
  ...(content.length > 0 ? { content } : {}),
});

/** A chapter being filled; `implicit` marks the one for text before the first chapter title. */
type Building = { title: string; nodes: JsonNode[]; implicit: boolean };

function finish(title: string, chapters: Building[]): WordImport {
  const built: ImportedChapter[] = chapters
    .filter((entry) => !entry.implicit || entry.nodes.length > 0)
    .map((entry) => ({
      title: entry.title,
      contentJson: entry.nodes.length > 0 ? ({ type: "doc", content: entry.nodes } as DocumentJson) : emptyDocument(),
      plainText: documentText(entry.nodes),
    }));
  return { title, chapters: built, fromPensieve: false };
}

/** A line that can't be a book's title: too long, or a sentence. */
const sentence = (line: string) => line.length > 80 || /[.!?…:;,]$/.test(line);

/**
 * Plain text: each line a paragraph (or each run of lines, when hard-wrapped), chapters at lines such as
 * "Chapter 3" or "Prvo poglavje", and a short first line above the first chapter as the book's title.
 */
export function plainTextToChapters(text: string, fallbackTitle: string): WordImport {
  const lines = linesOf(text);
  const wrapped = hardWrapped(lines);
  const paragraphs: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length > 0) paragraphs.push(run.join(" "));
    run = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) flush();
    else if (wrapped && !SCENE_LINE.test(line) && !looksLikeChapterTitle(line)) run.push(line);
    else {
      flush();
      paragraphs.push(line);
    }
  }
  flush();

  const first = paragraphs.findIndex((line) => looksLikeChapterTitle(line));
  const title = first === 1 && !sentence(paragraphs[0]) && !SCENE_LINE.test(paragraphs[0]) ? paragraphs[0] : "";
  const chapters: Building[] = [];
  let current: Building | null = null;
  paragraphs.slice(title ? 1 : 0).forEach((line) => {
    if (first >= 0 && looksLikeChapterTitle(line)) {
      current = { title: line, nodes: [], implicit: false };
      chapters.push(current);
      return;
    }
    if (!current) {
      current = { title: title || fallbackTitle, nodes: [], implicit: true };
      chapters.push(current);
    }
    // A scene break keeps its marks, in the middle of the line as the toolbar's is.
    current.nodes.push(SCENE_LINE.test(line) ? paragraph([textNode(line)], { textAlign: "center" }) : paragraph([textNode(line)]));
  });
  return finish(title, chapters);
}

// ---- Markdown ----

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const ATX = /^\s{0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^\s{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^\s{0,3}>/;
const LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const SETEXT = /^\s{0,3}(=+|-+)\s*$/;
const NOTE = /^\[\^([^\]\s]+)\]:[ \t]?(.*)$/;
const SAFE_LINK = /^(https?:|mailto:)/i;
const PICTURE = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i;

const startsBlock = (line: string) => FENCE.test(line) || ATX.test(line) || RULE.test(line) || QUOTE.test(line) || LIST_ITEM.test(line);
const width = (indent: string) => indent.replace(/\t/g, "    ").length;

/** What a Markdown file is made of, before it is shared into chapters: headings, and everything else. */
type Item = { heading: { level: number; source: string } } | { node: JsonNode };

type Reading = {
  /** Footnotes by their label, from the definitions anywhere in the file. */
  notes: Map<string, string>;
  /** Whether single line breaks inside a paragraph are only wrapping. */
  wrapped: boolean;
};

/**
 * Markdown: the title from a lone "# Title" above other headings (Pensieve's own export) or from a blog
 * post's front matter. A book's chapters begin at its top headings, and smaller ones are subheadings; a
 * post or notes (front matter, or text before the first heading, and no heading such as "Chapter 3") is
 * one page with its headings as they are.
 */
export function markdownToChapters(text: string, fallbackTitle: string): WordImport {
  let lines = linesOf(text);
  let title = "";
  let post = false;
  // A blog post's front matter: its title is the writing's, the rest is for the website.
  if (lines[0] === "---") {
    const end = lines.findIndex((line, index) => index > 0 && (line === "---" || line === "..."));
    if (end > 0 && end < 60) {
      const named = lines.slice(1, end).map((line) => /^title:\s*(.*)$/i.exec(line)?.[1]).find((value) => value !== undefined);
      title = (named ?? "").replace(/^(["'])(.*)\1$/, "$2").trim();
      lines = lines.slice(end + 1);
      post = true;
    }
  }
  const notes = new Map<string, string>();
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const note = NOTE.exec(lines[index]);
    if (!note) {
      kept.push(lines[index]);
      continue;
    }
    const body = [note[2]];
    while (index + 1 < lines.length && /^( {2,}|\t)\S/.test(lines[index + 1])) body.push(lines[++index].trim());
    notes.set(note[1], body.join(" ").trim());
  }
  const reading: Reading = { notes, wrapped: hardWrapped(kept) };
  const items = blocks(kept, reading);

  const headingText = (item: Item) => ("heading" in item ? plainOf(inline(item.heading.source, reading, [])).trim() : "");
  const headings = items.filter((item) => "heading" in item);
  const ones = headings.filter((item) => "heading" in item && item.heading.level === 1);
  let rest = items;
  const first = items[0] && "heading" in items[0] && items[0].heading.level === 1 ? headingText(items[0]) : null;
  // The title's own line, said again under a post's front matter, isn't said twice.
  if (first !== null && (title ? first === title : ones.length === 1 && headings.length > 1)) {
    title = first;
    rest = items.slice(1);
  }
  const levels = rest.flatMap((item) => ("heading" in item ? [item.heading.level] : []));
  const chapterLevel = levels.length > 0 ? Math.min(...levels) : null;
  const onePage =
    chapterLevel !== null &&
    (post || (!("heading" in rest[0]) && !rest.some((item) => "heading" in item && item.heading.level === chapterLevel && looksLikeChapterTitle(headingText(item)))));
  const lineOf = (item: Item) => ("node" in item && item.node.type === "paragraph" ? plainOf(item.node.content ?? []) : "");
  const byLines = chapterLevel === null && rest.some((item) => looksLikeChapterTitle(lineOf(item)));

  const chapters: Building[] = [];
  let current: Building | null = null;
  const chapter = (): Building => {
    if (!current) {
      current = { title: title || fallbackTitle, nodes: [], implicit: true };
      chapters.push(current);
    }
    return current;
  };
  for (const item of rest) {
    if ("heading" in item) {
      const content = inline(item.heading.source, reading, []);
      if (!onePage && item.heading.level === chapterLevel) {
        current = { title: plainOf(content).trim() || fallbackTitle, nodes: [], implicit: false };
        chapters.push(current);
      } else if (content.length > 0) {
        // Inside a chapter every heading is a subheading, as Word's come in; a page keeps its levels.
        chapter().nodes.push({ type: "heading", attrs: { level: onePage ? Math.min(3, item.heading.level) : 3 }, content });
      }
    } else if (byLines && looksLikeChapterTitle(lineOf(item))) {
      current = { title: lineOf(item).trim(), nodes: [], implicit: false };
      chapters.push(current);
    } else {
      chapter().nodes.push(item.node);
    }
  }
  return finish(title, chapters);
}

function plainOf(nodes: JsonNode[]): string {
  return nodes.map((node) => (node.type === "text" ? (node.text ?? "") : node.type === "hardBreak" ? " " : plainOf(node.content ?? []))).join("");
}

/** The blocks of Markdown lines, in order. */
function blocks(lines: string[], reading: Reading): Item[] {
  const items: Item[] = [];
  const push = (node: JsonNode, images: JsonNode[]) => {
    items.push({ node });
    for (const image of images) items.push({ node: image });
  };
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      // Code keeps its lines, as one paragraph.
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(fence[1])) body.push(lines[index++]);
      index += 1;
      const content = body.flatMap((text, at) => [...(at > 0 ? [{ type: "hardBreak" }] : []), ...(text ? [textNode(text)] : [])]);
      items.push({ node: paragraph(content) });
      continue;
    }
    const heading = ATX.exec(line);
    if (heading) {
      items.push({ heading: { level: heading[1].length, source: heading[2] ?? "" } });
      index += 1;
      continue;
    }
    if (RULE.test(line)) {
      items.push({ node: { type: "horizontalRule" } });
      index += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index])) inner.push(lines[index++].replace(/^\s{0,3}>[ \t]?/, ""));
      // A quotation holds paragraphs and lists; a heading or code inside it stays as a paragraph.
      const content = blocks(inner, reading).map((item) =>
        "heading" in item ? paragraph(inline(item.heading.source, reading, [])) : item.node,
      );
      if (content.length > 0) items.push({ node: { type: "blockquote", content } });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const [list, next, images] = listAt(lines, index, reading);
      push(list, images);
      index = next;
      continue;
    }
    if (TABLE_ROW.test(line)) {
      // A table's rows come in as lines, their cells apart by tabs, as Word's tables do.
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        const row = lines[index++];
        if (TABLE_RULE.test(row)) continue;
        const cells = row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
        const images: JsonNode[] = [];
        push(paragraph(inline(cells.join("\t"), reading, images)), images);
      }
      continue;
    }
    const run = [lines[index++]];
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index]) && !SETEXT.test(lines[index])) run.push(lines[index++]);
    // A line underlined with === or --- is a heading.
    const under = index < lines.length ? SETEXT.exec(lines[index]) : null;
    if (under && run.length === 1 && run[0].trim().length <= 80) {
      items.push({ heading: { level: under[1].startsWith("=") ? 1 : 2, source: run[0].trim() } });
      index += 1;
      continue;
    }
    const images: JsonNode[] = [];
    const content = inline(joinLines(run, reading), reading, images);
    // A line that was only a picture is the picture alone.
    if (content.length > 0 || images.length === 0) items.push({ node: paragraph(content) });
    for (const image of images) items.push({ node: image });
  }
  return items;
}

/**
 * A paragraph's lines as one source: a line ending in "\" or two spaces breaks there; other line breaks
 * are wrapping (spaces) in hard-wrapped text, and kept in text written a line at a time.
 */
function joinLines(lines: string[], reading: Reading): string {
  return lines
    .map((line, index) => {
      const text = index === 0 ? line.replace(/^\s+/, "") : line.trim();
      if (index === lines.length - 1) return text.replace(/\\$/, "");
      if (/\\$/.test(text)) return `${text.slice(0, -1)}\n`;
      if (/ {2,}$/.test(line)) return `${text}\n`;
      return reading.wrapped ? `${text} ` : `${text}\n`;
    })
    .join("");
}

/** A list starting at `start`, with its nested lists; returns it and the line after it. */
function listAt(lines: string[], start: number, reading: Reading): [JsonNode, number, JsonNode[]] {
  type Entry = { indent: number; ordered: boolean; lines: string[] };
  const entries: Entry[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    const item = LIST_ITEM.exec(line);
    if (item) {
      entries.push({ indent: width(item[1]), ordered: /\d/.test(item[2]), lines: [item[3] ?? ""] });
      index += 1;
      continue;
    }
    if (!line.trim()) {
      // A blank line ends the list unless an item, or a line of the last one, follows.
      let next = index + 1;
      while (next < lines.length && !lines[next].trim()) next += 1;
      if (next < lines.length && (LIST_ITEM.test(lines[next]) || /^( {2,}|\t)/.test(lines[next]))) {
        if (!LIST_ITEM.test(lines[next])) entries[entries.length - 1].lines.push("");
        index = next;
        continue;
      }
      break;
    }
    if (startsBlock(line)) break;
    entries[entries.length - 1].lines.push(line);
    index += 1;
  }

  const images: JsonNode[] = [];
  const itemNode = (entry: Entry): JsonNode => {
    // An item's paragraphs are apart by blank lines.
    const groups: string[][] = [[]];
    for (const line of entry.lines) {
      if (line.trim()) groups[groups.length - 1].push(line);
      else if (groups[groups.length - 1].length > 0) groups.push([]);
    }
    const paragraphs = groups.filter((group) => group.length > 0).map((group) => paragraph(inline(joinLines(group, reading), reading, images)));
    return { type: "listItem", content: paragraphs.length > 0 ? paragraphs : [paragraph([])] };
  };
  const listOf = (ordered: boolean): JsonNode => ({ type: ordered ? "orderedList" : "bulletList", content: [] });

  const root = listOf(entries[0].ordered);
  const stack: { indent: number; list: JsonNode }[] = [{ indent: entries[0].indent, list: root }];
  for (const entry of entries) {
    while (stack.length > 1 && entry.indent < stack[stack.length - 1].indent) stack.pop();
    let top = stack[stack.length - 1];
    const items = top.list.content ?? [];
    // Indented under an item: a list inside that item.
    if (entry.indent >= top.indent + 2 && items.length > 0) {
      const list = listOf(entry.ordered);
      items[items.length - 1].content?.push(list);
      top = { indent: entry.indent, list };
      stack.push(top);
    }
    top.list.content?.push(itemNode(entry));
  }
  return [root, index, images];
}

// ---- Markdown's inline marks ----

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~<>"'^]/;
const TAGS: Record<string, JsonMark> = {
  u: { type: "underline" },
  ins: { type: "underline" },
  sup: { type: "superscript" },
  mark: { type: "highlight" },
  em: { type: "italic" },
  i: { type: "italic" },
  strong: { type: "bold" },
  b: { type: "bold" },
  s: { type: "strike" },
  del: { type: "strike" },
  strike: { type: "strike" },
};

function withMark(marks: JsonMark[], mark: JsonMark): JsonMark[] {
  return [...marks.filter((item) => item.type !== mark.type), mark];
}

/** A paragraph's Markdown as the editor's text, marks and footnotes; pictures go to `images`. */
function inline(source: string, reading: Reading, images: JsonNode[]): JsonNode[] {
  const out: JsonNode[] = [];
  readInline(source, [], out, reading, images);
  // Neighbours with the same marks are one piece of text.
  const merged: JsonNode[] = [];
  for (const node of out) {
    const last = merged[merged.length - 1];
    if (node.type === "text" && last?.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(node.marks ?? [])) {
      last.text = (last.text ?? "") + (node.text ?? "");
    } else merged.push(node);
  }
  return merged;
}

/** Where the `]` closing the `[` at `open` is, or -1. */
function closingBracket(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") index += 1;
    else if (char === "[") depth += 1;
    else if (char === "]" && --depth === 0) return index;
  }
  return -1;
}

/** A link or picture at `open` (its `[`): its text, its address and where it ends. */
function linkAt(source: string, open: number): { text: string; href: string; end: number } | null {
  const close = closingBracket(source, open);
  if (close < 0 || source[close + 1] !== "(") return null;
  let depth = 0;
  for (let index = close + 1; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")" && --depth === 0) {
      // The address, without a title in quotes after it.
      const target = source.slice(close + 2, index).trim().replace(/^<(.*)>$/, "$1");
      const href = target.replace(/\s+("[^"]*"|'[^']*')$/, "").trim();
      return { text: source.slice(open + 1, close), href, end: index + 1 };
    }
  }
  return null;
}

/** Where a run of `marker` closing emphasis opened at `from` is, or -1. */
function closingRun(source: string, from: number, marker: string): number {
  const char = marker[0];
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === "`") {
      const end = source.indexOf("`", index + 1);
      if (end > 0) index = end;
      continue;
    }
    if (source[index] !== char) continue;
    let run = 0;
    while (source[index + run] === char) run += 1;
    const before = source[index - 1] ?? " ";
    const after = source[index + run] ?? " ";
    // Only a run of the same length closes, right after a word, and an underscore only before a space.
    if (run === marker.length && index > from && !/\s/u.test(before) && (char !== "_" || !/[\p{L}\p{N}]/u.test(after))) return index;
    index += run - 1;
  }
  return -1;
}

function readInline(source: string, marks: JsonMark[], out: JsonNode[], reading: Reading, images: JsonNode[]) {
  let buffer = "";
  const flush = () => {
    if (buffer) out.push(textNode(buffer, marks));
    buffer = "";
  };
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "\n") {
      flush();
      out.push({ type: "hardBreak" });
      index += 1;
      continue;
    }
    if (char === "\\" && index + 1 < source.length && ESCAPABLE.test(source[index + 1])) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }
    if (char === "`") {
      let run = 0;
      while (source[index + run] === "`") run += 1;
      const end = source.indexOf("`".repeat(run), index + run);
      if (end > 0) {
        buffer += source.slice(index + run, end).trim();
        index = end + run;
        continue;
      }
    }
    if (char === "!" && source[index + 1] === "[") {
      const link = linkAt(source, index + 1);
      if (link) {
        // A picture kept in the file comes in; one elsewhere stays as written, as Pensieve doesn't fetch it.
        if (PICTURE.test(link.href)) images.push({ type: "image", attrs: { src: link.href, alt: link.text } });
        else buffer += source.slice(index, link.end);
        index = link.end;
        continue;
      }
    }
    if (char === "[") {
      const note = /^\[\^([^\]\s]+)\]/.exec(source.slice(index, index + 80));
      if (note && reading.notes.has(note[1])) {
        flush();
        out.push({ type: "footnote", attrs: { text: reading.notes.get(note[1]) } });
        index += note[0].length;
        continue;
      }
      const link = linkAt(source, index);
      if (link) {
        flush();
        const linked = SAFE_LINK.test(link.href) ? withMark(marks, { type: "link", attrs: { href: link.href } }) : marks;
        readInline(link.text, linked, out, reading, images);
        index = link.end;
        continue;
      }
    }
    if (char === "<") {
      const rest = source.slice(index, index + 2000);
      const auto = /^<((?:https?|mailto):[^\s>]+)>/i.exec(rest);
      if (auto) {
        flush();
        out.push(textNode(auto[1], withMark(marks, { type: "link", attrs: { href: auto[1] } })));
        index += auto[0].length;
        continue;
      }
      if (/^<br\s*\/?>/i.test(rest)) {
        flush();
        out.push({ type: "hardBreak" });
        index += /^<br\s*\/?>/i.exec(rest)?.[0].length ?? 4;
        continue;
      }
      const tag = /^<([a-z]+)>/i.exec(rest);
      const mark = tag ? TAGS[tag[1].toLowerCase()] : undefined;
      if (tag && mark) {
        const close = source.toLowerCase().indexOf(`</${tag[1].toLowerCase()}>`, index + tag[0].length);
        if (close > 0) {
          flush();
          readInline(source.slice(index + tag[0].length, close), withMark(marks, mark), out, reading, images);
          index = close + tag[1].length + 3;
          continue;
        }
      }
    }
    if (char === "*" || char === "_" || char === "~") {
      let run = 0;
      while (source[index + run] === char) run += 1;
      const before = source[index - 1] ?? " ";
      const after = source[index + run] ?? " ";
      // A run opens before a word (an underscore not inside one), and the next run as long closes it.
      const opens = (char === "~" ? run === 2 : run <= 3) && !/\s/u.test(after) && !(char === "_" && /[\p{L}\p{N}]/u.test(before));
      const close = opens ? closingRun(source, index + run, char.repeat(run)) : -1;
      if (close < 0) {
        buffer += char.repeat(run);
        index += run;
        continue;
      }
      const added: JsonMark[] =
        char === "~" ? [{ type: "strike" }] : run === 3 ? [{ type: "bold" }, { type: "italic" }] : run === 2 ? [{ type: "bold" }] : [{ type: "italic" }];
      flush();
      readInline(source.slice(index + run, close), added.reduce(withMark, marks), out, reading, images);
      index = close + run;
      continue;
    }
    buffer += char;
    index += 1;
  }
  flush();
}
