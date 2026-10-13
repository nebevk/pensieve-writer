import type { Chapter, DocumentJson } from "$lib/model";
import { findPattern, type FindOptions } from "./findPattern";

type Inline = { type: string; text?: string; content?: Inline[]; [key: string]: unknown };

/** What stands for anything in a line that isn't text (a footnote, a line break), as on the page. */
const OBJECT = String.fromCharCode(0xfffc);

/**
 * One line's words replaced where the pattern finds them, as the page does: a match partly in bold is
 * found too, and its replacement takes the look of the match's first letter.
 */
function replaceInLine(content: Inline[], pattern: RegExp, replacement: string): { content: Inline[]; count: number } {
  // The line's text, anything else in it one character, as on the page.
  let text = "";
  const starts = content.map((node) => {
    const start = text.length;
    text += node.type === "text" ? (node.text ?? "") : OBJECT;
    return start;
  });
  const matches = [...text.matchAll(pattern)].map((match) => ({ from: match.index ?? 0, to: (match.index ?? 0) + match[0].length }));
  if (matches.length === 0) return { content, count: 0 };
  const out: Inline[] = [];
  let next = 0;
  content.forEach((node, index) => {
    if (node.type !== "text") {
      out.push(node);
      return;
    }
    const value = node.text ?? "";
    const start = starts[index];
    let kept = "";
    let offset = 0;
    while (offset < value.length) {
      const at = start + offset;
      while (next < matches.length && matches[next].to <= at) next += 1;
      const match = matches[next];
      if (match && match.from <= at) {
        if (match.from === at) kept += replacement;
        offset = Math.min(value.length, match.to - start);
      } else {
        const end = match ? Math.min(value.length, match.from - start) : value.length;
        kept += value.slice(offset, end);
        offset = end;
      }
    }
    if (kept) out.push({ ...node, text: kept });
  });
  return { content: out, count: matches.length };
}

function replaceInNode(node: Inline, pattern: RegExp, replacement: string): { node: Inline; count: number } {
  if (!node.content) return { node, count: 0 };
  if (node.content.some((child) => child.type === "text")) {
    const line = replaceInLine(node.content, pattern, replacement);
    return line.count > 0 ? { node: { ...node, content: line.content }, count: line.count } : { node, count: 0 };
  }
  let count = 0;
  const content = node.content.map((child) => {
    const walked = replaceInNode(child, pattern, replacement);
    count += walked.count;
    return walked.node;
  });
  return count > 0 ? { node: { ...node, content }, count } : { node, count: 0 };
}

/**
 * A saved chapter's words replaced everywhere, as find matches them (Aa, ab), in its text and its plain
 * copy alike. Its name and part are left as they are.
 */
export function replaceInChapterText(
  chapter: Pick<Chapter, "contentJson" | "plainText">,
  query: string,
  replacement: string,
  options: FindOptions,
): { contentJson: DocumentJson; plainText: string; count: number } {
  const pattern = findPattern(query, options);
  if (!pattern) return { contentJson: chapter.contentJson, plainText: chapter.plainText, count: 0 };
  const walked = replaceInNode(chapter.contentJson as Inline, pattern, replacement);
  if (walked.count === 0) return { contentJson: chapter.contentJson, plainText: chapter.plainText, count: 0 };
  return {
    contentJson: walked.node as DocumentJson,
    plainText: chapter.plainText.replace(pattern, () => replacement),
    count: walked.count,
  };
}
