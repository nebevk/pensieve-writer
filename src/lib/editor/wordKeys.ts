import { Extension } from "@tiptap/core";
import { isLeadLine } from "$lib/chapters/page";

/**
 * Word's alignment keys (owner, 14 October): Ctrl+L, E, R and J align left, centre, right and justify, as
 * the toolbar does, before the editor's own Ctrl+E (code) can take the key. On a page (`page`), its title
 * and part lines keep their style, as the toolbar leaves them; the key does nothing there.
 */
export const WordKeys = Extension.create<{ page: boolean }>({
  name: "wordKeys",
  priority: 1000,

  addOptions() {
    return { page: false };
  },

  addKeyboardShortcuts() {
    const align = (side: "left" | "center" | "right" | "justify") => () => {
      const { doc, selection } = this.editor.state;
      if (!(this.options.page && isLeadLine(doc, selection.$from.index(0)))) this.editor.chain().focus().setTextAlign(side).run();
      // Taken either way: never code, and never Ctrl+R's reload.
      return true;
    };
    return { "Mod-l": align("left"), "Mod-e": align("center"), "Mod-r": align("right"), "Mod-j": align("justify") };
  },
});
