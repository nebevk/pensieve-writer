import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { joinBackward, joinForward, setBlockType, splitBlock } from "@tiptap/pm/commands";
import { history, undo } from "@tiptap/pm/history";
import { Fragment, Slice } from "@tiptap/pm/model";
import { EditorState, Plugin, TextSelection, type Transaction } from "@tiptap/pm/state";
import { chapterBreak, heldHeading, readPage } from "$lib/chapters/page";
import type { DocumentJson } from "$lib/model";
import { CommentMark } from "./comments";
import { Footnote } from "./footnote";
import { backspaceInLeadLines, deleteInLeadLines, enterInLeadLines, fixLeadLines } from "./chapterPage";

const schema = getSchema([StarterKit.configure({ link: false }), Footnote, CommentMark]);
const text = (value: string) => ({ type: "text", text: value });
const p = (value = "") => ({ type: "paragraph", ...(value ? { content: [text(value)] } : {}) });
const h = (level: number, value = "") => ({ type: "heading", attrs: { level }, ...(value ? { content: [text(value)] } : {}) });

/** A page with the cursor in block `index`, `offset` characters in. */
function page(blocks: object[], index = 0, offset = 0): EditorState {
  const doc = schema.nodeFromJSON({ type: "doc", content: blocks });
  let position = 0;
  for (let at = 0; at < index; at += 1) position += doc.child(at).nodeSize;
  return EditorState.create({
    doc,
    plugins: [history(), new Plugin({ appendTransaction: fixLeadLines })],
    selection: TextSelection.create(doc, position + 1 + offset),
  });
}

type Command = (state: EditorState, dispatch: (tr: Transaction) => void) => boolean;
/** Runs a command the way a key would, edits made after it included. */
function press(state: EditorState, command: Command): { state: EditorState; handled: boolean } {
  let next = state;
  const handled = command(state, (tr) => (next = state.apply(tr)));
  return { state: next, handled };
}

const lines = (state: EditorState) =>
  state.doc.content.content.map((node) => `${node.type.name === "heading" ? `h${node.attrs.level}` : "p"}:${node.textContent}`);
const cursor = (state: EditorState) => [state.selection.$from.index(0), state.selection.$from.parentOffset];

describe("a chapter page's first lines", () => {
  const letter = [h(1, "Part One"), h(2, "The Letter"), p("It came.")];

  it("go on from the part line to the title with Enter, without splitting anything", () => {
    const { state, handled } = press(page(letter, 0, 8), enterInLeadLines);
    expect(handled).toBe(true);
    expect(lines(state)).toEqual(["h1:Part One", "h2:The Letter", "p:It came."]);
    expect(cursor(state)).toEqual([1, 10]);
  });

  it("open a part line above the title with Enter at its start, which Backspace takes away again", () => {
    const opened = press(page(letter.slice(1), 0, 0), enterInLeadLines).state;
    expect(lines(opened)).toEqual(["h1:", "h2:The Letter", "p:It came."]);
    expect(cursor(opened)).toEqual([0, 0]);
    expect(chapterBreak(opened.doc)).toBe(-1);
    const closed = press(opened, backspaceInLeadLines).state;
    expect(lines(closed)).toEqual(["h2:The Letter", "p:It came."]);
    expect(cursor(closed)).toEqual([0, 0]);
  });

  it("make the rest of the title the first line of text with Enter in its middle, and Undo joins them again", () => {
    const { state } = press(page(letter, 1, 6), enterInLeadLines);
    expect(lines(state)).toEqual(["h1:Part One", "h2:The Le", "p:tter", "p:It came."]);
    expect(cursor(state)).toEqual([2, 0]);
    expect(lines(press(state, undo).state)).toEqual(["h1:Part One", "h2:The Letter", "p:It came."]);
  });

  it("leave Enter at the end of the title to the editor, which starts a line of text", () => {
    expect(press(page(letter, 1, 10), enterInLeadLines).handled).toBe(false);
  });

  it("never join the title to the part line with Backspace, or the part line to the title with Delete", () => {
    const back = press(page(letter, 1, 0), backspaceInLeadLines);
    expect(lines(back.state)).toEqual(lines(page(letter)));
    expect(cursor(back.state)).toEqual([0, 8]);
    const forward = press(page(letter, 0, 8), deleteInLeadLines);
    expect(forward.handled).toBe(true);
    expect(lines(forward.state)).toEqual(lines(page(letter)));
    expect(press(page(letter.slice(1), 0, 0), backspaceInLeadLines).handled).toBe(true);
  });

  it("never pull the first line of text into the title, where its comments would have no place", () => {
    const back = press(page(letter, 2, 0), backspaceInLeadLines);
    expect(back.handled).toBe(true);
    expect(lines(back.state)).toEqual(lines(page(letter)));
    const forward = press(page(letter, 1, 10), deleteInLeadLines);
    expect(forward.handled).toBe(true);
    expect(lines(forward.state)).toEqual(lines(page(letter)));
    // An empty line under the title still goes, with the editor's own keys.
    const gap = [h(2, "The Letter"), p(), p("It came.")];
    expect(press(page(gap, 1, 0), backspaceInLeadLines).handled).toBe(false);
    expect(press(page(gap, 0, 10), deleteInLeadLines).handled).toBe(false);
  });

  it("put back text any other edit pulls up into the title, with its comments and footnotes", () => {
    const annotated = [
      h(2, "The Letter"),
      {
        type: "paragraph",
        content: [
          { type: "text", text: "It came", marks: [{ type: "comment", attrs: { id: "c-1", text: "Which day?" } }] },
          { type: "footnote", attrs: { text: "On a Tuesday." } },
          text(" in March."),
        ],
      },
    ];
    const kept = (state: EditorState) => {
      const line = state.doc.child(1);
      return {
        comment: line.firstChild?.marks.some((mark) => mark.type.name === "comment") ?? false,
        footnote: line.child(1)?.type.name === "footnote",
      };
    };
    // Ctrl+Backspace at the start of the text and Ctrl+Delete at the end of the title join the two lines
    // with the editor's own commands; the join is undone in the same step.
    for (const [state, command] of [
      [page(annotated, 1, 0), joinBackward],
      [page(annotated, 0, 10), joinForward],
    ] as const) {
      const after = press(state, command).state;
      expect(lines(after)).toEqual(["h2:The Letter", "p:It came in March."]);
      expect(kept(after)).toEqual({ comment: true, footnote: true });
    }
    // A selection from the middle of the title into the text, deleted: the title keeps its start, and
    // the rest of the text stays a line of its own.
    const start = page(annotated, 0, 6);
    const crossing = start.apply(start.tr.setSelection(TextSelection.create(start.doc, 7, 16 + 4)).deleteSelection());
    expect(lines(crossing)).toEqual(["h2:The Le", "p: in March."]);
    // Enter over the same kind of selection: the same, with the comment and the footnote kept.
    const entered = press(start.apply(start.tr.setSelection(TextSelection.create(start.doc, 7, 16))), enterInLeadLines).state;
    expect(lines(entered)).toEqual(["h2:The Le", "p:came in March."]);
    expect(kept(entered)).toEqual({ comment: true, footnote: true });
    // From the title into a quote under it: the quote's first line comes back as a line of its own.
    const quoted = page([annotated[0], { type: "blockquote", content: [annotated[1], p("Second.")] }], 0, 6);
    const fromQuote = quoted.apply(quoted.tr.setSelection(TextSelection.create(quoted.doc, 7, 17)).deleteSelection());
    expect(lines(fromQuote)[0]).toBe("h2:The Le");
    expect(lines(fromQuote)[1]).toBe("p:came in March.");
    expect(kept(fromQuote)).toEqual({ comment: true, footnote: true });
    expect(fromQuote.doc.child(2).type.name).toBe("blockquote");
  });

  it("keep the title in place when something pushes it down, so no chapter starts", () => {
    // ProseMirror's own Enter at the start of the title, as a paste or another tool might do it.
    const pushed = press(page(letter, 1, 0), splitBlock).state;
    expect(lines(pushed)).toEqual(["h1:Part One", "h2:The Letter", "p:It came."]);
    expect(chapterBreak(pushed.doc)).toBe(-1);
    // A rule put above the part line goes below the title, with the part line back on top.
    const start = page(letter, 1, 3);
    const ruled = start.apply(start.tr.insert(0, schema.nodes.horizontalRule.create()));
    expect(ruled.doc.content.content.map((node) => node.type.name)).toEqual(["heading", "heading", "horizontalRule", "paragraph"]);
    expect(lines(ruled)[1]).toBe("h2:The Letter");
    expect(cursor(ruled)).toEqual([1, 3]);
    expect(chapterBreak(ruled.doc)).toBe(-1);
  });

  it("keep their style when another one is chosen for them", () => {
    for (const [index, type] of [
      [1, setBlockType(schema.nodes.paragraph)],
      [1, setBlockType(schema.nodes.heading, { level: 1 })],
      [0, setBlockType(schema.nodes.paragraph)],
      [0, setBlockType(schema.nodes.heading, { level: 2 })],
    ] as const) {
      const after = press(page(letter, index, 3), type).state;
      expect(lines(after)).toEqual(["h1:Part One", "h2:The Letter", "p:It came."]);
      expect(chapterBreak(after.doc)).toBe(-1);
    }
  });

  it("take Enter over a selection in the title as Enter in its middle, never making a second title", () => {
    // "Let" selected in "The Letter".
    const start = page(letter, 1, 4);
    const selected = start.apply(start.tr.setSelection(TextSelection.create(start.doc, start.selection.from, start.selection.from + 3)));
    const after = press(selected, enterInLeadLines).state;
    expect(lines(after)).toEqual(["h1:Part One", "h2:The ", "p:ter", "p:It came."]);
    expect(chapterBreak(after.doc)).toBe(-1);
    expect(lines(press(after, undo).state)).toEqual(["h1:Part One", "h2:The Letter", "p:It came."]);
  });

  it("keep a part line taken away with the start of the title from splitting the title", () => {
    // From the start of the part line to "The |Letter", deleted.
    const start = page(letter, 0, 0);
    const title = start.doc.child(0).nodeSize;
    const after = start.apply(start.tr.setSelection(TextSelection.create(start.doc, 1, title + 5)).deleteSelection());
    expect(lines(after)).toEqual(["h2:Letter", "p:It came."]);
    expect(chapterBreak(after.doc)).toBe(-1);
  });

  it("give text pulled up past a whole title line its own style back, comments and footnotes kept", () => {
    const annotated = {
      type: "paragraph",
      content: [
        { type: "text", text: "It came", marks: [{ type: "comment", attrs: { id: "c-1", text: "Which day?" } }] },
        { type: "footnote", attrs: { text: "On a Tuesday." } },
        text(" in March."),
      ],
    };
    // From the end of the part line to the start of the text: the title line goes whole.
    const start = page([h(1, "Part One"), h(2, "The Letter"), annotated, p("Next.")], 0, 8);
    const after = start.apply(start.tr.setSelection(TextSelection.create(start.doc, 9, 23)).deleteSelection());
    expect(lines(after)).toEqual(["h1:Part One", "h2:", "p:It came in March.", "p:Next."]);
    const line = after.doc.child(2);
    expect(line.firstChild?.marks.some((mark) => mark.type.name === "comment")).toBe(true);
    expect(line.child(1).type.name).toBe("footnote");
    // A heading under the title, taken away with part of the title: what is left of the text below is
    // a line of text, not a heading that would start a chapter.
    const headed = page([h(1, "Part One"), h(2, "The Letter"), h(2), p("Rain."), p("Fog.")], 1, 1);
    const rain = headed.doc.child(0).nodeSize + headed.doc.child(1).nodeSize + headed.doc.child(2).nodeSize + 1 + 3;
    const cut = headed.apply(headed.tr.setSelection(TextSelection.create(headed.doc, headed.doc.child(0).nodeSize + 2, rain)).deleteSelection());
    expect(chapterBreak(cut.doc)).toBe(-1);
    expect(lines(cut)).toContain("p:n.");
  });

  it("keep a heading with a comment in the text when everything above it goes", () => {
    const held = {
      type: "heading",
      attrs: { level: 2 },
      content: [
        { type: "text", text: "The Storm", marks: [{ type: "comment", attrs: { id: "c-9", text: "Move?" } }] },
        { type: "footnote", attrs: { text: "1954." } },
      ],
    };
    const start = page([h(2, "The Letter"), p("It came."), held, p("Rain.")], 0, 0);
    const heldStart = start.doc.child(0).nodeSize + start.doc.child(1).nodeSize + 1;
    const after = start.apply(start.tr.setSelection(TextSelection.create(start.doc, 1, heldStart)).deleteSelection());
    expect(lines(after)).toEqual(["h2:", "h2:The Storm", "p:Rain."]);
    expect(heldHeading(after.doc)).toBe(1);
    const kept = after.doc.child(1);
    expect(kept.firstChild?.marks.some((mark) => mark.type.name === "comment")).toBe(true);
    expect(kept.child(1).type.name).toBe("footnote");
  });

  it("leave a title pushed down by pasted lines as a line of text, never a second title", () => {
    const pasted = (...values: string[]) => new Slice(Fragment.fromArray(values.map((value) => schema.nodeFromJSON(p(value)))), 1, 1);
    for (const [slice, expected] of [
      [pasted("Prologue", "A night in May."), ["h2:Prologue", "p:A night in May.The Letter", "p:It came."]],
      [pasted("Prologue", ""), ["h2:Prologue", "p:The Letter", "p:It came."]],
    ] as const) {
      const start = page([h(2, "The Letter"), p("It came.")], 0, 0);
      const after = start.apply(start.tr.replaceSelection(slice));
      expect(lines(after)).toEqual(expected);
      expect(chapterBreak(after.doc)).toBe(-1);
    }
  });

  it("keep a picture or rule pasted over the title from making a heading with a comment the title", () => {
    const held = {
      type: "heading",
      attrs: { level: 2 },
      content: [
        { type: "text", text: "The Storm", marks: [{ type: "comment", attrs: { id: "c-9", text: "Move?" } }] },
        { type: "footnote", attrs: { text: "1954." } },
      ],
    };
    // From the end of the part line to the start of the held heading: the whole title and both line breaks.
    const start = page([h(1, "Part"), h(2, "Title"), held, p("Rain.")], 0, 4);
    const after = start.apply(start.tr.setSelection(TextSelection.create(start.doc, 5, 14)).replaceSelectionWith(schema.nodes.horizontalRule.create(), false));
    expect(lines(after)).toEqual(["h1:Part", "h2:", "p:", "h2:The Storm", "p:Rain."]);
    expect(heldHeading(after.doc)).toBe(3);
    const kept = after.doc.child(3);
    expect(kept.firstChild?.marks.some((mark) => mark.type.name === "comment")).toBe(true);
    expect(kept.child(1).type.name).toBe("footnote");
  });

  it("make the rest of a title cut by a pasted picture or rule a line of text, never a second title", () => {
    const start = page([h(2, "The Letter"), p("It came.")], 0, 4);
    const after = start.apply(start.tr.replaceSelectionWith(schema.nodes.horizontalRule.create(), false));
    expect(lines(after)).toEqual(["h2:The ", "p:", "p:Letter", "p:It came."]);
    expect(chapterBreak(after.doc)).toBe(-1);
  });

  it("keep the title on top when a heading is pasted before it, and the part line when lines are pasted into it", () => {
    const start = page([h(2, "The Letter"), p("It came.")], 0, 0);
    const pastedHeading = start.apply(start.tr.replaceSelectionWith(schema.nodes.heading.create({ level: 2 }, schema.text("Prologue")), false));
    expect(lines(pastedHeading)[0]).toBe("h2:The Letter");
    // Two lines pasted at the very start of the part line: the first joins it, and it stays on top.
    const parted = page(letter, 0, 0);
    const slice = new Slice(Fragment.fromArray([schema.nodeFromJSON(p("New")), schema.nodeFromJSON(p("Lines"))]), 1, 1);
    const pastedLines = parted.apply(parted.tr.replaceSelection(slice));
    expect(lines(pastedLines).slice(0, 2)).toEqual(["h1:New", "h2:The Letter"]);
    expect(chapterBreak(pastedLines.doc)).toBe(-1);
    expect(pastedLines.doc.textContent).toContain("LinesPart One");
  });

  it("keep a title's own words out of a heading pasted into it with a line of text", () => {
    const start = page([h(2, "The Letter"), p("It came.")], 0, 0);
    const slice = new Slice(Fragment.fromArray([schema.nodeFromJSON(p("αα")), schema.nodeFromJSON(h(2, "ΩΩ"))]), 1, 1);
    const after = start.apply(start.tr.replaceSelection(slice));
    expect(lines(after)).toEqual(["h2:αα", "p:ΩΩThe Letter", "p:It came."]);
    expect(chapterBreak(after.doc)).toBe(-1);
  });

  it("agree with the book on which headings start a chapter: not one with a comment", () => {
    const state = page([
      h(2, "The Letter"),
      p("It came."),
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "The Storm", marks: [{ type: "comment", attrs: { id: "c-1", text: "Move?" } }] }] },
      p("Rain."),
      h(2, "The Fog"),
      p("Fog."),
    ]);
    // The page splits where readPage does, at "The Fog", and tells about "The Storm".
    expect(chapterBreak(state.doc)).toBe(4);
    expect(heldHeading(state.doc)).toBe(2);
    expect(readPage(state.doc.toJSON() as DocumentJson).starts).toEqual([4]);
  });

  it("hold plain text: no comments, footnotes, bold or line breaks", () => {
    const start = page(letter, 1, 3);
    const title = start.doc.child(0).nodeSize;
    const tr = start.tr
      .addMark(title + 1, title + 5, schema.marks.comment.create({ id: "c-1", text: "Better title?" }))
      .addMark(title + 5, title + 11, schema.marks.bold.create())
      .insert(title + 11, schema.nodes.footnote.create({ text: "A note." }))
      .insert(title + 5, schema.nodes.hardBreak.create());
    const after = start.apply(tr);
    // The line break became a space.
    expect(lines(after)).toEqual(["h1:Part One", "h2:The  Letter", "p:It came."]);
    const titleLine = after.doc.child(1);
    expect(titleLine.childCount).toBe(1);
    expect(titleLine.firstChild?.marks).toEqual([]);
  });
});
