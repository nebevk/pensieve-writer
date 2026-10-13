import { Node, mergeAttributes } from "@tiptap/core";

/**
 * A footnote: a number in the text that carries its note. The numbers follow the order on the
 * page (a CSS counter), so adding or moving one renumbers the rest, as in Word.
 */
export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-footnote") ?? "",
        renderHTML: (attributes) => ({ "data-footnote": attributes.text as string, title: attributes.text as string }),
      },
    };
  },
  // Before the superscript mark's rule for every <sup>: marks are read first when rules are equal, so a
  // footnote copied or pasted (from Word too) came in as an empty superscript.
  parseHTML: () => [{ tag: "sup[data-footnote]", priority: 60 }],
  renderHTML: ({ HTMLAttributes }) => ["sup", mergeAttributes(HTMLAttributes, { class: "footnote" })],
  // The note isn't part of the running text, so word counts and find leave it out.
  renderText: () => "",
});
