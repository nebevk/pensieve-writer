import { Mark, mergeAttributes } from "@tiptap/core";

/** A language mark so a selection can use a different spell checker. */
export const TextLanguage = Mark.create({
  name: "textLanguage",
  addAttributes() {
    return {
      lang: { default: "en" },
    };
  },
  parseHTML() {
    return [{ tag: "span[lang]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { spellcheck: "true" }), 0];
  },
});
