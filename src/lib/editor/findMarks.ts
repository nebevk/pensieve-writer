import { Extension } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { onScreen, type Range } from "./onScreen";
import { findPattern, type FindOptions } from "./findPattern";

/**
 * Find on the page (owner, 13 October): every place the words are is marked, the one she is at more
 * strongly, and counted ("2 of 7"), matched as findPattern says. Words are matched within each line, so
 * words partly in bold are found too. As with the repetitions, only the marks on the part of the page she
 * sees are drawn, and while she types they move with the text and are worked out again once she pauses,
 * so typing never waits for them.
 */

export type Match = { from: number; to: number };
/** How many matches the page has, and which she is at (from 0; -1 before she is at one). */
export type Found = { current: number; total: number };

/** What stands for anything in a line that isn't text (a footnote, a line break): no word has it. */
export const OBJECT = String.fromCharCode(0xfffc);

/** Every match on a page, in order down it. */
export function findMatches(doc: ProseNode, query: string, options: FindOptions): Match[] {
  const pattern = findPattern(query, options);
  if (!pattern) return [];
  const found: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // The line's text, with anything else in it (a footnote, a line break) as one character for each place
    // it takes, so a place in the text is the same place on the page.
    let text = "";
    node.forEach((child) => {
      text += child.isText ? (child.text ?? "") : OBJECT.repeat(child.nodeSize);
    });
    for (const match of text.matchAll(pattern)) {
      const from = pos + 1 + (match.index ?? 0);
      found.push({ from, to: from + match[0].length });
    }
    return false;
  });
  return found;
}

type State = {
  query: string;
  options: FindOptions;
  matches: Match[];
  current: number;
  shown: DecorationSet;
  range: Range;
};

type Meta =
  | { set: Pick<State, "query" | "options" | "matches" | "current"> }
  | { range: Range }
  | { recount: true }
  | { clear: true };

const key = new PluginKey<State>("findMarks");
const NONE: State = {
  query: "",
  options: { matchCase: false, wholeWord: false },
  matches: [],
  current: -1,
  shown: DecorationSet.empty,
  range: { from: 0, to: 0 },
};

/** The pause in typing after which the matches are counted again. */
const PAUSE = 500;
/** At most this many marks are drawn at once; each one drawn costs typing a little. */
const MOST = 400;

/** The marks for the part of the page she sees, and always the one she is at. */
function decorate(doc: ProseNode, value: Pick<State, "matches" | "current">, range: Range): DecorationSet {
  if (value.matches.length === 0) return DecorationSet.empty;
  const at = value.matches[value.current];
  const near = value.matches.filter((match, index) => index !== value.current && match.to > range.from && match.from < range.to).slice(0, MOST);
  return DecorationSet.create(doc, [
    ...(at ? [Decoration.inline(at.from, at.to, { class: "pv-find pv-find-current" })] : []),
    ...near.map((match) => Decoration.inline(match.from, match.to, { class: "pv-find" })),
  ]);
}

/** The first match at or after `from`, round to the first; -1 when there are none. */
function firstFrom(matches: Match[], from: number): number {
  if (matches.length === 0) return -1;
  const index = matches.findIndex((match) => match.from >= from);
  return index < 0 ? 0 : index;
}

/** What find has on the page now. */
export function foundOnPage(state: EditorState): Found {
  const value = key.getState(state);
  return { current: value?.current ?? -1, total: value?.matches.length ?? 0 };
}

/** The words find looks for on this page, and how. */
export function findQueryOf(state: EditorState): { query: string; options: FindOptions } {
  const value = key.getState(state) ?? NONE;
  return { query: value.query, options: value.options };
}

/** Moves the page so the match is in sight, a little above the middle, unless it is in sight already. */
function bringIntoSight(view: EditorView, match: Match) {
  let scroller = view.dom.parentElement;
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) {
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const coords = view.coordsAtPos(match.from);
  const box = scroller.getBoundingClientRect();
  // Find's own box is over the top of the page: a match under it isn't in sight.
  if (coords.top > box.top + 190 && coords.bottom < box.bottom - 60) return;
  scroller.scrollTop += coords.top - (box.top + box.height * 0.45);
}

/** Puts the matches and the one she is at on the page, that one selected and in sight, its neighbours marked. */
function show(view: EditorView, tr: Transaction, set: Pick<State, "query" | "options" | "matches" | "current">) {
  const at = set.matches[set.current];
  if (at) tr.setSelection(TextSelection.create(tr.doc, at.from, at.to));
  // A replace is hers to undo; only moving from match to match stays out of Undo.
  if (!tr.docChanged) tr.setMeta("addToHistory", false);
  view.dispatch(tr.setMeta(key, { set } satisfies Meta));
  if (at) bringIntoSight(view, at);
  view.dispatch(view.state.tr.setMeta(key, { range: onScreen(view) } satisfies Meta).setMeta("addToHistory", false));
}

/**
 * Looks for the words on the page: every place is marked, and the first from the cursor on (or from
 * `from`) is the one she is at, selected and in sight. Typed letter by letter, it goes on from there.
 */
export function searchPage(view: EditorView, query: string, options: FindOptions, from = view.state.selection.from): Found {
  const matches = findMatches(view.state.doc, query, options);
  show(view, view.state.tr, { query, options, matches, current: firstFrom(matches, from) });
  return foundOnPage(view.state);
}

/** Looks for the words and goes to the `nth` time they are from `start` on: the place find's list pointed to. */
export function searchPageAt(view: EditorView, query: string, options: FindOptions, nth: number, start = 0): Found {
  const matches = findMatches(view.state.doc, query, options);
  const first = matches.findIndex((match) => match.from >= start);
  const current = first < 0 ? firstFrom(matches, 0) : Math.min(matches.length - 1, first + nth);
  show(view, view.state.tr, { query, options, matches, current });
  return foundOnPage(view.state);
}

/** The next match (`step` 1) or the one before (-1), round the page. */
export function stepMatch(view: EditorView, step: 1 | -1): Found {
  const value = key.getState(view.state) ?? NONE;
  const matches = findMatches(view.state.doc, value.query, value.options);
  if (matches.length === 0) return searchPage(view, value.query, value.options);
  const was = value.matches[value.current];
  // Counted again first, as she may have written since; from the one she was at, else from the cursor.
  let current: number;
  if (was) {
    const same = matches.findIndex((match) => match.from === was.from);
    current = same >= 0 ? same + step : step > 0 ? firstFrom(matches, was.from) : firstFrom(matches, was.from) - 1;
  } else {
    current = step > 0 ? firstFrom(matches, view.state.selection.from) : firstFrom(matches, view.state.selection.from) - 1;
  }
  current = (current + matches.length) % matches.length;
  show(view, view.state.tr, { ...value, matches, current });
  return foundOnPage(view.state);
}

/** The match she is at becomes `replacement`, and the next one is found. Says whether there was one to replace. */
export function replaceMatch(view: EditorView, replacement: string): boolean {
  const value = key.getState(view.state) ?? NONE;
  const matches = findMatches(view.state.doc, value.query, value.options);
  const was = value.matches[value.current];
  const at = was ? matches.find((match) => match.from === was.from && match.to === was.to) : undefined;
  if (!at) {
    // Not at one (or the text changed under it): go to the next one first, as Word does.
    searchPage(view, value.query, value.options);
    return false;
  }
  const tr = view.state.tr.insertText(replacement, at.from, at.to);
  const next = findMatches(tr.doc, value.query, value.options);
  show(view, tr, { ...value, matches: next, current: firstFrom(next, at.from + replacement.length) });
  return true;
}

/**
 * Every match from `start` on becomes `replacement`, in one step Undo takes back: of the words find looks
 * for, or of `find`'s. Says how many.
 */
export function replaceEveryMatch(view: EditorView, replacement: string, start = 0, find?: { query: string; options: FindOptions }): number {
  const { query, options } = find ?? key.getState(view.state) ?? NONE;
  const matches = findMatches(view.state.doc, query, options).filter((match) => match.from >= start);
  if (matches.length === 0) return 0;
  const tr = view.state.tr;
  for (const match of [...matches].reverse()) tr.insertText(replacement, match.from, match.to);
  const next = findMatches(tr.doc, query, options);
  show(view, tr, { query, options, matches: next, current: -1 });
  return matches.length;
}

/** Find closed: no marks, and nothing looked for. */
export function clearFind(view: EditorView) {
  if (!key.getState(view.state)?.query) return;
  view.dispatch(view.state.tr.setMeta(key, { clear: true } satisfies Meta).setMeta("addToHistory", false));
}

/**
 * Find's work on the page, kept on the editor (`editor.storage.findMarks`), so the app reaches it through
 * the page it has without loading the editor's code before the page opens.
 */
export type FindTools = {
  matches: typeof findMatches;
  search: typeof searchPage;
  searchAt: typeof searchPageAt;
  step: typeof stepMatch;
  replace: typeof replaceMatch;
  replaceAll: typeof replaceEveryMatch;
  clear: typeof clearFind;
  found: typeof foundOnPage;
  queryOf: typeof findQueryOf;
};

export const FindMarks = Extension.create<{ onFound: (found: Found) => void }, FindTools>({
  name: "findMarks",

  addOptions() {
    return { onFound: () => {} };
  },

  addStorage() {
    return {
      matches: findMatches,
      search: searchPage,
      searchAt: searchPageAt,
      step: stepMatch,
      replace: replaceMatch,
      replaceAll: replaceEveryMatch,
      clear: clearFind,
      found: foundOnPage,
      queryOf: findQueryOf,
    };
  },

  addProseMirrorPlugins() {
    const { onFound } = this.options;
    return [
      new Plugin<State>({
        key,
        state: {
          init: () => NONE,
          apply: (tr, value, _old, state) => {
            const meta = tr.getMeta(key) as Meta | undefined;
            if (meta && "clear" in meta) return NONE;
            if (meta && "set" in meta) return { ...value, ...meta.set, shown: decorate(state.doc, meta.set, value.range) };
            if (meta && "range" in meta) return { ...value, range: meta.range, shown: decorate(state.doc, value, meta.range) };
            if (meta && "recount" in meta) {
              const was = value.matches[value.current];
              const matches = findMatches(state.doc, value.query, value.options);
              const current = was ? matches.findIndex((match) => match.from === was.from) : -1;
              return { ...value, matches, current, shown: decorate(state.doc, { matches, current }, value.range) };
            }
            if (!value.query || !tr.docChanged) return value;
            // While she types, the marks move with the text; they are counted again after a pause. The
            // paragraph she types in has none until then, so each key there costs what it would without them.
            const was = value.matches[value.current];
            let current = -1;
            const matches: Match[] = [];
            for (const match of value.matches) {
              const from = tr.mapping.mapResult(match.from, 1);
              const to = tr.mapping.mapResult(match.to, -1);
              if (from.deleted || to.deleted || to.pos <= from.pos) continue;
              if (match === was) current = matches.length;
              matches.push({ from: from.pos, to: to.pos });
            }
            const range = { from: tr.mapping.map(value.range.from), to: tr.mapping.map(value.range.to) };
            let shown = value.shown.map(tr.mapping, tr.doc);
            const head = tr.selection.$head;
            if (head.parent.isTextblock) {
              const here = shown.find(head.start(), head.end());
              if (here.length > 0) shown = shown.remove(here);
            }
            return { ...value, matches, current, range, shown };
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.shown,
        },
        view: (view) => {
          let timer = 0;
          let scrollTimer = 0;
          let idle = 0;
          const active = () => !view.isDestroyed && !!key.getState(view.state)?.query;
          // Another part of the page in sight: its marks are drawn once the scrolling stops.
          const scrolled = () => {
            if (!active()) return;
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(() => {
              if (active()) view.dispatch(view.state.tr.setMeta(key, { range: onScreen(view) } satisfies Meta).setMeta("addToHistory", false));
            }, 150);
          };
          document.addEventListener("scroll", scrolled, { capture: true, passive: true });
          window.addEventListener("resize", scrolled);
          return {
            update: (current, previous) => {
              const now = key.getState(current.state);
              const before = key.getState(previous);
              // Told only when the count or the one she is at changes, not as the matches move with her typing.
              if (now && before && (now.matches.length !== before.matches.length || now.current !== before.current)) {
                onFound({ current: now.current, total: now.matches.length });
              }
              if (!now?.query || current.state.doc === previous.doc) return;
              window.clearTimeout(timer);
              cancelIdleCallback(idle);
              timer = window.setTimeout(() => {
                idle = requestIdleCallback(
                  () => {
                    if (active()) view.dispatch(view.state.tr.setMeta(key, { recount: true } satisfies Meta).setMeta("addToHistory", false));
                  },
                  { timeout: 2000 },
                );
              }, PAUSE);
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
