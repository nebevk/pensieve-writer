import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { highlightColour, textColour } from "./colours";

export const Superscript = Mark.create({
  name: "superscript",
  parseHTML: () => [{ tag: "sup" }],
  renderHTML: ({ HTMLAttributes }) => ["sup", mergeAttributes(HTMLAttributes), 0],
});

/** A highlight in one of the toolbar's colours (TOOL-5); one from before it had a colour is yellow. */
export const Highlight = Mark.create({
  name: "highlight",
  addAttributes() {
    return {
      color: {
        default: "yellow",
        parseHTML: (element) => highlightColour(element.getAttribute("data-color")).name,
        renderHTML: (attributes) => ({ "data-color": highlightColour(attributes.color).name, style: `background: ${highlightColour(attributes.color).css}; color: inherit` }),
      },
    };
  },
  parseHTML: () => [{ tag: "mark" }],
  renderHTML: ({ HTMLAttributes }) => ["mark", mergeAttributes(HTMLAttributes), 0],
});

/** Text in one of the toolbar's colours (TOOL-5); text from before it had a choice is in the look's accent. */
export const TextColor = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: "accent",
        parseHTML: (element) => textColour(element.getAttribute("data-color")).name,
        renderHTML: (attributes) => ({ "data-color": textColour(attributes.color).name, style: `color: ${textColour(attributes.color).css}` }),
      },
    };
  },
  parseHTML: () => [{ tag: "span[data-color]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes), 0],
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
