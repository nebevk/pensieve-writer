import type { Editor } from "@tiptap/core";

export type ChapterHit = {
  chapterId: string;
  title: string;
  count: number;
};

export function searchChapters(
  chapters: { id: string; title: string; plainText: string }[],
  query: string,
): ChapterHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return chapters.flatMap((chapter) => {
    const text = chapter.plainText.toLowerCase();
    let count = 0;
    let index = text.indexOf(needle);
    while (index !== -1) {
      count += 1;
      index = text.indexOf(needle, index + needle.length);
    }
    return count > 0 ? [{ chapterId: chapter.id, title: chapter.title, count }] : [];
  });
}

export function findNext(editor: Editor, query: string): boolean {
  const needle = query.toLowerCase();
  if (!needle) return false;

  const matches: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let index = text.indexOf(needle);
    while (index !== -1) {
      matches.push({ from: pos + index, to: pos + index + needle.length });
      index = text.indexOf(needle, index + needle.length);
    }
  });
  if (matches.length === 0) return false;

  const start = editor.state.selection.to;
  const next = matches.find((match) => match.from >= start) ?? matches[0];
  editor.chain().focus().setTextSelection(next).scrollIntoView().run();
  return true;
}

export function replaceNext(editor: Editor, query: string, replacement: string): boolean {
  const found = findNext(editor, query);
  if (!found || !query) return false;
  const { from, to } = editor.state.selection;
  editor.chain().focus().insertContentAt({ from, to }, replacement).run();
  return true;
}

export function replaceAll(editor: Editor, query: string, replacement: string): number {
  const needle = query.toLowerCase();
  if (!needle) return 0;
  const matches: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let index = text.indexOf(needle);
    while (index !== -1) {
      matches.push({ from: pos + index, to: pos + index + needle.length });
      index = text.indexOf(needle, index + needle.length);
    }
  });
  const chain = editor.chain().focus();
  for (const match of [...matches].reverse()) {
    chain.insertContentAt(match, replacement);
  }
  if (matches.length > 0) chain.run();
  return matches.length;
}

type JsonNode = {
  type?: string;
  text?: string;
  content?: JsonNode[];
  [key: string]: unknown;
};

function replaceText(text: string, query: string, replacement: string): { text: string; count: number } {
  const needle = query.toLowerCase();
  if (!needle) return { text, count: 0 };
  const lower = text.toLowerCase();
  let count = 0;
  let result = "";
  let from = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    result += text.slice(from, index) + replacement;
    count += 1;
    from = index + query.length;
    index = lower.indexOf(needle, from);
  }
  return { text: result + text.slice(from), count };
}

function replaceNode(node: JsonNode, query: string, replacement: string): { node: JsonNode; count: number } {
  if (node.type === "text" && typeof node.text === "string") {
    const next = replaceText(node.text, query, replacement);
    return { node: { ...node, text: next.text }, count: next.count };
  }
  if (!node.content) return { node, count: 0 };
  let count = 0;
  const content = node.content.map((child) => {
    const walked = replaceNode(child, query, replacement);
    count += walked.count;
    return walked.node;
  });
  return { node: { ...node, content }, count };
}

export function replaceInDocument(
  doc: { type: string; content?: unknown[] },
  plainText: string,
  query: string,
  replacement: string,
): { contentJson: { type: string; content?: unknown[] }; plainText: string; count: number } {
  const walked = replaceNode(doc as JsonNode, query, replacement);
  const text = replaceText(plainText, query, replacement);
  return {
    contentJson: walked.node as { type: string; content?: unknown[] },
    plainText: text.text,
    count: walked.count,
  };
}
