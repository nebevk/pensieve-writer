import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { NoteLinkMark } from "./noteLinks";
import { addComment, commentAt, findComments, removeComment, setCommentText, CommentMark } from "./comments";

const schema = getSchema([StarterKit, NoteLinkMark, CommentMark]);

function stateWith(content: object[], from: number, to = from): EditorState {
  const doc = schema.nodeFromJSON({ type: "doc", content });
  const state = EditorState.create({ schema, doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, from, to)));
}

const paragraph = (...content: object[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: object[]) => (marks ? { type: "text", text: value, marks } : { type: "text", text: value });

describe("comments", () => {
  it("comments the selected words", () => {
    // "The keys hung by the door." — select "keys hung".
    const state = stateWith([paragraph(text("The keys hung by the door."))], 5, 14);
    const tr = addComment(state, "c1", "2026-10-05T10:00:00.000Z");
    expect(tr).not.toBeNull();
    const comments = findComments(state.apply(tr!).doc);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: "c1", quote: "keys hung", text: "", createdAt: "2026-10-05T10:00:00.000Z" });
  });

  it("comments the word at the cursor when nothing is selected", () => {
    const state = stateWith([paragraph(text("Ana took them down."))], 7);
    const comments = findComments(state.apply(addComment(state, "c2", "")!).doc);
    expect(comments[0].quote).toBe("took");
  });

  it("keeps Slovenian letters together in a word", () => {
    const state = stateWith([paragraph(text("Babica je šivala."))], 13);
    expect(findComments(state.apply(addComment(state, "c3", "")!).doc)[0].quote).toBe("šivala");
  });

  it("has nothing to comment on in an empty line", () => {
    const state = stateWith([paragraph(text("Words.")), { type: "paragraph" }], 9);
    expect(addComment(state, "c4", "")).toBeNull();
  });

  it("changes a comment's text across differently formatted words", () => {
    const comment = { type: "comment", attrs: { id: "c5", text: "old", createdAt: "" } };
    const state = stateWith([paragraph(text("plain ", [comment]), text("bold", [comment, { type: "bold" }]))], 1);
    const next = state.apply(setCommentText(state, "c5", "Check the date"));
    const comments = findComments(next.doc);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ text: "Check the date", quote: "plain bold" });
  });

  it("turns a comment into a link to its new note", () => {
    const comment = { type: "comment", attrs: { id: "c6", text: "Who is she?", createdAt: "" } };
    const state = stateWith([paragraph(text("Her grandmother", [comment]), text(" died."))], 1);
    const next = state.apply(removeComment(state, "c6", { noteId: "n1", title: "Grandmother" }));
    expect(findComments(next.doc)).toHaveLength(0);
    const marks = next.doc.firstChild!.firstChild!.marks;
    expect(marks.map((mark) => mark.type.name)).toEqual(["noteLink"]);
    expect(marks[0].attrs).toMatchObject({ noteId: "n1", title: "Grandmother" });
  });

  it("finds overlapping comments and the one at the cursor", () => {
    const a = { type: "comment", attrs: { id: "a", text: "first", createdAt: "" } };
    const b = { type: "comment", attrs: { id: "b", text: "second", createdAt: "" } };
    const state = stateWith([paragraph(text("one ", [a]), text("two", [a, b]), text(" three", [b]))], 2);
    expect(findComments(state.doc).map((comment) => [comment.id, comment.quote])).toEqual([
      ["a", "one two"],
      ["b", "two three"],
    ]);
    expect(commentAt(state)).toBe("a");
  });
});
