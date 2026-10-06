import { Mark, mergeAttributes } from "@tiptap/core";
import type { Mark as ProseMark, Node as ProseNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** A comment as the margin shows it: what it says, and the words it sits on. */
export type CommentInfo = {
  id: string;
  text: string;
  createdAt: string;
  from: number;
  to: number;
  /** The commented words. */
  quote: string;
};

const activeKey = new PluginKey<{ id: string; set: DecorationSet }>("activeComment");

function pieces(doc: ProseNode, id: string): { from: number; to: number; mark: ProseMark }[] {
  const found: { from: number; to: number; mark: ProseMark }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name === "comment" && mark.attrs.id === id) found.push({ from: pos, to: pos + node.nodeSize, mark });
    }
  });
  return found;
}

function activeDecorations(doc: ProseNode, id: string): DecorationSet {
  return DecorationSet.create(
    doc,
    pieces(doc, id).map((piece) => Decoration.inline(piece.from, piece.to, { class: "comment-active" })),
  );
}

/**
 * A comment on a passage, as in Word. It lives on the words themselves, so it is saved, undone,
 * snapshotted and backed up with the chapter. The margin beside the page shows and edits it.
 */
export const CommentMark = Mark.create({
  name: "comment",
  // Comments may overlap, as in Word, and typing at their edge doesn't stretch them.
  excludes: "",
  inclusive: false,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-comment-id") ?? "",
        renderHTML: (attrs) => ({ "data-comment-id": attrs.id as string }),
      },
      text: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-comment") ?? "",
        renderHTML: (attrs) => ({ "data-comment": attrs.text as string }),
      },
      createdAt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-comment-at") ?? "",
        renderHTML: (attrs) => ({ "data-comment-at": attrs.createdAt as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "comment" }), 0];
  },

  addProseMirrorPlugins() {
    // Marks the words of the comment open in the margin. Kept in plugin state and mapped through
    // edits, so typing never rescans the chapter.
    return [
      new Plugin({
        key: activeKey,
        state: {
          init: () => ({ id: "", set: DecorationSet.empty }),
          apply(tr, value, _old, state) {
            const next = tr.getMeta(activeKey) as string | undefined;
            if (typeof next === "string") {
              return { id: next, set: next ? activeDecorations(state.doc, next) : DecorationSet.empty };
            }
            if (!value.id || !tr.docChanged) return value;
            return { id: value.id, set: value.set.map(tr.mapping, tr.doc) };
          },
        },
        props: {
          decorations: (state) => activeKey.getState(state)?.set,
        },
      }),
    ];
  },
});

/** Every comment in a document, in reading order. A comment split by later edits is still one comment. */
export function findComments(doc: ProseNode): CommentInfo[] {
  const found = new Map<string, CommentInfo>();
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "comment") continue;
      const id = String(mark.attrs.id ?? "");
      if (!id) continue;
      const known = found.get(id);
      if (known) known.to = pos + node.nodeSize;
      else {
        found.set(id, {
          id,
          text: String(mark.attrs.text ?? ""),
          createdAt: String(mark.attrs.createdAt ?? ""),
          from: pos,
          to: pos + node.nodeSize,
          quote: "",
        });
      }
    }
  });
  const comments = [...found.values()].sort((a, b) => a.from - b.from);
  for (const comment of comments) comment.quote = doc.textBetween(comment.from, comment.to, " ", " ").trim();
  return comments;
}

/** The comment the cursor sits in, or "". */
export function commentAt(state: EditorState): string {
  const mark = state.selection.$from.marks().find((item) => item.type.name === "comment");
  return mark ? String(mark.attrs.id ?? "") : "";
}

const WORD_LETTER = /[\p{L}\p{N}'’-]/u;

/** The word around a position, for a comment added without a selection, as Word does. */
function wordAround(doc: ProseNode, pos: number): { from: number; to: number } | null {
  const $pos = doc.resolve(pos);
  if (!$pos.parent.isTextblock) return null;
  // One character per inline picture or footnote, so offsets in the text match document positions.
  const text = $pos.parent.textBetween(0, $pos.parent.content.size, undefined, "￼");
  let start = $pos.parentOffset;
  let end = start;
  while (start > 0 && WORD_LETTER.test(text[start - 1])) start -= 1;
  while (end < text.length && WORD_LETTER.test(text[end])) end += 1;
  if (start === end) return null;
  return { from: $pos.start() + start, to: $pos.start() + end };
}

/** Comments the selection, or the word at the cursor. Null when there are no words to comment on. */
export function addComment(state: EditorState, id: string, createdAt: string): Transaction | null {
  const type = state.schema.marks.comment;
  if (!type) return null;
  let { from, to } = state.selection;
  if (from === to) {
    const word = wordAround(state.doc, from);
    if (!word) return null;
    ({ from, to } = word);
  }
  if (!state.doc.textBetween(from, to, " ").trim()) return null;
  return state.tr.addMark(from, to, type.create({ id, text: "", createdAt })).setMeta(activeKey, id);
}

/** Changes what a comment says. Typing in the margin stays out of the chapter's Undo. */
export function setCommentText(state: EditorState, id: string, text: string): Transaction {
  const tr = state.tr;
  for (const piece of pieces(state.doc, id)) {
    tr.removeMark(piece.from, piece.to, piece.mark);
    tr.addMark(piece.from, piece.to, piece.mark.type.create({ ...piece.mark.attrs, text }));
  }
  return tr.setMeta("addToHistory", false);
}

/** Takes a comment off its words; with `noteLink`, the words link to that note instead. */
export function removeComment(state: EditorState, id: string, noteLink?: { noteId: string; title: string }): Transaction {
  const tr = state.tr;
  const link = state.schema.marks.noteLink;
  for (const piece of pieces(state.doc, id)) {
    tr.removeMark(piece.from, piece.to, piece.mark);
    if (noteLink && link) tr.addMark(piece.from, piece.to, link.create(noteLink));
  }
  if (activeKey.getState(state)?.id === id) tr.setMeta(activeKey, "");
  return tr;
}

/** Marks which comment the margin has open, so its words stand out on the page. */
export function showComment(state: EditorState, id: string): Transaction | null {
  if ((activeKey.getState(state)?.id ?? "") === id) return null;
  return state.tr.setMeta(activeKey, id).setMeta("addToHistory", false);
}
