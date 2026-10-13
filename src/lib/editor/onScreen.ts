import type { EditorView } from "@tiptap/pm/view";

/** Where marks are drawn: from one position to another. */
export type Range = { from: number; to: number };

/**
 * The part of the page she sees, with half a screen above and below, as positions. The page's blocks are
 * in order down it, so halving finds the ends with only a few of them measured. Marks are drawn only
 * here, as a chapter's thousands of them would slow typing down.
 */
export function onScreen(view: EditorView): Range {
  const offsets: number[] = [];
  view.state.doc.forEach((_node, offset) => offsets.push(offset));
  const height = window.innerHeight;
  // The first block whose edge is past `limit`.
  const firstPast = (limit: number, edge: "top" | "bottom") => {
    let low = 0;
    let high = offsets.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      const dom = view.nodeDOM(offsets[middle]);
      if (dom instanceof HTMLElement && dom.getBoundingClientRect()[edge] > limit) high = middle;
      else low = middle + 1;
    }
    return low;
  };
  const first = firstPast(-height / 2, "bottom");
  const end = firstPast(1.5 * height, "top");
  if (first >= end) return { from: 0, to: 0 };
  return { from: offsets[first], to: end < offsets.length ? offsets[end] : view.state.doc.content.size };
}
