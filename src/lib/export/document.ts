import type { Chapter, DocumentJson } from "$lib/model";

/** The Book view, Markdown, plain-text and HTML exports. Word files are written by word.ts. */

export type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

export type Block = {
  kind: "paragraph" | "h1" | "h2" | "h3" | "quote" | "bullet" | "number";
  align?: string;
  inlines: Inline[];
};

type JsonNode = {
  type?: string;
  text?: string;
  attrs?: { level?: number; textAlign?: string };
  marks?: { type?: string }[];
  content?: JsonNode[];
};

function inlinesFrom(nodes: JsonNode[] | undefined): Inline[] {
  if (!nodes) return [];
  return nodes.flatMap((node) => {
    if (node.type === "text") {
      const marks = new Set((node.marks ?? []).map((mark) => mark.type));
      return [
        {
          text: node.text ?? "",
          bold: marks.has("bold"),
          italic: marks.has("italic"),
          underline: marks.has("underline"),
          strike: marks.has("strike"),
        },
      ];
    }
    return inlinesFrom(node.content);
  });
}

export function documentToBlocks(doc: DocumentJson): Block[] {
  const blocks: Block[] = [];
  const content = (doc.content ?? []) as JsonNode[];
  for (const node of content) {
    if (node.type === "heading") {
      const level = node.attrs?.level ?? 1;
      const kind = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      blocks.push({ kind, align: node.attrs?.textAlign, inlines: inlinesFrom(node.content) });
    } else if (node.type === "blockquote") {
      blocks.push({ kind: "quote", inlines: inlinesFrom(node.content) });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const kind = node.type === "bulletList" ? "bullet" : "number";
      for (const item of node.content ?? []) {
        blocks.push({ kind, inlines: inlinesFrom(item.content) });
      }
    } else {
      blocks.push({
        kind: "paragraph",
        align: node.attrs?.textAlign,
        inlines: inlinesFrom(node.content),
      });
    }
  }
  return blocks;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inlineHtml(inlines: Inline[]): string {
  return inlines
    .map((inline) => {
      let text = escapeHtml(inline.text);
      if (inline.bold) text = `<strong>${text}</strong>`;
      if (inline.italic) text = `<em>${text}</em>`;
      if (inline.underline) text = `<u>${text}</u>`;
      if (inline.strike) text = `<s>${text}</s>`;
      return text;
    })
    .join("");
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const inner = inlineHtml(block.inlines) || "<br />";
      const align = block.align ? ` style="text-align: ${block.align}"` : "";
      if (block.kind === "h1" || block.kind === "h2" || block.kind === "h3") {
        return `<${block.kind}${align}>${inner}</${block.kind}>`;
      }
      if (block.kind === "quote") return `<blockquote>${inner}</blockquote>`;
      if (block.kind === "bullet") return `<ul><li>${inner}</li></ul>`;
      if (block.kind === "number") return `<ol><li>${inner}</li></ol>`;
      return `<p${align}>${inner}</p>`;
    })
    .join("");
}

function inlineMarkdown(inlines: Inline[]): string {
  return inlines
    .map((inline) => {
      let text = inline.text;
      if (inline.bold) text = `**${text}**`;
      if (inline.italic) text = `*${text}*`;
      if (inline.strike) text = `~~${text}~~`;
      return text;
    })
    .join("");
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const inner = inlineMarkdown(block.inlines);
      if (block.kind === "h1") return `# ${inner}`;
      if (block.kind === "h2") return `## ${inner}`;
      if (block.kind === "h3") return `### ${inner}`;
      if (block.kind === "quote") return `> ${inner}`;
      if (block.kind === "bullet") return `- ${inner}`;
      if (block.kind === "number") return `1. ${inner}`;
      return inner;
    })
    .join("\n\n");
}

export function blocksToPlain(blocks: Block[]): string {
  return blocks.map((block) => block.inlines.map((inline) => inline.text).join("")).join("\n\n");
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
