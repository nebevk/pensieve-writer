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
