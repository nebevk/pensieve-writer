import { Extension, getTextBetween, getTextSerializersFromSchema, type Editor } from "@tiptap/core";
import { isHistoryTransaction } from "@tiptap/pm/history";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { leadLines } from "$lib/chapters/page";

/**
 * A chapter's page (see `$lib/chapters/page.ts`): the first line is the chapter's title, a Heading 2,
 * after the part's name, a Heading 1, where a part begins. Empty ones say what goes there, and the
 * title line comes back when it is deleted, so the page always has one.
 *
 * A Heading 2 below the title starts a new chapter, so nothing may push the title down a line: Enter
 * and Backspace move between the two lines instead of splitting or joining them, and the two lines keep
 * their style. Both lines hold plain text, as the chapter list does: a comment, footnote or link there
 * would have nowhere to be saved.
 */

const levelOf = (node: ProseNode | null | undefined) => (node?.type.name === "heading" ? Number(node.attrs.level) : 0);

/** Whether a line holds a comment, footnote or note link, which the part and title lines have no place for. */
function holdsNotes(node: ProseNode): boolean {
  let found = false;
  node.descendants((child) => {
    if (child.type.name === "footnote" || child.marks.some((mark) => mark.type.name === "comment" || mark.type.name === "noteLink")) found = true;
    return !found;
  });
  return found;
}

/** Where block `index` of the page starts. */
function startOf(doc: ProseNode, index: number): number {
  let position = 0;
  for (let at = 0; at < index; at += 1) position += doc.child(at).nodeSize;
  return position;
}

/** The line the cursor is in: 1 the part line, 2 the title line, 0 the text below them. */
function lineAt(state: EditorState): 0 | 1 | 2 {
  const index = state.selection.$from.index(0);
  if (index >= leadLines(state.doc)) return 0;
  return levelOf(state.doc.child(index)) === 1 ? 1 : 2;
}

type Dispatch = (tr: Transaction) => void;

/**
 * Enter on the part line goes on to the title line. On the title line it ends the title, as usual,
 * at its end; in its middle the rest becomes the first line of text; at its start it opens a part line
 * above, where there is none (it stays only if a name is typed in it).
 */
export function enterInLeadLines(state: EditorState, dispatch: Dispatch): boolean {
  const { selection, doc, schema } = state;
  const line = lineAt(state);
  if (line === 0) return false;
  const { $from } = selection;
  const index = $from.index(0);
  if (!selection.empty) {
    // Over a selection, Enter takes it away first. In the title the rest then becomes a line of text, as
    // in its middle, never a second title; text pulled up into the part line goes back below (fixLeadLines).
    const tr = state.tr.deleteSelection();
    const $at = tr.doc.resolve(tr.mapping.map($from.pos));
    if (line === 2 && levelOf($at.parent) === 2 && $at.parentOffset > 0) tr.split($at.pos, 1, [{ type: schema.nodes.paragraph }]);
    dispatch(tr);
    return true;
  }
  if (line === 1) {
    const title = doc.maybeChild(index + 1);
    if (!title) return false;
    dispatch(state.tr.setSelection(TextSelection.create(doc, startOf(doc, index + 1) + 1 + title.content.size)));
    return true;
  }
  const node = doc.child(index);
  if ($from.parentOffset === node.content.size) return false;
  if ($from.parentOffset > 0) {
    dispatch(state.tr.split($from.pos, 1, [{ type: schema.nodes.paragraph }]));
    return true;
  }
  if (index === 0) {
    const tr = state.tr.insert(0, schema.nodes.heading.create({ level: 1 }));
    dispatch(tr.setSelection(TextSelection.create(tr.doc, 1)));
  }
  return true;
}

/**
 * Backspace at the start of the title goes up to the part line's end instead of joining the two; in an
 * empty part line it takes the line away. Nothing comes before a part line, so there it stops. At the
 * start of the first line of text it doesn't join that line to the title, where its comments and
 * formatting would have no place; an empty line still goes.
 */
export function backspaceInLeadLines(state: EditorState, dispatch: Dispatch): boolean {
  const { selection, doc } = state;
  const line = lineAt(state);
  if (!selection.empty || selection.$from.parentOffset > 0) return false;
  const index = selection.$from.index(0);
  if (line === 0) {
    const first = index === leadLines(doc) && selection.$from.depth === 1;
    return first && index > 0 && selection.$from.parent.content.size > 0;
  }
  if (line === 1) {
    if (doc.child(index).content.size === 0) {
      const tr = state.tr.delete(0, doc.child(0).nodeSize);
      dispatch(tr.setSelection(TextSelection.create(tr.doc, 1)));
    }
    return true;
  }
  if (index > 0) dispatch(state.tr.setSelection(TextSelection.create(doc, doc.child(0).nodeSize - 1)));
  return true;
}

/**
 * Delete at the end of the part line leaves the title its own line, and an empty part line goes. At the
 * end of the title it doesn't pull the first line of text up into it; an empty one still goes.
 */
export function deleteInLeadLines(state: EditorState, dispatch: Dispatch): boolean {
  const { selection, doc } = state;
  const line = lineAt(state);
  if (line === 0 || !selection.empty) return false;
  const index = selection.$from.index(0);
  const node = doc.child(index);
  if (selection.$from.parentOffset < node.content.size) return false;
  if (line === 2) {
    const next = doc.maybeChild(index + 1);
    return !!next && !(next.isTextblock && next.content.size === 0);
  }
  if (node.content.size === 0) {
    const tr = state.tr.delete(0, node.nodeSize);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, 1)));
  }
  return true;
}

/** Where a position on the page before an edit is now; `assoc` -1 keeps it before text put in right there. */
type Now = (pos: number, assoc?: number) => number;

/**
 * Puts back the line break an edit took away under the part or title line: a Ctrl+Backspace at the
 * start of the text, a Ctrl+Delete at the end of the title, or a selection deleted from the title into
 * the text, a quote or a list. What came up from below goes back to its own line, as it was, so its
 * comments, footnotes and formatting stay with it rather than being dropped from a plain-text line.
 */
function keepTextBelow(before: ProseNode, tr: Transaction, now: Now): void {
  const splits = new Map<number, ProseNode | null>();
  // The first line of text in block `index`, which starts at `start`: that line, or the first one in a
  // quote or a list, or past a picture.
  const firstText = (index: number, start: number) =>
    before.child(index).isTextblock ? start + 1 : Selection.findFrom(before.resolve(start), 1, true)?.from;
  for (let index = 0; index < leadLines(before); index += 1) {
    if (index + 1 >= before.childCount) continue;
    const first = firstText(index + 1, startOf(before, index + 1));
    if (first === undefined) continue;
    // Where this line and the one below began, now: both in this line, still what it was, they were
    // joined. A line taken away altogether ends up between blocks, or in the line below it.
    const line = now(startOf(before, index) + 1);
    const pos = now(first);
    if (pos > tr.doc.content.size || line > tr.doc.content.size) continue;
    const $line = tr.doc.resolve(line);
    const $pos = tr.doc.resolve(pos);
    const joined =
      $line.depth === 1 &&
      $pos.depth === 1 &&
      $pos.index(0) === $line.index(0) &&
      levelOf($line.parent) === levelOf(before.child(index)) &&
      $pos.index(0) < leadLines(tr.doc);
    if (!joined || $pos.parentOffset >= $pos.parent.content.size) continue;
    // The text there is from the lowest line that came up to it: the lines between were taken away whole
    // (a title selected with its line breaks), so it keeps its own style, not theirs.
    let below = index + 1;
    for (let start = startOf(before, below); below + 1 < before.childCount; below += 1) {
      start += before.child(below).nodeSize;
      const next = firstText(below + 1, start);
      if (next === undefined || now(next) !== pos) break;
    }
    const node = before.child(below);
    // Text from a quote or a list comes back as a line of text, and so does a Heading 1 or 2 from the text,
    // which would otherwise start a part or chapter here.
    const keep = node.isTextblock && (below < leadLines(before) || levelOf(node) < 1 || levelOf(node) > 2);
    splits.set(pos, keep ? node : null);
  }
  for (const [pos, below] of [...splits].sort((a, b) => b[0] - a[0])) {
    tr.split(pos, 1, [below ? { type: below.type, attrs: below.attrs } : { type: tr.doc.type.schema.nodes.paragraph }]);
  }
}

/**
 * A picture, a rule or whole lines pasted into the middle of the part or title line cut it in two. The
 * rest of the line goes on as a line of text, as after Enter in its middle, never a second part or title
 * line further down that would start a part or chapter.
 */
function keepSplitTails(before: ProseNode, tr: Transaction, transactions: readonly Transaction[]): void {
  const edit = new Mapping(transactions.flatMap((transaction) => transaction.mapping.maps));
  for (let index = 0; index < leadLines(before); index += 1) {
    const old = before.child(index);
    const start = startOf(before, index) + 1;
    // Where the line's first character is now, and its last one, if the edit didn't take that away.
    const last = edit.mapResult(start + old.content.size, -1);
    if (old.content.size === 0 || last.deletedBefore) continue;
    const from = tr.mapping.map(edit.map(start));
    const to = tr.mapping.map(last.pos, -1);
    if (from > tr.doc.content.size || to > tr.doc.content.size) continue;
    const $to = tr.doc.resolve(to);
    if ($to.depth === 1 && tr.doc.resolve(from).index(0) < $to.index(0) && levelOf($to.parent) === levelOf(old)) {
      tr.setNodeMarkup($to.before(1), tr.doc.type.schema.nodes.paragraph);
    }
  }
}

/**
 * The part and title lines keep their style: one made ordinary text or another heading goes back to
 * what it was. Only a line that is still all there counts, so one taken away with a selection isn't
 * brought back under another line's name.
 */
function keepLeadStyles(before: ProseNode, tr: Transaction, now: Now): void {
  for (let index = 0; index < leadLines(before); index += 1) {
    const old = before.child(index);
    const from = tr.mapping.map(now(startOf(before, index) + 1));
    const to = tr.mapping.map(now(startOf(before, index) + old.nodeSize - 1));
    if (to > tr.doc.content.size || from > to) continue;
    const $from = tr.doc.resolve(from);
    const node = $from.parent;
    if ($from.depth !== 1 || !node.isTextblock || (node.type === old.type && node.attrs.level === old.attrs.level)) continue;
    // Only the line itself, still in its place: text pasted onto it leaves it a line of text, as typing would.
    const whole =
      $from.index(0) === index &&
      node.content.size === old.content.size &&
      (old.content.size === 0 || (to - from === old.content.size && tr.doc.textBetween(from, to) === old.textContent));
    if (whole) tr.setNodeMarkup($from.before(1), old.type, { ...old.attrs });
  }
}

/**
 * Puts the title line back at the top after an edit. Whatever was put above it, a picture or an empty
 * line, goes below it (an empty line goes altogether), with the part line, if there was one, back on
 * top: the title never ends up a second Heading 2 that would start a chapter. With no title line left
 * at all, an empty one comes back.
 */
function keepTitleLine(before: ProseNode, tr: Transaction, now: Now): void {
  const where = (pos: number, level: number, assoc: number) => {
    const mapped = tr.mapping.map(now(pos, assoc), assoc);
    if (mapped > tr.doc.content.size) return -1;
    const $pos = tr.doc.resolve(mapped);
    return $pos.depth === 1 && levelOf($pos.parent) === level ? $pos.index(0) : -1;
  };
  const lines = leadLines(before);
  // The part line by its start, on the near side, so lines pasted at its very start leave it on top;
  // unless that is an empty line a block was put before, and the part line went on past it.
  const near = where(1, 1, -1);
  const far = where(1, 1, 1);
  const part = levelOf(before.maybeChild(0)) !== 1 ? -1 : near >= 0 && (tr.doc.child(near).content.size > 0 || far < 0) ? near : far;
  // The title first by its start, on the near side, so lines pasted there stay the title; failing that
  // by its end. A title taken away whole, with the line breaks around it, leads back up by either, not
  // on to the line below, which may be a heading with a comment or footnote from the text.
  const hadTitle = lines > 0 && levelOf(before.child(lines - 1)) === 2;
  const byStart = hadTitle ? where(startOf(before, lines - 1) + 1, 2, -1) : -1;
  const byEnd = hadTitle ? where(startOf(before, lines) - 1, 2, -1) : -1;
  const title = byStart >= 0 ? byStart : byEnd;
  // The title's end in another Heading 2, a heading pasted into the title along with the rest of it, or
  // the far half of a title cut in two: that one is a line of text, never a second title.
  if (title >= 0 && byEnd >= 0 && byEnd !== title && !holdsNotes(tr.doc.child(byEnd))) {
    tr.setNodeMarkup(startOf(tr.doc, byEnd), tr.doc.type.schema.nodes.paragraph);
  }
  const doc = tr.doc;
  // A heading with a comment, footnote or note link that comes up from the text stays a heading in the
  // text, under an empty title line: as a part or title line it would lose them.
  const fits = (index: number, old: number) => index === old || !holdsNotes(doc.child(index));
  const at = levelOf(doc.maybeChild(0)) === 1 && fits(0, part) ? 1 : 0;
  // Another Heading 2 put above a title that is still there doesn't take its place.
  if (levelOf(doc.maybeChild(at)) === 2 && fits(at, title) && !(title > at)) return;
  if (title > at && !holdsNotes(doc.child(title))) {
    const kept = (index: number) => index !== part && !(doc.child(index).isTextblock && doc.child(index).content.size === 0);
    const order = [...(part >= 0 && part < title ? [part] : []), title];
    for (let index = 0; index < title; index += 1) if (kept(index)) order.push(index);
    const cursor = tr.selection.$from.index(0);
    const offset = tr.selection.from - startOf(doc, Math.min(cursor, title));
    tr.replaceWith(0, startOf(doc, title) + doc.child(title).nodeSize, order.map((index) => doc.child(index)));
    // The keyboard stays in the line it was in, now in its new place; from an empty line, to the title.
    if (cursor <= title) {
      const moved = order.indexOf(cursor);
      const place = moved >= 0 ? order.slice(0, moved).reduce((sum, index) => sum + doc.child(index).nodeSize, 0) + offset : (part >= 0 ? doc.child(part).nodeSize : 0) + 1;
      tr.setSelection(Selection.near(tr.doc.resolve(Math.min(place, tr.doc.content.size))));
    }
    return;
  }
  tr.insert(startOf(doc, at), doc.type.schema.nodes.heading.create({ level: 2 }));
}

/**
 * Takes marks and footnotes out of the part and title lines, which hold plain text, and makes a line
 * break there a space.
 */
function plainLeadLines(tr: Transaction): void {
  const doc = tr.doc;
  // From the last line up, so a change in one doesn't move the other.
  for (let index = leadLines(doc) - 1; index >= 0; index -= 1) {
    const node = doc.child(index);
    const start = startOf(doc, index);
    const extras: { pos: number; size: number; space: boolean }[] = [];
    let marked = false;
    node.descendants((child, pos) => {
      if (child.marks.length > 0) marked = true;
      if (!child.isText) extras.push({ pos: start + 1 + pos, size: child.nodeSize, space: child.type.name === "hardBreak" });
    });
    if (marked) tr.removeMark(start + 1, start + node.nodeSize - 1, null);
    for (const extra of extras.reverse()) {
      if (extra.space) tr.replaceWith(extra.pos, extra.pos + extra.size, doc.type.schema.text(" "));
      else tr.delete(extra.pos, extra.pos + extra.size);
    }
  }
}

/**
 * Keeps a page's first lines whole after an edit. Kept in the undo history with the edit that caused
 * it, so Undo puts back both at once and never leaves a second title behind.
 */
export function fixLeadLines(transactions: readonly Transaction[], before: EditorState, state: EditorState): Transaction | null {
  if (!transactions.some((transaction) => transaction.docChanged)) return null;
  // Undo and Redo go back to pages these rules already kept whole; an Undo that joins two lines again
  // is putting back what was there, not pulling text up.
  if (transactions.some(isHistoryTransaction)) return null;
  // Typing in the text below doesn't reach the first lines, and then there is nothing to look at.
  if (!reachesLeadLines(transactions, before.doc)) return null;
  const now: Now = (pos, assoc = 1) => transactions.reduce((at, transaction) => transaction.mapping.map(at, assoc), pos);
  const tr = state.tr;
  keepTextBelow(before.doc, tr, now);
  keepSplitTails(before.doc, tr, transactions);
  keepLeadStyles(before.doc, tr, now);
  keepTitleLine(before.doc, tr, now);
  plainLeadLines(tr);
  return tr.docChanged ? tr : null;
}

/** Whether an edit changed anything in the part and title lines, or above or between them. */
function reachesLeadLines(transactions: readonly Transaction[], before: ProseNode): boolean {
  // The end of the first lines: an edit that starts at or after it leaves them as they were.
  let end = 0;
  for (let index = 0; index < leadLines(before); index += 1) end += before.child(index).nodeSize;
  for (const transaction of transactions) {
    for (const map of transaction.mapping.maps) {
      let reached = false;
      map.forEach((oldStart) => {
        if (oldStart < end) reached = true;
      });
      if (reached) return true;
    }
  }
  return false;
}

/** The page's text below its part and title lines, as the word count reads it. */
export function bodyText(editor: Editor): string {
  const { doc, schema } = editor.state;
  let from = 0;
  for (let index = 0; index < leadLines(doc); index += 1) from += doc.child(index).nodeSize;
  return getTextBetween(doc, { from, to: doc.content.size }, { blockSeparator: "\n\n", textSerializers: getTextSerializersFromSchema(schema) });
}

export const ChapterPage = Extension.create<{ titleHint: string; partHint: string }>({
  name: "chapterPage",
  // Its keys go before the editor's own Enter and Backspace.
  priority: 1000,

  addOptions() {
    return { titleHint: "", partHint: "" };
  },

  addKeyboardShortcuts() {
    const run = (command: (state: EditorState, dispatch: Dispatch) => boolean) => () =>
      command(this.editor.state, (tr) => this.editor.view.dispatch(tr.scrollIntoView()));
    return {
      Enter: run(enterInLeadLines),
      Backspace: run(backspaceInLeadLines),
      "Mod-Backspace": run(backspaceInLeadLines),
      "Shift-Backspace": run(backspaceInLeadLines),
      Delete: run(deleteInLeadLines),
      "Mod-Delete": run(deleteInLeadLines),
      // No line breaks in a title, and no lists or quotes in the first lines, as the toolbar says
      // (on a Slovenian keyboard Ctrl+/ for the shortcut list is Ctrl+Shift+7 too).
      "Shift-Enter": () => lineAt(this.editor.state) !== 0,
      "Mod-Shift-7": () => lineAt(this.editor.state) !== 0,
      "Mod-Shift-8": () => lineAt(this.editor.state) !== 0,
      "Mod-Shift-b": () => lineAt(this.editor.state) !== 0,
    };
  },

  addProseMirrorPlugins() {
    const { titleHint, partHint } = this.options;
    return [
      new Plugin({
        key: new PluginKey("chapterPage"),
        appendTransaction: fixLeadLines,
        props: {
          // What is typed in the part and title lines stays text: "# " or "> " there makes no heading or quote.
          handleTextInput: (view, from, _to, _text, typed) => {
            if (view.state.doc.resolve(from).index(0) >= leadLines(view.state.doc)) return false;
            view.dispatch(typed());
            return true;
          },
          // Only the two lines at the top are looked at, so this costs nothing on a long chapter.
          decorations: (state) => {
            const hints: Decoration[] = [];
            let offset = 0;
            for (let index = 0; index < leadLines(state.doc); index += 1) {
              const node = state.doc.child(index);
              if (node.content.size === 0) {
                const hint = levelOf(node) === 1 ? partHint : titleHint;
                hints.push(Decoration.node(offset, offset + node.nodeSize, { class: "empty-line", "data-hint": hint }));
              }
              offset += node.nodeSize;
            }
            return hints.length > 0 ? DecorationSet.create(state.doc, hints) : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
