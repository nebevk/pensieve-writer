import type { MammothDocument, MammothElement } from "mammoth";
import { t } from "$lib/ui.svelte";
import { wordToChapters, type WordImport } from "./wordImport";
import { elementsOf, findElement, parseXml, textOf, type XmlElement, type XmlNode } from "./xml";
import { unzip, type ZipFiles } from "./zip";

/**
 * Reads an OpenDocument text file (.odt, from LibreOffice, Google Docs or Word) into chapters, as a Word
 * file is read: its paragraphs, styles, lists, notes, comments, tables and pictures become the document
 * model Word's reader (mammoth) makes, and the same code finds its title and chapters.
 */
export async function readOdtFile(data: ArrayBuffer, fallbackTitle = "Imported"): Promise<WordImport> {
  if (data.byteLength === 0) throw new Error(t("errOdtEmpty"));
  let files: ZipFiles;
  let content: XmlElement;
  let styles: XmlElement | null;
  try {
    files = unzip(data);
    const kind = files.get("mimetype");
    // A spreadsheet or a presentation is OpenDocument too, but not text.
    if (kind && !new TextDecoder().decode(await kind()).startsWith("application/vnd.oasis.opendocument.text")) throw new Error("not text");
    const read = async (name: string) => {
      const file = files.get(name);
      return file ? parseXml(new TextDecoder().decode(await file())) : null;
    };
    const found = await read("content.xml");
    if (!found) throw new Error("no content");
    content = found;
    styles = await read("styles.xml");
  } catch {
    throw new Error(t("errOdtUnreadable"));
  }
  const { document, pictures } = await odtDocument(content, styles, files);
  try {
    return wordToChapters(document, pictures, fallbackTitle);
  } catch (error) {
    if (error instanceof Error && error.message === t("errWordEmpty")) throw new Error(t("errOdtEmpty"));
    throw error;
  }
}

type TextLook = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; superscript?: boolean; highlight?: string };
type Style = {
  family: string;
  parent: string;
  /** The name a person sees ("Heading 1", "Title"); "" for a style LibreOffice made for one place. */
  shown: string;
  text: TextLook;
  align?: string | null;
  /** Its left margin, in twips (a twentieth of a point), as Word's reader gives it. */
  indent?: number;
};

const PICTURES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };
// LibreOffice's name for a block quote; the Word reader knows it as "Quote".
const STYLE_NAMES: Record<string, string> = { quotations: "Quote" };
// Indexes repeat the chapters' titles, and tracked changes hold deleted text: neither is the writing.
const SKIPPED = /^text:(table-of-content|illustration-index|alphabetical-index|user-index|object-index|table-index|bibliography|tracked-changes|sequence-decls|variable-decls|user-field-decls|dde-connection-decls)$|^office:forms$/;

/** A style's name as written ("Heading_20_1"), as a person reads it ("Heading 1"). */
const readable = (name: string) => name.replace(/_([0-9a-f]{2})_/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));

/** A length ("1.25cm", "0.5in", "12pt", "10mm") in twips. */
function twips(length: string | undefined): number {
  const match = /^(-?[\d.]+)(cm|mm|in|pt|pc|px)$/.exec(length?.trim() ?? "");
  if (!match) return 0;
  const per = { cm: 567, mm: 56.7, in: 1440, pt: 20, pc: 240, px: 15 }[match[2] as "cm"];
  return Math.round(Number(match[1]) * per);
}

/** A highlighter colour (#ffff00) as the name Word's would have, which the reader matches to Pensieve's. */
function highlightName(colour: string | undefined): string | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour ?? "")?.[1];
  if (!hex) return undefined;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  // White, grey and black are no highlight.
  if (high - low < 0.15) return undefined;
  const hue = high === r ? (60 * ((g - b) / (high - low)) + 360) % 360 : high === g ? 60 * ((b - r) / (high - low)) + 120 : 60 * ((r - g) / (high - low)) + 240;
  if (hue >= 75 && hue < 165) return "green";
  if (hue >= 165 && hue < 255) return "blue";
  if (hue >= 255 || hue < 15) return "pink";
  return "yellow";
}

function textLook(properties: XmlElement | undefined): TextLook {
  if (!properties) return {};
  const look: TextLook = {};
  const a = properties.attrs;
  const weight = a["fo:font-weight"];
  if (weight) look.bold = weight === "bold" || Number(weight) >= 600;
  const style = a["fo:font-style"];
  if (style) look.italic = style === "italic" || style === "oblique";
  const underline = a["style:text-underline-style"];
  if (underline) look.underline = underline !== "none";
  const strike = a["style:text-line-through-style"];
  if (strike) look.strike = strike !== "none";
  const position = a["style:text-position"];
  if (position) look.superscript = /^super/.test(position) || /^[1-9]/.test(position);
  const background = a["fo:background-color"];
  if (background) look.highlight = highlightName(background);
  return look;
}

/** The styles a file names: its own (styles.xml) and those made for one place (content.xml's automatic ones). */
function readStyles(content: XmlElement, styles: XmlElement | null) {
  const byName = new Map<string, Style>();
  const lists = new Map<string, Map<number, boolean>>();
  const take = (holder: XmlElement | null, named: boolean) => {
    for (const element of holder ? elementsOf(holder) : []) {
      const name = element.attrs["style:name"];
      if (!name) continue;
      if (element.name === "style:style") {
        const children = elementsOf(element);
        const paragraph = children.find((child) => child.name === "style:paragraph-properties");
        const align = paragraph?.attrs["fo:text-align"];
        byName.set(`${element.attrs["style:family"]}:${name}`, {
          family: element.attrs["style:family"] ?? "",
          parent: element.attrs["style:parent-style-name"] ?? "",
          shown: named ? (element.attrs["style:display-name"] ?? readable(name)) : "",
          text: textLook(children.find((child) => child.name === "style:text-properties")),
          ...(align !== undefined ? { align: align === "center" ? "center" : align === "end" || align === "right" ? "right" : align === "justify" ? "both" : null } : {}),
          ...(paragraph?.attrs["fo:margin-left"] !== undefined ? { indent: twips(paragraph.attrs["fo:margin-left"]) } : {}),
        });
      } else if (element.name === "text:list-style") {
        // Each level of a list numbered or bulleted.
        const levels = new Map<number, boolean>();
        for (const level of elementsOf(element)) {
          const depth = Number(level.attrs["text:level"]) - 1;
          if (level.name === "text:list-level-style-number") levels.set(depth, true);
          else if (level.name.startsWith("text:list-level-style-")) levels.set(depth, false);
        }
        lists.set(name, levels);
      }
    }
  };
  const common = styles ? findElement(styles, "office:styles") : null;
  take(common, true);
  take(findElement(content, "office:automatic-styles"), false);

  /** A style with what it takes from the styles above it. */
  const resolve = (family: string, name: string): Style => {
    const chain: Style[] = [];
    const seen = new Set<string>();
    for (let next = name; next && !seen.has(next); ) {
      seen.add(next);
      const style = byName.get(`${family}:${next}`);
      if (!style) break;
      chain.push(style);
      next = style.parent;
    }
    const merged: Style = { family, parent: "", shown: chain.find((style) => style.shown)?.shown ?? "", text: {} };
    for (const style of [...chain].reverse()) {
      merged.text = { ...merged.text, ...Object.fromEntries(Object.entries(style.text).filter(([, value]) => value !== undefined)) };
      if (style.align !== undefined) merged.align = style.align;
      if (style.indent !== undefined) merged.indent = style.indent;
    }
    return merged;
  };
  return { resolve, ordered: (list: string, level: number) => lists.get(list)?.get(level) ?? false };
}

const run = (look: TextLook, children: MammothElement[]): MammothElement => ({
  type: "run",
  isBold: !!look.bold,
  isItalic: !!look.italic,
  isUnderline: !!look.underline,
  isStrikethrough: !!look.strike,
  verticalAlignment: look.superscript ? "superscript" : "baseline",
  highlight: look.highlight ?? null,
  children,
});

const looksLike = (look: TextLook) => !!(look.bold || look.italic || look.underline || look.strike || look.superscript || look.highlight);

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

/** The file's text as the document model Word's reader makes, with its pictures read. */
async function odtDocument(content: XmlElement, styles: XmlElement | null, files: ZipFiles): Promise<{ document: MammothDocument; pictures: Map<MammothElement, string> }> {
  const { resolve, ordered } = readStyles(content, styles);
  const notes = new Map<string, MammothElement[]>();
  const comments: { commentId: string; body: MammothElement[] }[] = [];
  // A comment on words, waiting for where they end.
  const open = new Map<string, string>();
  const pending: { image: MammothElement; path: string }[] = [];
  // Text runs made of the file's own spaces, which the edges of a paragraph lose, as in LibreOffice.
  const loose = new WeakSet<MammothElement>();

  const inline = (children: XmlNode[]): MammothElement[] => {
    const out: MammothElement[] = [];
    for (const child of children) {
      if (typeof child === "string") {
        const value = child.replace(/[ \t\r\n]+/g, " ");
        if (!value) continue;
        const text: MammothElement = { type: "text", value };
        loose.add(text);
        out.push(text);
        continue;
      }
      const a = child.attrs;
      switch (child.name) {
        case "text:span":
          out.push(run(resolve("text", a["text:style-name"] ?? "").text, inline(child.children)));
          break;
        case "text:a":
          out.push({ type: "hyperlink", href: a["xlink:href"] ?? "", children: inline(child.children) });
          break;
        case "text:s":
          out.push({ type: "text", value: " ".repeat(Math.max(1, Number(a["text:c"]) || 1)) });
          break;
        case "text:tab":
          out.push({ type: "tab" });
          break;
        case "text:line-break":
          out.push({ type: "break", breakType: "line" });
          break;
        case "text:note": {
          const id = a["text:id"] || `note-${notes.size + 1}`;
          const body = elementsOf(child).find((part) => part.name === "text:note-body");
          notes.set(id, body ? blocks(body.children) : []);
          out.push({ type: "noteReference", noteId: id, noteType: a["text:note-class"] === "endnote" ? "endnote" : "footnote" });
          break;
        }
        case "office:annotation": {
          const commentId = `comment-${comments.length + 1}`;
          comments.push({ commentId, body: blocks(elementsOf(child).filter((part) => part.name === "text:p" || part.name === "text:list")) });
          // A comment on a stretch of words ends at its office:annotation-end; one on a point is there.
          if (a["office:name"]) open.set(a["office:name"], commentId);
          else out.push({ type: "commentReference", commentId });
          break;
        }
        case "office:annotation-end": {
          const commentId = open.get(a["office:name"] ?? "");
          if (commentId) {
            open.delete(a["office:name"] ?? "");
            out.push({ type: "commentReference", commentId });
          }
          break;
        }
        case "draw:frame":
          for (const image of elementsOf(child).filter((part) => part.name === "draw:image")) {
            const path = image.attrs["xlink:href"] ?? "";
            const contentType = PICTURES[/\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? ""];
            if (!contentType || !files.has(path)) continue;
            const title = elementsOf(child).find((part) => part.name === "svg:title" || part.name === "svg:desc");
            const element: MammothElement = { type: "image", contentType, altText: title ? textOf(title).trim() : "" };
            pending.push({ image: element, path });
            out.push(element);
          }
          break;
        case "draw:a":
          out.push(...inline(child.children));
          break;
        default:
          // Fields (a page number, a date) and other wrappers show their text; drawings, bookmarks and
          // the marks of tracked changes have none of hers.
          if (!child.name.startsWith("draw:") && !/^text:(bookmark|reference-mark|change|soft-page-break|note-citation)/.test(child.name)) out.push(...inline(child.children));
      }
    }
    return out;
  };

  /** Drops the file's spaces at a paragraph's start and end. */
  const trimEdges = (children: MammothElement[]) => {
    const texts: MammothElement[] = [];
    const walk = (elements: MammothElement[]) => {
      for (const element of elements) {
        if (element.type === "text" || element.type === "tab" || element.type === "break" || element.type === "image" || element.type === "noteReference") texts.push(element);
        else if (element.children) walk(element.children);
      }
    };
    walk(children);
    for (const text of texts) {
      if (!loose.has(text) || !text.value) break;
      text.value = text.value.trimStart();
      if (text.value) break;
    }
    for (const text of [...texts].reverse()) {
      if (!loose.has(text) || !text.value) break;
      text.value = text.value.trimEnd();
      if (text.value) break;
    }
  };

  const paragraph = (node: XmlElement, heading: number, list: { style: string; level: number } | null): MammothElement => {
    const style = resolve("paragraph", node.attrs["text:style-name"] ?? "");
    let children = inline(node.children);
    trimEdges(children);
    // A look set on the whole paragraph (LibreOffice keeps it in the paragraph's style) is on its words.
    if (!heading && looksLike(style.text)) children = [run(style.text, children)];
    const shown = style.shown && (STYLE_NAMES[style.shown.toLowerCase()] ?? style.shown);
    return {
      type: "paragraph",
      styleId: null,
      styleName: heading ? `Heading ${heading}` : shown || null,
      alignment: style.align ?? null,
      indent: { start: !list && style.indent ? String(style.indent) : null, end: null, firstLine: null, hanging: null },
      numbering: list ? { level: list.level, isOrdered: ordered(list.style, list.level) } : null,
      children,
    };
  };

  const table = (node: XmlElement): MammothElement => {
    const rows: MammothElement[] = [];
    const walk = (holder: XmlElement) => {
      for (const part of elementsOf(holder)) {
        if (part.name === "table:table-row") {
          const cells = elementsOf(part).filter((cell) => cell.name === "table:table-cell");
          rows.push({ type: "tableRow", children: cells.map((cell) => ({ type: "tableCell", children: blocks(cell.children) })) });
        } else if (/^table:table-(header-)?rows$|^table:table-row-group$/.test(part.name)) walk(part);
      }
    };
    walk(node);
    return { type: "table", children: rows };
  };

  /** The paragraphs, lists and tables of a stretch of the file, in order. */
  function blocks(children: XmlNode[], list: { style: string; level: number } | null = null): MammothElement[] {
    const out: MammothElement[] = [];
    for (const node of children) {
      if (typeof node === "string" || SKIPPED.test(node.name)) continue;
      if (node.name === "text:p") out.push(paragraph(node, 0, list));
      else if (node.name === "text:h") out.push(paragraph(node, Math.max(1, Number(node.attrs["text:outline-level"]) || 1), list));
      else if (node.name === "text:list") {
        const style = node.attrs["text:style-name"] ?? list?.style ?? "";
        const level = list ? list.level + 1 : 0;
        for (const item of elementsOf(node)) if (item.name === "text:list-item" || item.name === "text:list-header") out.push(...blocks(item.children, { style, level }));
      } else if (node.name === "text:numbered-paragraph") {
        const level = Math.max(0, (Number(node.attrs["text:level"]) || 1) - 1);
        out.push(...blocks(node.children, { style: node.attrs["text:style-name"] ?? "", level }));
      } else if (node.name === "table:table") out.push(table(node));
      // A picture anchored to the page rather than to a paragraph, as a paragraph of its own.
      else if (node.name === "draw:frame") out.push({ type: "paragraph", children: inline([node]) });
      else if (node.name === "text:section" || node.name === "office:text" || node.name === "office:body") out.push(...blocks(node.children, list));
    }
    return out;
  }

  const text = findElement(content, "office:text");
  const document: MammothDocument = {
    type: "document",
    children: text ? blocks(text.children) : [],
    notes: { resolve: (reference) => (notes.has(reference.noteId ?? "") ? { body: notes.get(reference.noteId ?? "") ?? [] } : null) },
    comments,
  };

  const pictures = new Map<MammothElement, string>();
  for (const { image, path } of pending) {
    try {
      const bytes = await files.get(path)?.();
      if (bytes) pictures.set(image, `data:${image.contentType};base64,${base64(bytes)}`);
    } catch {
      // A picture Pensieve can't read is left out; the text still comes in.
    }
  }
  return { document, pictures };
}
