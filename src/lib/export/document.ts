import type { Chapter, DocumentJson } from "$lib/model";

/** The Book view, Markdown, plain-text and HTML exports. Word files are written by word.ts. */

export type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  superscript?: boolean;
  highlight?: boolean;
  href?: string;
  /** A line break inside the paragraph (Shift+Enter). */
  lineBreak?: boolean;
};

export type Block = {
  kind: "paragraph" | "h1" | "h2" | "h3" | "quote" | "bullet" | "number" | "image" | "rule";
  align?: string;
  inlines: Inline[];
  /** How deeply a list item is nested; 0 is the outer list. */
  depth?: number;
  /** A picture's source and description. */
  src?: string;
  alt?: string;
};

type JsonNode = {
  type?: string;
  text?: string;
  attrs?: { level?: number; textAlign?: string; src?: string; alt?: string };
  marks?: { type?: string; attrs?: { href?: string } }[];
  content?: JsonNode[];
};

const BREAK: Inline = { text: "", lineBreak: true };
const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);
// Only web and mail links, and pictures stored in the book or on the web, reach the HTML.
const SAFE_LINK = /^(https?:|mailto:)/i;
const SAFE_PICTURE = /^(data:image\/|https?:)/i;

function inlinesFrom(nodes: JsonNode[] | undefined): Inline[] {
  return (nodes ?? []).flatMap((node): Inline[] => {
    if (node.type === "hardBreak") return [BREAK];
    if (node.type !== "text") return inlinesFrom(node.content);
    const marks = new Map((node.marks ?? []).map((mark) => [mark.type, mark]));
    return [
      {
        text: node.text ?? "",
        bold: marks.has("bold"),
        italic: marks.has("italic"),
        underline: marks.has("underline"),
        strike: marks.has("strike"),
        superscript: marks.has("superscript"),
        highlight: marks.has("highlight"),
        href: marks.get("link")?.attrs?.href || undefined,
      },
    ];
  });
}

const isList = (node: JsonNode) => node.type === "bulletList" || node.type === "orderedList";

/** Joins pieces with line breaks, as the lines of one paragraph. */
function asLines(pieces: Inline[][]): Inline[] {
  return pieces.flatMap((piece, index) => (index > 0 ? [BREAK, ...piece] : piece));
}

function listBlocks(list: JsonNode, depth: number, into: Block[]) {
  const kind = list.type === "orderedList" ? "number" : "bullet";
  for (const item of list.content ?? []) {
    const parts = item.content ?? [];
    // An item's own paragraphs stay together; lists inside it follow, one level deeper.
    into.push({ kind, depth, inlines: asLines(parts.filter((part) => !isList(part)).map((part) => inlinesFrom(part.content))) });
    for (const part of parts) if (isList(part)) listBlocks(part, depth + 1, into);
  }
}

function blocksFrom(nodes: JsonNode[], into: Block[], inQuote = false) {
  const paragraph = inQuote ? "quote" : "paragraph";
  for (const node of nodes) {
    if (node.type === "heading") {
      const level = node.attrs?.level ?? 1;
      const kind = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      into.push({ kind, align: node.attrs?.textAlign, inlines: inlinesFrom(node.content) });
    } else if (node.type === "blockquote") {
      blocksFrom(node.content ?? [], into, true);
    } else if (isList(node)) {
      listBlocks(node, 0, into);
    } else if (node.type === "image") {
      into.push({ kind: "image", inlines: [], src: node.attrs?.src ?? "", alt: node.attrs?.alt ?? "" });
    } else if (node.type === "horizontalRule") {
      into.push({ kind: "rule", inlines: [] });
    } else if (node.type === "codeBlock") {
      const text = (node.content ?? []).map((child) => child.text ?? "").join("");
      into.push({ kind: paragraph, inlines: asLines(text.split("\n").map((line) => [{ text: line }])) });
    } else {
      into.push({ kind: paragraph, align: node.attrs?.textAlign, inlines: inlinesFrom(node.content) });
    }
  }
}

export function documentToBlocks(doc: DocumentJson): Block[] {
  const blocks: Block[] = [];
  blocksFrom((doc.content ?? []) as JsonNode[], blocks);
  return blocks;
}

const isItem = (block: Block | undefined) => block?.kind === "bullet" || block?.kind === "number";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const escapeAttribute = (value: string) => escapeHtml(value).replaceAll('"', "&quot;");

function inlineHtml(inlines: Inline[]): string {
  return inlines
    .map((inline) => {
      if (inline.lineBreak) return "<br />";
      let text = escapeHtml(inline.text);
      if (inline.bold) text = `<strong>${text}</strong>`;
      if (inline.italic) text = `<em>${text}</em>`;
      if (inline.underline) text = `<u>${text}</u>`;
      if (inline.strike) text = `<s>${text}</s>`;
      if (inline.superscript) text = `<sup>${text}</sup>`;
      if (inline.highlight) text = `<mark>${text}</mark>`;
      if (inline.href && SAFE_LINK.test(inline.href)) text = `<a href="${escapeAttribute(inline.href)}">${text}</a>`;
      return text;
    })
    .join("");
}

export function blocksToHtml(blocks: Block[]): string {
  let html = "";
  // The lists still open, outermost first. Each has an unfinished <li>, so a deeper list nests inside it.
  const open: string[] = [];
  const closeListsTo = (depth: number) => {
    while (open.length > depth) html += `</li></${open.pop()}>`;
  };
  blocks.forEach((block, index) => {
    if (isItem(block)) {
      const tag = block.kind === "bullet" ? "ul" : "ol";
      const depth = block.depth ?? 0;
      closeListsTo(depth + 1);
      if (open.length === depth + 1) {
        if (open[depth] === tag) html += "</li>";
        else closeListsTo(depth);
      }
      while (open.length < depth + 1) {
        html += `<${tag}>`;
        open.push(tag);
      }
      html += `<li>${inlineHtml(block.inlines)}`;
      return;
    }
    closeListsTo(0);
    const inner = inlineHtml(block.inlines) || "<br />";
    const align = block.align && ALIGNMENTS.has(block.align) ? ` style="text-align: ${block.align}"` : "";
    if (block.kind === "quote") {
      // Paragraphs of one quotation share one <blockquote>.
      if (blocks[index - 1]?.kind !== "quote") html += "<blockquote>";
      html += `<p>${inner}</p>`;
      if (blocks[index + 1]?.kind !== "quote") html += "</blockquote>";
    } else if (block.kind === "image") {
      if (block.src && SAFE_PICTURE.test(block.src)) {
        html += `<img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt ?? "")}" />`;
      }
    } else if (block.kind === "rule") {
      html += "<hr />";
    } else if (block.kind === "h1" || block.kind === "h2" || block.kind === "h3") {
      html += `<${block.kind}${align}>${inner}</${block.kind}>`;
    } else {
      html += `<p${align}>${inner}</p>`;
    }
  });
  closeListsTo(0);
  return html;
}

/** Wraps text in Markdown markers, keeping spaces at either end outside them, or they don't count. */
function wrap(text: string, open: string, close = open): string {
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? ["", "", text, ""];
  return core ? `${lead}${open}${core}${close}${trail}` : text;
}

const markdownUrl = (url: string) => url.replaceAll(" ", "%20").replaceAll("(", "%28").replaceAll(")", "%29");

function inlineMarkdown(inlines: Inline[]): string {
  return inlines
    .map((inline) => {
      if (inline.lineBreak) return "\\\n";
      let text = inline.text;
      if (inline.bold) text = wrap(text, "**");
      if (inline.italic) text = wrap(text, "*");
      if (inline.underline) text = wrap(text, "<u>", "</u>");
      if (inline.strike) text = wrap(text, "~~");
      if (inline.superscript) text = wrap(text, "<sup>", "</sup>");
      if (inline.highlight) text = wrap(text, "<mark>", "</mark>");
      if (inline.href && SAFE_LINK.test(inline.href)) text = wrap(text, "[", `](${markdownUrl(inline.href)})`);
      return text;
    })
    .join("");
}

function blockMarkdown(block: Block): string {
  const inner = inlineMarkdown(block.inlines);
  if (block.kind === "h1") return `# ${inner}`;
  if (block.kind === "h2") return `## ${inner}`;
  if (block.kind === "h3") return `### ${inner}`;
  // A line break continues the quotation or the list item on its next line.
  if (block.kind === "quote") return `> ${inner.replaceAll("\n", "\n> ")}`;
  if (isItem(block)) {
    const indent = "   ".repeat(block.depth ?? 0);
    return `${indent}${block.kind === "bullet" ? "- " : "1. "}${inner.replaceAll("\n", `\n${indent}   `)}`;
  }
  if (block.kind === "image") {
    return block.src && SAFE_PICTURE.test(block.src) ? `![${block.alt ?? ""}](${markdownUrl(block.src)})` : "";
  }
  if (block.kind === "rule") return "---";
  return inner;
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block, index) => {
      const previous = blocks[index - 1];
      if (!previous) return blockMarkdown(block);
      // Items of one list sit on consecutive lines; paragraphs of one quotation stay in it.
      const gap = isItem(block) && isItem(previous) ? "\n" : block.kind === "quote" && previous.kind === "quote" ? "\n>\n" : "\n\n";
      return gap + blockMarkdown(block);
    })
    .join("");
}

export function blocksToPlain(blocks: Block[]): string {
  const numbers: number[] = [];
  return blocks
    .map((block, index) => {
      const text = block.inlines.map((inline) => (inline.lineBreak ? "\n" : inline.text)).join("");
      const gap = index === 0 ? "" : isItem(block) && isItem(blocks[index - 1]) ? "\n" : "\n\n";
      if (isItem(block)) {
        const depth = block.depth ?? 0;
        numbers.length = depth + 1;
        numbers[depth] = block.kind === "number" ? (numbers[depth] ?? 0) + 1 : 0;
        return `${gap}${"  ".repeat(depth)}${block.kind === "number" ? `${numbers[depth]}.` : "-"} ${text}`;
      }
      numbers.length = 0;
      if (block.kind === "image") return `${gap}${block.alt ? `[Picture: ${block.alt}]` : "[Picture]"}`;
      if (block.kind === "rule") return `${gap}* * *`;
      return gap + text;
    })
    .join("");
}

export function chaptersToMarkdown(title: string, chapters: Chapter[]): string {
  const body = chapters
    .map((chapter) => `## ${chapter.title}\n\n${blocksToMarkdown(documentToBlocks(chapter.contentJson))}`)
    .join("\n\n");
  return `# ${title}\n\n${body}\n`;
}

export function chaptersToPlain(title: string, chapters: Chapter[]): string {
  const body = chapters
    .map((chapter) => `${chapter.title}\n\n${blocksToPlain(documentToBlocks(chapter.contentJson))}`)
    .join("\n\n");
  return `${title}\n\n${body}\n`;
}

export function chaptersToHtml(title: string, chapters: Chapter[]): string {
  const body = chapters
    .map((chapter) => `<h2>${escapeHtml(chapter.title)}</h2>${blocksToHtml(documentToBlocks(chapter.contentJson))}`)
    .join("");
  return `<article><h1>${escapeHtml(title)}</h1>${body}</article>`;
}
