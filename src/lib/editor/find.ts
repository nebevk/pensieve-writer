import type { Editor } from "@tiptap/core";

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
