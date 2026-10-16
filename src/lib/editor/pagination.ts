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

/** Where a pass begins: at a block, on a sheet whose text begins `start` px down the page, the breaks before kept. */
type Resume = { block: number; start: number; kept: number[] };

/**
 * Where each sheet's text ends, measured down the page as it lies without breaks: the position of the
 * first line that no longer fits. A heading at the foot of a sheet goes over with the text it heads,
 * and a picture or a rule goes over whole. From a sheet on (`from`), the breaks before it stay up and
 * its text begins where they put it.
 */
function findBreaks(view: EditorView, sheet: SheetGeometry, from: Resume = { block: 0, start: 0, kept: [] }): number[] {
  const room = sheet.height - sheet.top - sheet.bottom;
  const origin = view.dom.getBoundingClientRect().top;
  const breaks = [...from.kept];
  // Where the open sheet's text begins.
  let start = from.start;
  let lastHeading: { from: number; top: number } | null = null;

  const charBox = (pos: number, side: number) => view.coordsAtPos(pos, side);
  const breakAt = (pos: number, top: number) => {
    breaks.push(pos);
    start = top;
  };

  // The line a position is on begins where the character before it sits a line higher, at a letter:
  // the space a line wraps at stays at the end of the line before (where it is measured can vary). The
  // characters before it on its line are a run ending at it, so its first is found by halving.
  function lineStart(pos: number, from: number) {
    const here = charBox(pos, 1);
    const half = (here.bottom - here.top) / 2;
    const onLine = (at: number) => charBox(at, -1).bottom > here.bottom - half;
    let low = from + 1;
    let high = pos + 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (onLine(middle)) high = middle;
      else low = middle + 1;
    }
    let at = low - 1;
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

  view.state.doc.forEach((node, offset, index) => {
    if (index >= from.block) block(node, offset);
  });
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

/**
 * What asked for a pass: the sheet chosen, an edit, a new width (these always count), or the text's own
 * height changing by itself (a font or a picture loading).
 */
type Reason = "sheet" | "text" | "width" | "height";
const COUNTS: Reason[] = ["sheet", "text", "width"];
// Passes in a row that only the text's own height asked for, after which the breaks stay put until the
// next edit: a page that kept changing size by itself would otherwise be measured again and again, and
// seen to flicker (owner, 8 October).
const RESTLESS = 3;

/** A block of the page as the last pass left it: how tall it was, and whether a sheet ends in it. */
type Block = { node: PmNode; height: number; holdsBreak: boolean };

class Paginator {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frame = 0;
  private observer: ResizeObserver;
  private reason: Reason | null = null;
  private restless = 0;
  private lastPass = 0;
  // The text's size as the last pass left it, breaks and all: a resize that leaves it so asks for nothing.
  private width = 0;
  private height = 0;
  private sheets = 0;
  // The blocks as the last pass left them (ARCH-9); whether only edits and sizes asked for a pass since, not a new
  // width or sheet; and whether the text's height changed meanwhile, by an edit or by itself (a picture, a font).
  private blocks: Block[] = [];
  private onlyEdits = false;
  private grew = false;

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
    if (sheet !== (key.getState(previous)?.sheet ?? null)) this.soon("sheet", 0);
    else if (sheet && view.state.doc !== previous.doc) this.soon("text");
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    document.fonts?.removeEventListener("loadingdone", this.fontsLoaded);
  }

  // A font that loaded matters only if it changed the text's size.
  private fontsLoaded = () => this.resized();

  private soon(reason: Reason, delay = PAUSE) {
    if (reason === "sheet" || reason === "width") this.onlyEdits = false;
    if (reason === "height") this.grew = true;
    // A reason that counts isn't taken over by one that may not.
    if (!(this.reason && COUNTS.includes(this.reason) && !COUNTS.includes(reason))) this.reason = reason;
    // Right away (a chapter opening, a new sheet size) means before the next paint, so the text is never
    // seen without its breaks, and nothing later puts that off; otherwise once typing pauses.
    if (this.frame) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (delay === 0) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.paginate();
      });
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.paginate();
    }, delay);
  }

  private resized() {
    if (!key.getState(this.view.state)?.sheet) return;
    if (this.view.dom.clientWidth !== this.width) this.soon("width");
    else if (Math.abs(this.view.dom.getBoundingClientRect().height - this.height) > 2) this.soon("height");
  }

  /** For the Console, should Pages misbehave again: the breaks on the page, and the ones this pass knows. */
  private describe(): string {
    const onPage = [...this.view.dom.querySelectorAll<HTMLElement>(".page-gap")];
    const known = key.getState(this.view.state)?.breaks ?? [];
    const tall = onPage.reduce((sum, gap) => sum + gap.getBoundingClientRect().height, 0);
    return `breaks on the page ${onPage.length} (hidden ${onPage.filter((gap) => gap.classList.contains("measuring")).length}, ${Math.round(tall)} px), known ${known.length} (on the page ${known.filter((at) => at.gap.isConnected).length})`;
  }

  // Every pass, so the page can line up what sits beside the text (the comment cards) again.
  private report(count: number) {
    this.sheets = count;
    this.onSheets(count);
  }

  private settle() {
    this.width = this.view.dom.clientWidth;
    this.height = this.view.dom.getBoundingClientRect().height;
  }

  /** Each block's height and whether a sheet ends in it, as this pass leaves them; read on the layout just made. */
  private record() {
    const { doc } = this.view.state;
    const breaks = key.getState(this.view.state)?.breaks ?? [];
    this.blocks = [];
    doc.forEach((node, offset) => {
      const dom = this.view.nodeDOM(offset);
      this.blocks.push({
        node,
        height: dom instanceof HTMLElement ? dom.getBoundingClientRect().height : -1,
        holdsBreak: breaks.some((at) => at.pos >= offset && at.pos <= offset + node.nodeSize),
      });
    });
    this.onlyEdits = true;
    this.grew = false;
  }

  /** Whether the block at `offset` is no longer as tall as the last pass left it. */
  private outgrew(offset: number, was: Block): boolean {
    const dom = this.view.nodeDOM(offset);
    return !(dom instanceof HTMLElement) || Math.abs(dom.getBoundingClientRect().height - was.height) > 0.5;
  }

  /**
   * Whether nothing since the last pass moved a break: the same blocks, none a sheet ends in changed (its lines
   * may wrap anew), and each one changed (or each one at all, when the text's height changed) as tall as it
   * was, so all below it lies where it lay. Its breaks have moved with the text, and are where a pass would
   * put them.
   */
  private unmoved(): boolean {
    const { doc } = this.view.state;
    if (doc.childCount !== this.blocks.length) return false;
    let offset = 0;
    for (let index = 0; index < doc.childCount; index += 1) {
      const node = doc.child(index);
      const was = this.blocks[index];
      if (node !== was.node && was.holdsBreak) return false;
      if ((node !== was.node || this.grew) && this.outgrew(offset, was)) return false;
      offset += node.nodeSize;
    }
    return true;
  }

  /**
   * Where a pass after edits begins: the sheet the first block they changed begins on, or the first block no longer
   * as tall as it was when the text's height changed (its break, and those after, measured again; one at the very
   * start of that block too, as whether it goes over may have changed), and the block that sheet begins in.
   */
  private resumeAt(breaks: SheetBreak[]): { sheet: number; block: number } {
    const { doc } = this.view.state;
    const same = Math.min(doc.childCount, this.blocks.length);
    let offset = 0;
    for (let index = 0; index < same; index += 1) {
      const node = doc.child(index);
      const was = this.blocks[index];
      if (node !== was.node || (this.grew && this.outgrew(offset, was))) break;
      offset += node.nodeSize;
    }
    const sheet = breaks.filter((at) => at.pos < offset).length;
    if (sheet === 0) return { sheet: 0, block: 0 };
    const begins = breaks[sheet - 1].pos;
    let block = 0;
    doc.forEach((_node, at, index) => {
      if (at <= begins) block = index;
    });
    return { sheet, block };
  }

  private paginate() {
    const view = this.view;
    const reason = this.reason ?? "height";
    this.reason = null;
    if (!view.dom.isConnected) return;
    // Not in the middle of a word being composed (an accent typed in two keys): after it.
    if (view.composing) {
      this.soon(reason);
      return;
    }
    const state = key.getState(view.state);
    const sheet = state?.sheet ?? null;
    if (!state || !sheet) {
      if (this.sheets !== 1) this.report(1);
      return;
    }
    if (COUNTS.includes(reason)) this.restless = 0;
    else if (++this.restless > RESTLESS) {
      if (import.meta.env.DEV && this.restless === RESTLESS + 1) {
        console.info(`[Pages] The text keeps changing size by itself (${this.width}×${Math.round(this.height)} → ${view.dom.clientWidth}×${Math.round(view.dom.getBoundingClientRect().height)}); the breaks stay until the next edit. ${this.describe()}`);
      }
      this.settle();
      return;
    }
    // After edits, or a block growing by itself, with the width and the sheet as they were (ARCH-9): typing that
    // left every paragraph as tall as it was, in none a sheet ends in, moved no break (most pauses are so); else
    // the sheets before the first block that changed end where they did, and the pass begins on the sheet that
    // block begins on. Measuring the whole chapter again is the slow part of a pause.
    const since = (reason === "text" || reason === "height") && this.onlyEdits;
    if (since && this.unmoved()) return;
    const began = performance.now();
    // Sheet n's text begins n sheets and gaps below the first's.
    const pitch = sheet.height + sheet.gap;
    const from = since ? this.resumeAt(state.breaks) : { sheet: 0, block: 0 };
    const kept = state.breaks.slice(0, from.sheet);
    // Measure the text as it lies without those breaks: they step aside (the editor ignores changes
    // inside its widgets), then lie flat where they belong, and each is made as tall as it must be.
    for (const at of state.breaks.slice(kept.length)) at.gap.classList.add("measuring");
    const found = findBreaks(view, sheet, { block: from.block, start: kept.length * pitch, kept: kept.map((at) => at.pos) });
    let breaks = state.breaks;
    const moved = !(found.length === breaks.length && found.every((pos, index) => pos === breaks[index].pos));
    if (!moved) {
      // The usual case: no break moved, so only their heights change and no line is drawn again.
      for (const at of breaks.slice(kept.length)) {
        at.gap.style.height = "0px";
        at.gap.classList.remove("measuring");
      }
    } else {
      // The breaks kept keep their gaps, as tall as they are.
      breaks = [
        ...kept,
        ...found.slice(kept.length).map((pos) => {
          const gap = document.createElement("span");
          gap.className = "page-gap";
          gap.setAttribute("aria-hidden", "true");
          return { pos, gap };
        }),
      ];
      view.dispatch(view.state.tr.setMeta(key, { breaks } satisfies PaginationMeta).setMeta("addToHistory", false));
    }
    const origin = view.dom.getBoundingClientRect().top;
    const measured = breaks.slice(kept.length);
    const tops = measured.map((at) => at.gap.getBoundingClientRect().top - origin);
    let pushed = 0;
    measured.forEach((at, index) => {
      const height = Math.max(0, (kept.length + index + 1) * pitch - tops[index] - pushed);
      at.gap.style.height = `${height}px`;
      pushed += height;
    });
    const before = { width: this.width, height: this.height };
    this.settle();
    this.record();
    // Should Pages misbehave again: passes that come hard on each other's heels say why they came.
    if (import.meta.env.DEV && began - this.lastPass < 1000) {
      console.info(`[Pages] pass (${reason}): ${Math.round(performance.now() - began)} ms, ${moved ? "breaks moved" : "same breaks"}, ${breaks.length + 1} sheets, text ${before.width}×${Math.round(before.height)} → ${this.width}×${Math.round(this.height)}, breaks add ${Math.round(pushed)} px; ${this.describe()}`);
    }
    this.lastPass = performance.now();
    this.report(breaks.length + 1);
  }
}
