import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { Chapter, DocumentJson } from "$lib/model";
import { emptyDocument } from "$lib/model";

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

function alignment(align?: string) {
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right") return AlignmentType.RIGHT;
  if (align === "justify") return AlignmentType.BOTH;
  return AlignmentType.LEFT;
}

function runs(inlines: Inline[]): TextRun[] {
  if (inlines.length === 0) return [new TextRun("")];
  return inlines.map(
    (inline) =>
      new TextRun({
        text: inline.text,
        bold: inline.bold,
        italics: inline.italic,
        underline: inline.underline ? {} : undefined,
        strike: inline.strike,
      }),
  );
}

export async function chaptersToDocx(title: string, chapters: Chapter[]): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(title)],
    }),
  ];
  for (const chapter of [...chapters].sort((a, b) => a.position - b.position)) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(chapter.title)],
      }),
    );
    for (const block of documentToBlocks(chapter.contentJson)) {
      const heading =
        block.kind === "h1"
          ? HeadingLevel.HEADING_1
          : block.kind === "h2"
            ? HeadingLevel.HEADING_2
            : block.kind === "h3"
              ? HeadingLevel.HEADING_3
              : undefined;
      children.push(
        new Paragraph({
          heading,
          alignment: alignment(block.align),
          bullet: block.kind === "bullet" ? { level: 0 } : undefined,
          numbering: block.kind === "number" ? { reference: "numbers", level: 0 } : undefined,
          children: runs(block.inlines),
        }),
      );
    }
  }

  const document = new Document({
    numbering: {
      config: [
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBlob(document);
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

export function downloadText(text: string, filename: string, type: string) {
  downloadBlob(new Blob([text], { type }), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function blockToNode(block: Block): JsonNode {
  const content = block.inlines.map((inline) => ({
    type: "text",
    text: inline.text,
    marks: [
      inline.bold ? { type: "bold" } : null,
      inline.italic ? { type: "italic" } : null,
      inline.underline ? { type: "underline" } : null,
      inline.strike ? { type: "strike" } : null,
    ].filter((mark) => mark !== null),
  }));
  if (block.kind === "h1" || block.kind === "h2" || block.kind === "h3") {
    const level = block.kind === "h1" ? 1 : block.kind === "h2" ? 2 : 3;
    return { type: "heading", attrs: { level }, content };
  }
  if (block.kind === "bullet" || block.kind === "number") {
    return {
      type: block.kind === "bullet" ? "bulletList" : "orderedList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content }] }],
    };
  }
  if (block.kind === "quote") {
    return { type: "blockquote", content: [{ type: "paragraph", content }] };
  }
  return { type: "paragraph", content };
}

export function blocksToDocument(blocks: Block[]): DocumentJson {
  const content = blocks.filter((block) => block.inlines.some((inline) => inline.text.trim()));
  if (content.length === 0) return emptyDocument();
  return { type: "doc", content: content.map(blockToNode) };
}

function inlinesFromElement(element: HTMLElement): Inline[] {
  const inlines: Inline[] = [];
  const walk = (node: Node, marks: Omit<Inline, "text">) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) inlines.push({ text, ...marks });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const next = { ...marks };
    const tag = node.tagName;
    if (tag === "STRONG" || tag === "B") next.bold = true;
    if (tag === "EM" || tag === "I") next.italic = true;
    if (tag === "U") next.underline = true;
    if (tag === "S" || tag === "DEL") next.strike = true;
    for (const child of node.childNodes) walk(child, next);
  };
  walk(element, {});
  return inlines;
}

export function htmlToChapters(html: string): { title: string; blocks: Block[] }[] {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const chapters: { title: string; blocks: Block[] }[] = [];
  let current: { title: string; blocks: Block[] } | null = null;

  const pushBlock = (kind: Block["kind"], element: HTMLElement) => {
    if (!current) current = { title: "Imported", blocks: [] };
    current.blocks.push({ kind, inlines: inlinesFromElement(element) });
  };

  for (const node of parsed.body.children) {
    if (!(node instanceof HTMLElement)) continue;
    const tag = node.tagName;
    if (tag === "H1" || tag === "H2") {
      if (current) chapters.push(current);
      current = { title: node.textContent?.trim() || "Imported", blocks: [] };
    } else if (tag === "H3") {
      pushBlock("h3", node);
    } else if (tag === "UL" || tag === "OL") {
      const kind = tag === "UL" ? "bullet" : "number";
      for (const item of node.querySelectorAll(":scope > li")) {
        if (item instanceof HTMLElement) pushBlock(kind, item);
      }
    } else if (tag === "BLOCKQUOTE") {
      pushBlock("quote", node);
    } else {
      pushBlock("paragraph", node);
    }
  }
  if (current) chapters.push(current);
  return chapters.filter((chapter) => chapter.title || chapter.blocks.length > 0);
}
