import { Extension } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/** A sheet in CSS pixels: its height, the margins above and below its text, and the desk between two sheets. */
export type SheetGeometry = { height: number; top: number; bottom: number; gap: number };

/** Where a sheet ends in the text, and the empty block that carries the rest to the next sheet. */
type SheetBreak = { pos: number; gap: HTMLElement };
type PaginationState = { sheet: SheetGeometry | null; breaks: SheetBreak[]; decorations: DecorationSet };
type PaginationMeta = { sheet?: SheetGeometry | null; breaks?: SheetBreak[] };

const key = new PluginKey<PaginationState>("pagination");
// Breaks are found again once typing pauses, so the work never sits between two keys.
const PAUSE = 300;

/** Pages for the open editor, or the continuous page with null. */
export function setSheet(view: EditorView, sheet: SheetGeometry | null) {
  view.dispatch(view.state.tr.setMeta(key, { sheet } satisfies PaginationMeta).setMeta("addToHistory", false));
}

/**
 * Where each sheet's text ends, measured down the page as it lies without breaks: the position of the
 * first line that no longer fits. A heading at the foot of a sheet goes over with the text it heads,
 * and a picture or a rule goes over whole.
 */
function findBreaks(view: EditorView, sheet: SheetGeometry): number[] {
  const room = sheet.height - sheet.top - sheet.bottom;
  const origin = view.dom.getBoundingClientRect().top;
  const breaks: number[] = [];
  // Where the open sheet's text begins.
  let start = 0;
  let lastHeading: { from: number; top: number } | null = null;

  const charBox = (pos: number, side: number) => view.coordsAtPos(pos, side);
  const breakAt = (pos: number, top: number) => {
    breaks.push(pos);
    start = top;
  };

  // The line a position is on begins where the character before it sits a line higher, at a letter:
  // the space a line wraps at stays at the end of the line before (where it is measured can vary).
  function lineStart(pos: number, from: number) {
    const here = charBox(pos, 1);
    const half = (here.bottom - here.top) / 2;
    let at = pos;
    while (at > from && charBox(at, -1).bottom > here.bottom - half) at -= 1;
    while (at < pos && /^\s$/.test(view.state.doc.textBetween(at, at + 1))) at += 1;
    return at;
  }

  function textblock(from: number, to: number, heading: boolean) {
    for (let guard = 0; guard < 500; guard += 1) {
      if (charBox(to, -1).bottom - origin - start <= room) break;
      // The first position whose line ends past the sheet's text.
      let low = from;
      let high = to;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (charBox(middle, 1).bottom - origin - start > room) high = middle;
        else low = middle + 1;
      }
      const pos = lineStart(low, from);
      const top = charBox(pos, 1).top - origin;
      if (pos === from && lastHeading && lastHeading.top - start > 1) {
        breakAt(lastHeading.from, lastHeading.top);
        lastHeading = null;
        continue;
      }
      // A line taller than a whole sheet stays where it is.
      if (top - start < 1) break;
      breakAt(pos, top);
    }
    lastHeading = null;
    if (heading) lastHeading = { from, top: charBox(from, 1).top - origin };
  }

  function block(node: PmNode, pos: number) {
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return;
    const box = dom.getBoundingClientRect();
    const top = box.top - origin;
    if (box.bottom - origin - start <= room) {
      lastHeading = node.type.name === "heading" ? { from: pos + 1, top } : null;
      return;
    }
    if (node.isTextblock) {
      textblock(pos + 1, pos + node.nodeSize - 1, node.type.name === "heading");
    } else if (!node.isLeaf && node.firstChild?.isBlock) {
      // A list or a quotation breaks between, or inside, the blocks it holds.
      node.forEach((child, offset) => block(child, pos + 1 + offset));
    } else if (top - start >= 1) {
      breakAt(pos, top);
      lastHeading = null;
    }
  }

  view.state.doc.forEach((node, offset) => block(node, offset));
  return breaks;
}

/**
 * Sheets of paper in the editor (Settings → Paper → Pages). The text is one flow; where a sheet ends,
 * an empty block as tall as the bottom margin, the desk between the sheets and the next sheet's top
 * margin carries the rest to the next sheet, as Word's page breaks do. The sheets themselves are drawn
 * behind the text by the page (see +page.svelte), from the count handed to onSheets after every pass.
 */
export const Pagination = Extension.create<{ onSheets: (count: number) => void }>({
  name: "pagination",

  addOptions() {
    return { onSheets: () => undefined };
  },

  addProseMirrorPlugins() {
    const onSheets = this.options.onSheets;
    return [
      new Plugin<PaginationState>({
        key,
        state: {
          init: () => ({ sheet: null, breaks: [], decorations: DecorationSet.empty }),
          apply(tr, value) {
            const meta = tr.getMeta(key) as PaginationMeta | undefined;
            const sheet = meta && "sheet" in meta ? (meta.sheet ?? null) : value.sheet;
            let breaks = meta?.breaks ?? value.breaks;
            // Between passes a break moves with the text before it, and stays when its neighbour is
            // deleted (a decoration's own mapping would drop it, and the rest would jump up a sheet).
            if (!meta?.breaks && tr.docChanged && breaks.length) breaks = breaks.map((at) => ({ pos: tr.mapping.map(at.pos, -1), gap: at.gap }));
            if (!sheet) breaks = [];
            if (breaks === value.breaks) return sheet === value.sheet ? value : { ...value, sheet };
            const decorations = DecorationSet.create(
              tr.doc,
              breaks.map((at) => Decoration.widget(at.pos, at.gap, { side: -1, ignoreSelection: true })),
            );
            return { sheet, breaks, decorations };
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.decorations,
        },
        view: (view) => new Paginator(view, onSheets),
      }),
    ];
  },
});

class Paginator {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer: ResizeObserver;
  private width = 0;
  // The text's height without the breaks, and how much the breaks add, as set (not read back, which
  // rounds to whole pixels and made the text seem to change size after every pass).
  private height = 0;
  private pushed = 0;
  private sheets = 0;

  constructor(
    private view: EditorView,
    private onSheets: (count: number) => void,
  ) {
    // The text's width or its own height (a new size or font, a picture loading) changes the breaks.
    this.observer = new ResizeObserver(() => this.resized());
    this.observer.observe(view.dom);
    document.fonts?.addEventListener("loadingdone", this.fontsLoaded);
  }

  update(view: EditorView, previous: EditorState) {
    this.view = view;
    const sheet = key.getState(view.state)?.sheet ?? null;
    if (sheet !== (key.getState(previous)?.sheet ?? null)) this.soon(0);
    else if (sheet && view.state.doc !== previous.doc) this.soon();
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.observer.disconnect();
    document.fonts?.removeEventListener("loadingdone", this.fontsLoaded);
  }

  private fontsLoaded = () => this.soon();

  private soon = (delay = PAUSE) => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.paginate();
    }, delay);
  };

  private resized() {
    if (!key.getState(this.view.state)?.sheet) return;
    const height = this.view.dom.getBoundingClientRect().height - this.pushed;
    if (this.view.dom.clientWidth !== this.width || Math.abs(height - this.height) > 2) this.soon();
  }

  // Every pass, so the page can line up what sits beside the text (the comment cards) again.
  private report(count: number) {
    this.sheets = count;
    this.onSheets(count);
  }

  private paginate() {
    const view = this.view;
    if (!view.dom.isConnected) return;
    // Not in the middle of a word being composed (an accent typed in two keys): after it.
    if (view.composing) {
      this.soon();
      return;
    }
    const state = key.getState(view.state);
    const sheet = state?.sheet ?? null;
    if (!state || !sheet) {
      this.pushed = 0;
      if (this.sheets !== 1) this.report(1);
      return;
    }
    // Measure the text as it lies without the breaks: they step aside (the editor ignores changes
    // inside its widgets), then lie flat where they belong, and each is made as tall as it must be.
    for (const at of state.breaks) at.gap.classList.add("measuring");
    const found = findBreaks(view, sheet);
    let breaks = state.breaks;
    if (found.length === breaks.length && found.every((pos, index) => pos === breaks[index].pos)) {
      // The usual case: no break moved, so only their heights change and no line is drawn again.
      for (const at of breaks) {
        at.gap.style.height = "0px";
        at.gap.classList.remove("measuring");
      }
    } else {
      breaks = found.map((pos) => {
        const gap = document.createElement("span");
        gap.className = "page-gap";
        gap.setAttribute("aria-hidden", "true");
        return { pos, gap };
      });
      view.dispatch(view.state.tr.setMeta(key, { breaks } satisfies PaginationMeta).setMeta("addToHistory", false));
    }
    const origin = view.dom.getBoundingClientRect().top;
    const tops = breaks.map((at) => at.gap.getBoundingClientRect().top - origin);
    this.width = view.dom.clientWidth;
    this.height = view.dom.getBoundingClientRect().height;
    // Sheet n's text begins n sheets and gaps below the first's.
    const pitch = sheet.height + sheet.gap;
    let pushed = 0;
    breaks.forEach((at, index) => {
      const height = Math.max(0, (index + 1) * pitch - tops[index] - pushed);
      at.gap.style.height = `${height}px`;
      pushed += height;
    });
    this.pushed = pushed;
    this.report(breaks.length + 1);
  }
}
