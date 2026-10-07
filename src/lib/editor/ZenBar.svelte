<script lang="ts">
  import type { Editor } from "@tiptap/core";
  import { isLeadLine } from "$lib/chapters/page";
  import { plural, t } from "$lib/ui.svelte";
  import Icon from "./Icon.svelte";

  let {
    editor,
    revision,
    words,
    column = $bindable(44),
    onLeave,
    onRefused,
  }: {
    editor: Editor | null;
    /** Bumps on every edit or cursor move, so the buttons show what the cursor is in. */
    revision: number;
    /** The open chapter's words. */
    words: number;
    /** The width of the text, in rem. */
    column?: number;
    onLeave: () => void;
    /** Says why a change was turned away, such as a list on the title line. */
    onRefused?: (message: string) => void;
  } = $props();

  const ready = () => (editor && !editor.isDestroyed ? editor : null);
  const active = (name: string, attrs?: Record<string, unknown>) => revision >= 0 && ready()?.isActive(name, attrs) === true;
  const run = (apply: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    const current = ready();
    if (current) apply(current.chain().focus()).run();
  };
  /** A change of the line's style, which the title and part lines keep. */
  const restyle = (apply: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    const current = ready();
    if (current && isLeadLine(current.state.doc, current.state.selection.$from.index(0))) onRefused?.(t("leadLineStyle"));
    else run(apply);
  };
</script>

<!-- Zen's one bar, as quiet as Grammarly's: a few marks and headings, the word count, and the way out. -->
<div class="zen-tools" role="toolbar" aria-label={t("zen")}>
  <button type="button" class="letter" class:on={active("bold")} aria-pressed={active("bold")} title={`${t("bold")} (Ctrl+B)`} aria-label={t("bold")} onmousedown={(event) => event.preventDefault()} onclick={() => run((chain) => chain.toggleBold())}><b>B</b></button>
  <button type="button" class="letter" class:on={active("italic")} aria-pressed={active("italic")} title={`${t("italic")} (Ctrl+I)`} aria-label={t("italic")} onmousedown={(event) => event.preventDefault()} onclick={() => run((chain) => chain.toggleItalic())}><i>I</i></button>
  <button type="button" class="letter" class:on={active("underline")} aria-pressed={active("underline")} title={`${t("underline")} (Ctrl+U)`} aria-label={t("underline")} onmousedown={(event) => event.preventDefault()} onclick={() => run((chain) => chain.toggleUnderline())}><u>U</u></button>
  <span class="rule"></span>
  <button type="button" class="letter small" class:on={active("heading", { level: 2 })} aria-pressed={active("heading", { level: 2 })} title={t("heading2")} aria-label={t("heading2")} onmousedown={(event) => event.preventDefault()} onclick={() => restyle((chain) => chain.toggleHeading({ level: 2 }))}>H2</button>
  <button type="button" class="letter small" class:on={active("heading", { level: 3 })} aria-pressed={active("heading", { level: 3 })} title={t("heading3")} aria-label={t("heading3")} onmousedown={(event) => event.preventDefault()} onclick={() => restyle((chain) => chain.toggleHeading({ level: 3 }))}>H3</button>
  <span class="rule"></span>
  <button type="button" class:on={active("bulletList")} aria-pressed={active("bulletList")} title={t("bulletedList")} aria-label={t("bulletedList")} onmousedown={(event) => event.preventDefault()} onclick={() => restyle((chain) => chain.toggleBulletList())}><Icon name="list" /></button>
  <button type="button" class:on={active("orderedList")} aria-pressed={active("orderedList")} title={t("numberedList")} aria-label={t("numberedList")} onmousedown={(event) => event.preventDefault()} onclick={() => restyle((chain) => chain.toggleOrderedList())}><Icon name="listOrdered" /></button>
  <span class="rule"></span>
  <span class="words">{plural("words", words)}</span>
  <input class="width" type="range" min="32" max="60" bind:value={column} title={t("columnWidth")} aria-label={t("columnWidth")} />
  <button type="button" class="leave" title={`${t("leaveZen")} (Esc)`} onclick={onLeave}><Icon name="moon" />{t("leaveZen")}</button>
</div>

<style>
  .zen-tools {
    position: absolute;
    left: 50%;
    bottom: 14px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    transform: translateX(-50%);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-paper);
    color: var(--pv-ink-meta);
    font-family: var(--pv-font-ui);
    font-size: var(--pv-text-sm);
    white-space: nowrap;
    opacity: 0.75;
    transition: opacity var(--pv-dur) var(--pv-ease);
  }

  .zen-tools:hover,
  .zen-tools:focus-within {
    opacity: 1;
  }

  button {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    min-width: 26px;
    justify-content: center;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0 6px;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  button :global(svg) {
    width: 14px;
    height: 14px;
  }

  button:hover {
    color: var(--pv-ink);
    background: color-mix(in srgb, var(--pv-ink) 7%, transparent);
  }

  button.on {
    color: var(--pv-ink);
    background: color-mix(in srgb, var(--pv-ink) 10%, transparent);
  }

  .letter {
    font-family: var(--pv-font-manuscript);
    font-size: 15px;
  }

  .letter.small {
    font-family: var(--pv-font-ui);
    font-size: 12px;
    font-weight: 600;
  }

  .rule {
    width: 1px;
    height: 14px;
    margin: 0 6px;
    background: color-mix(in srgb, var(--pv-ink) 15%, transparent);
  }

  .words {
    padding: 0 6px;
  }

  .width {
    width: 72px;
    margin: 0 8px;
    accent-color: var(--pv-ink-accent);
  }

  .leave {
    color: var(--pv-ink-accent);
  }
</style>
