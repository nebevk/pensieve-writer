import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";

export const Superscript = Mark.create({
  name: "superscript",
  parseHTML: () => [{ tag: "sup" }],
  renderHTML: ({ HTMLAttributes }) => ["sup", mergeAttributes(HTMLAttributes), 0],
});

export const Highlight = Mark.create({
  name: "highlight",
  parseHTML: () => [{ tag: "mark" }],
  renderHTML: ({ HTMLAttributes }) => [
    "mark",
    mergeAttributes(HTMLAttributes, { style: "background: #f2dc8f; color: inherit" }),
    0,
  ],
});

export const TextColor = Mark.create({
  name: "textColor",
  parseHTML: () => [{ tag: "span[data-color]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, {
      "data-color": "accent",
      style: "color: var(--pv-ink-accent)",
    }),
    0,
  ],
});

export const LinkMark = Mark.create({
  name: "link",
  inclusive: false,
  addAttributes() {
    return {
      href: {
        default: "",
        parseHTML: (element) => element.getAttribute("href") ?? "",
        renderHTML: (attributes) => ({ href: attributes.href as string }),
      },
    };
  },
  parseHTML: () => [{ tag: "a[href]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "a",
    mergeAttributes(HTMLAttributes, { rel: "noreferrer", target: "_blank" }),
    0,
  ],
});

export const ImageBlock = Node.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
    };
  },
  parseHTML: () => [{ tag: "img[src]" }],
  renderHTML: ({ HTMLAttributes }) => ["img", mergeAttributes(HTMLAttributes)],
});

export const Indent = Extension.create({
  name: "indent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => Number(element.getAttribute("data-indent") ?? 0),
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent ?? 0);
              if (!indent) return {};
              return { "data-indent": String(indent), style: `margin-left: ${indent * 1.5}em` };
            },
          },
        },
      },
    ];
  },
});
