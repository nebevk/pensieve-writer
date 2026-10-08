import { Extension } from "@tiptap/core";
import { isHistoryTransaction } from "@tiptap/pm/history";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Smooth typing (owner, 8 October; Settings → Appearance): the caret glides to where the next letter
 * goes and blinks only once she pauses, and each letter typed inks in, as Word's own smooth typing does.
 * Both are drawn over the page and never touch the text: a letter is on the page at once, a thin veil
 * of paper over it fades away (an animation the browser runs by itself), and the caret is moved once a
 * frame at most. Marking the letters in the text itself made each key slower on a long chapter.
 */
const key = new PluginKey<Typed | null>("smoothTyping");
// How long a new letter takes to ink in.
const INK_MS = 150;
// Veils in turn, so quick letters each have one.
const VEILS = 4;

type Typed = { from: number; to: number; serial: number };
let serial = 0;

/** A few letters typed at the cursor, not a paste, a drop or an undo. */
function typedRange(tr: Transaction): { from: number; to: number } | null {
  if (!tr.docChanged || tr.steps.length !== 1 || isHistoryTransaction(tr) || tr.getMeta("uiEvent")) return null;
  const step = tr.steps[0];
  if (!(step instanceof ReplaceStep) || step.from !== step.to || step.slice.openStart > 0) return null;
  const size = step.slice.content.size;
  if (size < 1 || size > 4 || !step.slice.content.textBetween(0, size).trim()) return null;
  return { from: step.from, to: step.from + size };
}

export const SmoothTyping = Extension.create<{ isOn: () => boolean }>({
  name: "smoothTyping",

  addOptions() {
    return { isOn: () => false };
  },

  addProseMirrorPlugins() {
    const isOn = this.options.isOn;
    return [
      new Plugin<Typed | null>({
        key,
        state: {
          init: () => null,
          // The letters this transaction typed, for the caret's next frame to ink in.
          apply(tr, last) {
            const typed = isOn() ? typedRange(tr) : null;
            if (typed) return { ...typed, serial: ++serial };
            return tr.docChanged ? null : last;
          },
        },
        view: (view) => new Caret(view, isOn),
      }),
    ];
  },
});

/** Asks the caret to look again (the setting changed). */
export function refreshSmoothTyping(view: EditorView) {
  view.dispatch(view.state.tr.setMeta("smoothTypingRefresh", true).setMeta("addToHistory", false));
}

class Caret {
  private caret: HTMLDivElement;
  private veils: HTMLDivElement[] = [];
  private veilTurn = 0;
  private inked = 0;
  private frame = 0;
  private blinkTimer: ReturnType<typeof setTimeout> | null = null;
  private observer: ResizeObserver;
  private placed = false;
  // What is set now, so a class is only touched when it changes: setting one on the editor itself, even
  // to what it was, has the browser look over every word's style again.
  private shown = false;
  private blinking = false;

  constructor(
    private view: EditorView,
    private isOn: () => boolean,
  ) {
    const host = view.dom.parentElement;
    for (let index = 0; index < VEILS; index += 1) {
      const veil = document.createElement("div");
      veil.className = "ink-veil";
      veil.setAttribute("aria-hidden", "true");
      host?.appendChild(veil);
      this.veils.push(veil);
    }
    this.caret = document.createElement("div");
    this.caret.className = "ink-caret";
    this.caret.setAttribute("aria-hidden", "true");
    host?.appendChild(this.caret);
    view.dom.addEventListener("focus", this.soon);
    view.dom.addEventListener("blur", this.soon);
    view.dom.addEventListener("compositionstart", this.soon);
    view.dom.addEventListener("compositionend", this.soon);
    // The page moving under the caret (sheets, a picture loading, a new size) moves it too.
    this.observer = new ResizeObserver(this.soon);
    this.observer.observe(view.dom);
    this.soon();
  }

  update(view: EditorView) {
    this.view = view;
    this.soon();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    this.observer.disconnect();
    this.view.dom.removeEventListener("focus", this.soon);
    this.view.dom.removeEventListener("blur", this.soon);
    this.view.dom.removeEventListener("compositionstart", this.soon);
    this.view.dom.removeEventListener("compositionend", this.soon);
    this.view.dom.classList.remove("ink-caret-on");
    this.caret.remove();
    for (const veil of this.veils) veil.remove();
  }

  // Once a frame at most, after the page has been laid out for it.
  private soon = () => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.place();
    });
  };

  private hide() {
    this.placed = false;
    if (!this.shown) return;
    this.shown = false;
    this.caret.classList.remove("shown", "gliding");
    this.view.dom.classList.remove("ink-caret-on");
  }

  private place() {
    const view = this.view;
    if (view.isDestroyed || !this.isOn() || !view.hasFocus() || !view.state.selection.empty || view.composing) {
      this.hide();
      return;
    }
    const host = view.dom.parentElement?.getBoundingClientRect();
    if (!host) return;
    this.ink(host);
    // Where the browser's own caret is, which knows the end of a wrapped line from the next line's start.
    const selection = document.getSelection();
    let box: DOMRect | null = null;
    if (selection?.rangeCount) {
      const rects = selection.getRangeAt(0).getClientRects();
      if (rects.length) box = rects[rects.length - 1];
    }
    if (!box || box.height === 0) {
      const at = view.coordsAtPos(view.state.selection.head);
      box = new DOMRect(at.left, at.top, 0, at.bottom - at.top);
    }
    // The first place it shows, it is put there; after that it glides.
    if (this.placed) this.caret.classList.add("gliding");
    const transform = `translate(${box.left - host.left}px, ${box.top - host.top}px)`;
    const moved = this.caret.style.transform !== transform;
    if (moved) this.caret.style.transform = transform;
    const height = `${box.height}px`;
    if (this.caret.style.height !== height) this.caret.style.height = height;
    if (!this.shown) {
      this.shown = true;
      this.caret.classList.add("shown");
      this.view.dom.classList.add("ink-caret-on");
    }
    this.placed = true;
    if (!moved && this.blinking) return;
    // Steady while she types; blinking once she pauses.
    if (this.blinking) {
      this.blinking = false;
      this.caret.classList.remove("blinking");
    }
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    this.blinkTimer = setTimeout(() => {
      this.blinking = true;
      this.caret.classList.add("blinking");
    }, 600);
  }

  /** A veil of paper over the letters just typed, fading away, so they seem to ink in. */
  private ink(host: DOMRect) {
    const typed = key.getState(this.view.state);
    if (!typed || typed.serial === this.inked) return;
    this.inked = typed.serial;
    const start = this.view.coordsAtPos(typed.from, 1);
    const end = this.view.coordsAtPos(typed.to, -1);
    // Letters that started a new line (the line wrapped) just appear.
    if (Math.abs(start.top - end.top) > 2 || end.right <= start.left) return;
    const veil = this.veils[this.veilTurn];
    this.veilTurn = (this.veilTurn + 1) % this.veils.length;
    veil.style.transform = `translate(${start.left - host.left}px, ${start.top - host.top}px)`;
    veil.style.width = `${end.right - start.left + 1}px`;
    veil.style.height = `${end.bottom - start.top}px`;
    veil.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: INK_MS, easing: "ease-out", fill: "forwards" });
  }
}
