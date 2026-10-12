import { Extension } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/**
 * Repetitions (owner, 12 October): a word said again close by, and a very long sentence, marked gently on
 * the page in either language, all on her computer. Only the part of the page she sees is looked at and
 * marked, as a chapter's thousands of marks would slow typing down. While she types the marks only move
 * with the text, and the paragraph she types in has none; they are worked out again once she pauses, in
 * time the page has to spare, so typing never waits for them.
 */

/** Words within this many of each other are close enough to echo. */
export const NEAR = 40;
/** A sentence of more words than this is marked. */
export const LONG = 40;
/** The pause in typing after which the marks are worked out again. */
const PAUSE = 700;

/** Small words every sentence needs, in English and Slovenian, and the verbs of dialogue: never an echo. */
const COMMON = new Set(
  (
    "that this with from have were they them their there then than what when which would could should been into your " +
    "will just like only also some more very over about after before said says asked even much such each these those " +
    "here where while upon again still down well because through " +
    "tudi kako kdaj kjer zato tako samo lahko bila bilo bili biti sicer zelo nekaj vendar ampak potem nato vsaj kajti " +
    "kateri katera katero katere katerih njegov njegova njegovo njegove njena njeno njene njim njej njih nisem nisi " +
    "nismo niste nista imel imela imeli bomo boste bodo mene tebe sebe sebi tega temu tisti tista tisto tistega tole " +
    "tale spet zdaj sedaj morda kakor česa čemu komu koga nekdo nekje nihče vsak vsaka vsako svoj svoja svoje svojo " +
    "svojega svojem svojim rekel rekla rekli dejal dejala vprašal vprašala"
  ).split(" "),
);

const TOKEN = /([\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?|\p{N}+)|([.!?…]+)/gu;

/** The same word, or the same word in another form: both long, differing only at the end. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 6 || b.length < 6 || Math.abs(a.length - b.length) > 2) return false;
  const stem = Math.min(a.length, b.length) - 1;
  return a.slice(0, stem) === b.slice(0, stem);
}

export type Repetitions = {
  /** Each word said again close by: where, and the word. */
  echoes: { from: number; to: number; word: string }[];
  /** Each sentence longer than LONG words: where, and how many. */
  long: { from: number; to: number; words: number }[];
};

/**
 * The repetitions on a page, or in part of it (`range`): prose only, as headings and titles are no
 * sentences.
 */
export function findRepetitions(doc: ProseNode, range?: { from: number; to: number }): Repetitions {
  const echoes: Repetitions["echoes"] = [];
  const long: Repetitions["long"] = [];
  const marked = new Set<number>();
  // The last NEAR words, small ones too, as they count towards how near.
  let recent: { from: number; to: number; text: string; lower: string; checked: boolean }[] = [];
  const echo = (word: (typeof recent)[number]) => {
    if (marked.has(word.from)) return;
    marked.add(word.from);
    echoes.push({ from: word.from, to: word.to, word: word.text });
  };
  const visit = (node: ProseNode, pos: number) => {
    if (!node.isTextblock) return true;
    if (node.type.name === "heading") {
      // A heading begins a new stretch of text.
      recent = [];
      return false;
    }
    let sentence: { from: number; to: number; words: number } | null = null;
    const close = () => {
      if (sentence && sentence.words > LONG) long.push({ ...sentence });
      sentence = null;
    };
    node.forEach((child, offset) => {
      if (!child.isText || !child.text) return;
      const start = pos + 1 + offset;
      for (const token of child.text.matchAll(TOKEN)) {
        const from = start + (token.index ?? 0);
        const to = from + token[0].length;
        if (token[2]) {
          close();
          continue;
        }
        if (sentence) {
          sentence.words += 1;
          sentence.to = to;
        } else sentence = { from, to, words: 1 };
        const text = token[1];
        const lower = text.toLowerCase();
        const word = { from, to, text, lower, checked: lower.length >= 4 && !COMMON.has(lower) && /\p{L}/u.test(lower) };
        if (word.checked) {
          for (const before of recent) {
            if (before.checked && sameWord(before.lower, lower)) {
              echo(before);
              echo(word);
            }
          }
        }
        recent.push(word);
        if (recent.length > NEAR) recent.shift();
      }
    });
    close();
    return false;
  };
  if (range) doc.nodesBetween(range.from, range.to, visit);
  else doc.descendants(visit);
  return { echoes, long };
}

export type RepetitionLabels = { again: (word: string) => string; long: (words: number) => string };


/** Where marks are drawn: from one position to another. */
type Range = { from: number; to: number };

/** The marks drawn, and the part of the page they are for. */
type State = { shown: DecorationSet; range: Range };

const key = new PluginKey<State>("repetitions");
const NONE: State = { shown: DecorationSet.empty, range: { from: 0, to: 0 } };

/** How far before the part she sees the words are read too, so a word there can echo in it (in characters). */
const BEFORE = 2000;

/**
 * At most this many words are marked at once, those nearest the middle of what she sees: where more echo,
 * these show the way, and each mark drawn costs typing a little.
 */
export const MOST = 150;

/** The marks for the part of the page she sees. */
function decorate(doc: ProseNode, labels: RepetitionLabels, range: Range): DecorationSet {
  if (range.to <= range.from) return DecorationSet.empty;
  const { echoes, long } = findRepetitions(doc, { from: Math.max(0, range.from - BEFORE), to: range.to });
  const inside = (mark: { from: number; to: number }) => mark.to > range.from && mark.from < range.to;
  let words = echoes.filter(inside);
  if (words.length > MOST) {
    const middle = (range.from + range.to) / 2;
    words = words.sort((a, b) => Math.abs(a.from - middle) - Math.abs(b.from - middle)).slice(0, MOST);
  }
  return DecorationSet.create(doc, [
    ...long.filter(inside).map((sentence) => Decoration.inline(sentence.from, sentence.to, { class: "pv-long-sentence", title: labels.long(sentence.words) })),
    ...words.map((word) => Decoration.inline(word.from, word.to, { class: "pv-echo", title: labels.again(word.word) })),
  ]);
}

/**
 * The part of the page she sees, with half a screen above and below, as positions. The page's blocks are
 * in order down it, so halving finds the ends with only a few of them measured.
 */
function onScreen(view: EditorView): Range {
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

/** Works the marks out again now, for the part of the page she sees: after the switch, and after a pause. */
export function refreshRepetitions(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(key, onScreen(view)).setMeta("addToHistory", false));
}

export const RepetitionMarks = Extension.create<{ isOn: () => boolean; labels: RepetitionLabels }>({
  name: "repetitionMarks",

  addOptions() {
    return { isOn: () => false, labels: { again: (word) => word, long: (words) => String(words) } };
  },

  addProseMirrorPlugins() {
    const { isOn, labels } = this.options;
    return [
      new Plugin<State>({
        key,
        state: {
          init: () => NONE,
          apply: (tr, marks, _old, state) => {
            if (!isOn()) return NONE;
            const range = tr.getMeta(key) as Range | undefined;
            if (range) return { shown: decorate(state.doc, labels, range), range };
            if (!tr.docChanged) return marks;
            // While she types, the marks move with the text; they are worked out again after a pause. The
            // paragraph she types in has none until then, so each key there costs what it would without them.
            let shown = marks.shown.map(tr.mapping, tr.doc);
            const head = tr.selection.$head;
            if (head.parent.isTextblock) {
              const here = shown.find(head.start(), head.end());
              if (here.length > 0) shown = shown.remove(here);
            }
            return { shown, range: { from: tr.mapping.map(marks.range.from), to: tr.mapping.map(marks.range.to) } };
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.shown,
        },
        view: (view) => {
          let timer = 0;
          let idle = 0;
          let scrollTimer = 0;
          const later = () => {
            cancelIdleCallback(idle);
            idle = requestIdleCallback(
              () => {
                if (!view.isDestroyed) refreshRepetitions(view);
              },
              { timeout: 2000 },
            );
          };
          // Another part of the page in sight: its marks are worked out once the scrolling stops.
          const scrolled = () => {
            if (!isOn()) return;
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(() => {
              if (!view.isDestroyed) refreshRepetitions(view);
            }, 150);
          };
          document.addEventListener("scroll", scrolled, { capture: true, passive: true });
          window.addEventListener("resize", scrolled);
          // On already when the page opens: worked out once it is there, not before it shows.
          if (isOn()) later();
          return {
            update: (current, previous) => {
              if (!isOn() || current.state.doc === previous.doc) return;
              window.clearTimeout(timer);
              cancelIdleCallback(idle);
              timer = window.setTimeout(later, PAUSE);
            },
            destroy: () => {
              window.clearTimeout(timer);
              window.clearTimeout(scrollTimer);
              cancelIdleCallback(idle);
              document.removeEventListener("scroll", scrolled, { capture: true });
              window.removeEventListener("resize", scrolled);
            },
          };
        },
      }),
    ];
  },
});
