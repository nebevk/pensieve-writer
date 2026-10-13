import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { highlightColour, textColour } from "./colours";
import { fontName, manuscriptFamily, pointSize } from "$lib/prefs";

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

/** Words in another of the manuscript's fonts than the page's (TOOL-6). Pasted text doesn't bring its fonts. */
export const FontMark = Mark.create({
  name: "font",
  addAttributes() {
    return {
      name: {
        default: "literata",
        parseHTML: (element) => fontName(element.getAttribute("data-font")),
        renderHTML: (attributes) => ({ "data-font": fontName(attributes.name), style: `font-family: ${manuscriptFamily(fontName(attributes.name))}` }),
      },
    };
  },
  parseHTML: () => [{ tag: "span[data-font]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes), 0],
});

/** Words at another size than the page's, in points as in Word (TOOL-6). Pasted text doesn't bring its sizes. */
export const SizeMark = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      pt: {
        default: 12,
        parseHTML: (element) => pointSize(element.getAttribute("data-size")),
        renderHTML: (attributes) => ({ "data-size": String(pointSize(attributes.pt)), style: `font-size: ${pointSize(attributes.pt)}pt` }),
      },
    };
  },
  parseHTML: () => [{ tag: "span[data-size]" }],
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
