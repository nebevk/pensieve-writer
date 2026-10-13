<script lang="ts">
  import { tick } from "svelte";
  import type { Editor } from "@tiptap/core";
  import { isLeadLine } from "$lib/chapters/page";
  import { countWords } from "./counts";
  import Icon from "./Icon.svelte";
  import { t } from "$lib/ui.svelte";

  let {
    editor,
    zen = false,
    onComment,
    onNote,
    onFind,
    onWords,
  }: {
    editor: Editor | null;
    /** In Zen only the formatting shows: comments, notes and finding are for Write. */
    zen?: boolean;
    onComment: () => void;
    /** A note of the selected words, or the words linked to the note of that name. */
    onNote: () => void;
    /** Looks for the selected words through the whole book. */
    onFind: (words: string) => void;
    /** How many words are selected (0 for none), said once a selection settles. */
    onWords: (count: number) => void;
  } = $props();

  // Shown once a selection settles: when the mouse is let go, or a moment after Shift and the arrows stop.
  const SETTLE_MS = 180;
  const GAP = 8;

  let bar = $state<HTMLDivElement | undefined>(undefined);
  let shown = $state(false);
  let left = $state(0);
  let top = $state(0);
  // The selection is in the page's title or part line, which keeps plain text.
  let lead = $state(false);
  let active = $state({ bold: false, italic: false, underline: false, highlight: false });
  let words = 0;

  const tools = $derived({ format: !lead, write: !zen && !lead, find: !zen });

  /** Keeps the selection, and the keyboard in the page, when a button is pressed. */
  const keep = (event: MouseEvent) => event.preventDefault();

  /**
   * Follows the page's selection. Typing moves the cursor at every key, so what runs then is a check and
   * nothing more: the work waits until there is a selection and it has settled.
   */
  $effect(() => {
    const current = editor;
    if (!current) return;
    const dom = current.view.dom;
    let timer = 0;
    let pointerDown = false;

    const hide = () => {
      window.clearTimeout(timer);
      if (shown) shown = false;
    };
    const count = (value: number) => {
      if (value === words) return;
      words = value;
      onWords(value);
    };
    const refresh = () => {
      active = {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        highlight: current.isActive("highlight"),
      };
    };
    /** Above the selection's first line, or under its last when the first is out of sight. */
    const place = () => {
      const box = bar?.parentElement?.getBoundingClientRect();
      if (!bar || !box) return;
      const { from, to, head } = current.state.selection;
      const start = current.view.coordsAtPos(from);
      const end = current.view.coordsAtPos(to);
      const width = bar.offsetWidth;
      const height = bar.offsetHeight;
      const stage = dom.closest(".stage")?.getBoundingClientRect();
      const oneLine = Math.abs(start.top - end.top) < 2;
      const middle = oneLine ? (start.left + end.right) / 2 : dom.getBoundingClientRect().left + dom.clientWidth / 2;
      let y = start.top - height - GAP;
      if (stage && y < stage.top) y = current.view.coordsAtPos(head).bottom + GAP;
      top = Math.round(y - box.top);
      left = Math.round(Math.min(Math.max(middle - box.left - width / 2, 0), Math.max(0, box.width - width)));
    };
    const settled = async () => {
      if (current.isDestroyed) return;
      const { selection, doc } = current.state;
      // A picture or a footnote picked on its own has no words to work on.
      if (selection.empty || "node" in selection) return;
      const text = doc.textBetween(selection.from, selection.to, "\n");
      count(countWords(text));
      if (!current.view.hasFocus() || !text.trim()) return;
      lead = isLeadLine(doc, selection.$from.index(0)) || isLeadLine(doc, selection.$to.index(0));
      if (!tools.format && !tools.find) return;
      refresh();
      // Its buttons first (the title line has fewer), then its width is known and it can be placed.
      await tick();
      if (current.isDestroyed || current.state.selection !== selection) return;
      place();
      shown = true;
    };
    const settle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void settled(), SETTLE_MS);
    };

    const onSelection = () => {
      hide();
      if (current.state.selection.empty) count(0);
      else if (!pointerDown) settle();
    };
    // Bold and the like change the text but not the selection: the bar stays, its buttons follow.
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!shown || !transaction.docChanged) return;
      if (current.state.selection.empty) hide();
      else {
        refresh();
        place();
      }
    };
    const onBlur = () => hide();
    const down = () => {
      pointerDown = true;
      hide();
    };
    const up = () => {
      if (!pointerDown) return;
      pointerDown = false;
      if (!current.state.selection.empty) settle();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    current.on("selectionUpdate", onSelection);
    current.on("transaction", onTransaction);
    current.on("blur", onBlur);
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    dom.addEventListener("keydown", keys);
    return () => {
      current.off("selectionUpdate", onSelection);
      current.off("transaction", onTransaction);
      current.off("blur", onBlur);
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      dom.removeEventListener("keydown", keys);
      hide();
      count(0);
    };
  });

  function format(command: (current: Editor) => void) {
    if (editor && !editor.isDestroyed) command(editor);
  }

  function selectedWords(): string {
    if (!editor || editor.isDestroyed) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n").trim();
  }
</script>

<!-- What can be done with the selected words, beside them, as Word's mini toolbar does (owner, 12 October). -->
<div
  class="selection-bar"
  class:shown
  bind:this={bar}
  style:left="{left}px"
  style:top="{top}px"
  role="toolbar"
  aria-label={t("selectedText")}
  aria-hidden={!shown}
>
  {#if tools.format}
    <button type="button" class="bold" class:on={active.bold} title={`${t("bold")} (Ctrl+B)`} aria-label={t("bold")} aria-pressed={active.bold} tabindex={shown ? 0 : -1} onmousedown={keep} onclick={() => format((current) => current.chain().focus().toggleBold().run())}>B</button>
    <button type="button" class="italic" class:on={active.italic} title={`${t("italic")} (Ctrl+I)`} aria-label={t("italic")} aria-pressed={active.italic} tabindex={shown ? 0 : -1} onmousedown={keep} onclick={() => format((current) => current.chain().focus().toggleItalic().run())}>I</button>
    <button type="button" class="underline" class:on={active.underline} title={`${t("underline")} (Ctrl+U)`} aria-label={t("underline")} aria-pressed={active.underline} tabindex={shown ? 0 : -1} onmousedown={keep} onclick={() => format((current) => current.chain().focus().toggleUnderline().run())}>U</button>
    <button type="button" class:on={active.highlight} title={t("highlight")} aria-label={t("highlight")} aria-pressed={active.highlight} tabindex={shown ? 0 : -1} onmousedown={keep} onclick={() => format((current) => current.chain().focus().toggleMark("highlight").run())}>
      <span class="swatch"></span>
    </button>
  {/if}
  {#if tools.write}
    <span class="rule" aria-hidden="true"></span>
    <button type="button" title={`${t("comment")} (Ctrl+Alt+M)`} aria-label={t("comment")} tabindex={shown ? 0 : -1} onmousedown={keep} onclick={onComment}><Icon name="comment" /></button>
    <button
      type="button"
      title={t("noteFromSelection")}
      aria-label={t("noteFromSelection")}
      tabindex={shown ? 0 : -1}
      onmousedown={keep}
      onclick={() => {
        shown = false;
        onNote();
      }}><Icon name="newNote" /></button
    >
  {/if}
  {#if tools.find}
    {#if tools.format}<span class="rule" aria-hidden="true"></span>{/if}
    <button
      type="button"
      title={t("findInProject")}
      aria-label={t("findInProject")}
      tabindex={shown ? 0 : -1}
      onmousedown={keep}
      onclick={() => {
        shown = false;
        onFind(selectedWords());
      }}><Icon name="search" /></button
    >
  {/if}
</div>

<style>
  /* Drawn over the page, as the floating bar is; out of sight (not out of the layout) until it's needed. */
  .selection-bar {
    position: absolute;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 1px;
    height: 32px;
    padding: 0 3px;
    background: var(--pv-bar-bg);
    border: 1px solid var(--pv-bar-border);
    border-radius: var(--pv-radius-md);
    box-shadow: var(--pv-shadow-bar);
    color: var(--pv-bar-text);
    visibility: hidden;
    opacity: 0;
    transform: translateY(3px);
    pointer-events: none;
    transition:
      opacity 120ms ease,
      transform 120ms ease,
      visibility 0s linear 120ms;
  }

  .selection-bar.shown {
    visibility: visible;
    opacity: 1;
    transform: none;
    pointer-events: auto;
    transition:
      opacity 120ms ease,
      transform 120ms ease;
  }

  button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: inherit;
    font-family: var(--pv-font-ui);
    font-size: 14px;
  }

  button:hover {
    background: color-mix(in srgb, var(--pv-bar-text) 14%, transparent);
  }

  button:active,
  button.on {
    background: color-mix(in srgb, var(--pv-bar-text) 24%, transparent);
  }

  button :global(svg) {
    width: 15px;
    height: 15px;
  }

  .bold {
    font-weight: 700;
  }

  .italic {
    font-family: var(--pv-font-manuscript);
    font-style: italic;
    font-size: 16px;
  }

  .underline {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .swatch {
    width: 13px;
    height: 11px;
    background: var(--pv-highlight, #f2dc8f);
    border: 1px solid var(--pv-highlight-edge, #d9bf63);
  }

  .rule {
    width: 1px;
    height: 16px;
    margin: 0 3px;
    background: var(--pv-bar-line);
  }

  @media print {
    .selection-bar {
      display: none;
    }
  }
</style>
