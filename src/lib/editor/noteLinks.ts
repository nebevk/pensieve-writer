import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type NoteTarget = { id: string; title: string };

/**
 * A passage of the manuscript linked to a note, such as a character's name. It is a mark, not
 * [[brackets]], so Word, print and the other exports show only the words.
 */
export const NoteLinkMark = Mark.create({
  name: "noteLink",
  inclusive: false,
  addAttributes() {
    return {
      noteId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-note-id") ?? "",
        renderHTML: (attributes) => ({ "data-note-id": attributes.noteId as string }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-note-title") ?? "",
        renderHTML: (attributes) => ({ "data-note-title": attributes.title as string }),
      },
    };
  },
  parseHTML: () => [{ tag: "span[data-note-id]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { class: "note-link" }), 0],
});

const BRACKETS = /\[\[([^[\]\n]{1,80})\]\]/g;

/** [[Title]] in a note's text, drawn as a link with faint brackets. The text itself stays plain. */
function bracketLinks(doc: ProseNode): DecorationSet {
  const found: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const match of node.text.matchAll(BRACKETS)) {
      const from = pos + (match.index ?? 0);
      const to = from + match[0].length;
      found.push(
        Decoration.inline(from, from + 2, { class: "note-link-bracket" }),
        Decoration.inline(from + 2, to - 2, { class: "note-link", "data-note-title": match[1].trim() }),
        Decoration.inline(to - 2, to, { class: "note-link-bracket" }),
      );
    }
  });
  return DecorationSet.create(doc, found);
}

type NoteLinkOptions = {
  /** Draw [[Title]] text as links, as notes do. The manuscript uses the mark instead. */
  brackets: boolean;
  onOpen: ((target: NoteTarget) => void) | null;
};

/** Opens the linked note when a link is clicked, in the manuscript or in a note. */
export const NoteLinks = Extension.create<NoteLinkOptions>({
  name: "noteLinks",
  addOptions() {
    return { brackets: false, onOpen: null };
  },
  addProseMirrorPlugins() {
    const options = this.options;
    const key = new PluginKey<DecorationSet>("noteLinks");
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => (options.brackets ? bracketLinks(state.doc) : DecorationSet.empty),
          apply: (transaction, previous) =>
            options.brackets && transaction.docChanged ? bracketLinks(transaction.doc) : previous,
        },
        props: {
          decorations: (state) => key.getState(state),
          handleClick: (_view, _pos, event) => {
            const link = event.target instanceof Element ? event.target.closest(".note-link") : null;
            if (!link || !options.onOpen) return false;
            options.onOpen({ id: link.getAttribute("data-note-id") ?? "", title: link.getAttribute("data-note-title") ?? "" });
            return true;
          },
        },
      }),
    ];
  },
});
