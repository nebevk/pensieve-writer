<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import { t } from "$lib/ui.svelte";

  let {
    title,
    size = "large",
    docked = false,
    onClose,
    onPin,
    onUnpin,
    children,
    foot,
  }: {
    /** The window's name, in its bar. */
    title: string;
    /** large: Settings' size, for a window with a list down its side; small: one thing, such as a note. */
    size?: "large" | "small";
    /** Pinned in the panel beside the page instead of over it, so she can write with it open (owner, 9 October). */
    docked?: boolean;
    onClose: () => void;
    /** Given, the window has a button that pins it beside the page. */
    onPin?: () => void;
    /** Given, the pinned window has a button that makes it a window again. */
    onUnpin?: () => void;
    children: Snippet;
    /** Buttons along the window's foot, on the right as in Windows. */
    foot?: Snippet;
  } = $props();

  const titleId = $props.id();
  let panel = $state<HTMLElement | undefined>(undefined);
  // What had the keyboard gets it back when the window closes. Read before anything inside takes it.
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // A click that started inside (selecting words, say) and ended on the dimmed page doesn't close it.
  let downOnScrim = false;

  const FOCUSABLE = "button, input, select, textarea, [contenteditable='true']";

  onMount(() => {
    // Pinned beside the page, it leaves the keyboard where it is: she is writing.
    if (docked) return;
    // The keyboard goes to the field marked autofocus (Svelte's own only takes it from nobody), or the
    // first control, unless something inside has it already.
    if (panel && !panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>("[autofocus]") ?? panel.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }
    return () => {
      const now = document.activeElement;
      if (opener?.isConnected && (!now || now === document.body || panel?.contains(now))) opener.focus();
    };
  });

  function keys(event: KeyboardEvent) {
    // Ctrl+S saves as it does everywhere; the page's other shortcuts stay out of the window.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (item) => !item.hasAttribute("disabled") && item.tabIndex !== -1,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

{#snippet frame()}
  <header>
    <span id={titleId}>{title}</span>
    {#if docked && onUnpin}
      <button type="button" class="icon" title={t("unpinWindow")} aria-label={t("unpinWindow")} onclick={onUnpin}><Icon name="maximize" /></button>
    {:else if !docked && onPin}
      <button type="button" class="icon" title={t("pinBeside")} aria-label={t("pinBeside")} onclick={onPin}><Icon name="panelRight" /></button>
    {/if}
    <button type="button" class="icon" title={t("close")} aria-label={t("close")} onclick={onClose}><Icon name="x" /></button>
  </header>
  <div class="content">
    {@render children()}
  </div>
  {#if foot}
    <footer>
      {@render foot()}
    </footer>
  {/if}
{/snippet}

{#if docked}
  <!-- Pinned: the panel beside the page, which stays free to write in. -->
  <aside class="window docked" aria-labelledby={titleId} bind:this={panel}>
    {@render frame()}
  </aside>
{:else}
  <!-- A window over the dimmed app, as Settings is: its name and ✕ at the top, Escape or a click beside it closes it. -->
  <div
    class="scrim"
    role="presentation"
    onpointerdown={(event) => (downOnScrim = event.target === event.currentTarget)}
    onclick={(event) => {
      if (downOnScrim && event.target === event.currentTarget) onClose();
    }}
  >
    <div
      class="window {size}"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      bind:this={panel}
      onkeydown={keys}
    >
      {@render frame()}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    background: var(--pv-scrim);
    animation: scrim-in var(--pv-dur-fast, 160ms) ease-out;
  }

  .window {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--pv-radius-window);
    background: var(--pv-chrome);
    color: var(--pv-text);
    box-shadow: var(--pv-shadow-window);
    animation: window-in 180ms cubic-bezier(0.2, 0.8, 0.3, 1);
  }

  .window.large {
    width: min(880px, calc(100% - 48px));
    height: min(620px, calc(100% - 48px));
  }

  .window.small {
    width: min(640px, calc(100% - 48px));
    max-height: min(660px, calc(100% - 48px));
  }

  /* Pinned: the panel's place beside the page, as the chapter's notes and to-dos have. */
  .window.docked {
    min-width: 0;
    min-height: 0;
    border-radius: 0;
    border-left: 1px solid var(--pv-line);
    box-shadow: none;
    animation: dock-in 180ms cubic-bezier(0.2, 0.8, 0.3, 1);
  }

  .window:focus {
    outline: none;
  }

  header {
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
    height: 34px;
    padding: 0 10px 0 16px;
    border-bottom: 1px solid var(--pv-line);
    font-size: var(--pv-text-md);
    font-weight: 600;
  }

  header span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .icon {
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--pv-text-subtle);
    border-radius: var(--pv-radius-xs);
    padding: 4px;
  }

  .icon :global(svg) {
    width: 15px;
    height: 15px;
  }

  .icon:hover {
    background: var(--pv-selected);
  }

  .icon:active {
    background: var(--pv-pressed);
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  footer {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--pv-line);
  }

  .docked footer {
    padding: 10px 12px;
  }

  /* The window's buttons: plain ones, and the one it is mostly for in the accent. */
  footer :global(button) {
    height: 32px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
    color: var(--pv-text);
    padding: 0 12px;
  }

  footer :global(button:hover:not(:disabled)) {
    background: var(--pv-selected);
  }

  footer :global(button:active:not(:disabled)) {
    background: var(--pv-pressed);
  }

  footer :global(button.primary) {
    border-color: transparent;
    background: var(--pv-accent-solid);
    color: var(--pv-on-accent);
  }

  footer :global(button.primary:hover:not(:disabled)) {
    background: var(--pv-accent-solid);
    filter: brightness(1.08);
  }

  footer :global(button:disabled) {
    opacity: 0.5;
  }

  /* A line of words at the foot's left, such as what a button will do. */
  footer :global(.say) {
    flex: 1 1 100%;
    margin: 0 0 2px;
    color: var(--pv-text);
    font-size: var(--pv-text-base);
  }

  @keyframes scrim-in {
    from {
      opacity: 0;
    }
  }

  @keyframes window-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.985);
    }
  }

  @keyframes dock-in {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
  }
</style>
