<script lang="ts" module>
  /** One choice in the library's menu; a "rule" draws a line between groups of choices, and `text` a question. */
  export type MenuItem =
    | { label: string; run: () => void; disabled?: boolean; checked?: boolean; danger?: boolean; keys?: string }
    | { text: string }
    | "rule";
</script>

<script lang="ts">
  import { onMount, tick } from "svelte";

  let {
    x,
    y,
    items,
    onClose,
  }: {
    /** Where the pointer was, or the row's corner when the keyboard opened it. */
    x: number;
    y: number;
    items: MenuItem[];
    /** Called once the menu is done, chosen or not; the row that opened it gets the keyboard back. */
    onClose: () => void;
  } = $props();

  let menu = $state<HTMLDivElement | undefined>(undefined);
  let left = $state(0);
  let top = $state(0);

  onMount(async () => {
    left = x;
    top = y;
    await tick();
    if (!menu) return;
    // Kept inside the window, as a menu near its right or bottom edge opens the other way.
    const box = menu.getBoundingClientRect();
    if (left + box.width > window.innerWidth - 4) left = Math.max(4, window.innerWidth - box.width - 4);
    if (top + box.height > window.innerHeight - 4) top = Math.max(4, y - box.height);
    choices()[0]?.focus();
  });

  function choices(): HTMLButtonElement[] {
    return menu ? [...menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")] : [];
  }

  function choose(item: Extract<MenuItem, { run: () => void }>) {
    onClose();
    item.run();
  }

  function onKeydown(event: KeyboardEvent) {
    const all = choices();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      all[(index + step + all.length) % all.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? all[0] : all[all.length - 1])?.focus();
    }
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    if (menu && !menu.contains(event.target as Node)) onClose();
  }}
  onblur={onClose}
  onresize={onClose}
/>

<div class="tree-menu" role="menu" tabindex="-1" bind:this={menu} style:left="{left}px" style:top="{top}px" onkeydown={onKeydown}>
  {#each items as item, index (index)}
    {#if item === "rule"}
      <div class="rule" role="separator"></div>
    {:else if "text" in item}
      <p class="question">{item.text}</p>
    {:else}
      <button
        type="button"
        role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
        aria-checked={item.checked}
        class:danger={item.danger}
        disabled={item.disabled}
        onclick={() => choose(item)}
      >
        <span class="tick" aria-hidden="true">{item.checked ? "✓" : ""}</span>
        <span class="label">{item.label}</span>
        {#if item.keys}<span class="keys">{item.keys}</span>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .tree-menu {
    position: fixed;
    z-index: 30;
    display: flex;
    flex-direction: column;
    min-width: 12.5rem;
    max-width: 20rem;
    padding: 4px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-chrome-raised);
    box-shadow: var(--pv-shadow-window);
  }

  .tree-menu:focus {
    outline: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 5px 8px 5px 4px;
    background: transparent;
    color: var(--pv-text);
    text-align: left;
    font-size: var(--pv-text-md);
  }

  button:hover:not(:disabled),
  button:focus-visible {
    background: var(--pv-selected);
  }

  button:focus-visible {
    outline-offset: -2px;
  }

  button:active:not(:disabled) {
    background: var(--pv-pressed);
  }

  button:disabled {
    color: var(--pv-text-faint);
  }

  .danger {
    color: var(--pv-danger);
  }

  .tick {
    width: 14px;
    flex: none;
    text-align: center;
    color: var(--pv-accent);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .keys {
    flex: none;
    color: var(--pv-text-faint);
    font-size: var(--pv-text-sm);
  }

  .rule {
    height: 1px;
    margin: 4px 2px;
    background: var(--pv-line);
  }

  .question {
    margin: 4px 8px 6px;
    max-width: 18rem;
    color: var(--pv-text);
    font-size: var(--pv-text-md);
    line-height: 1.4;
  }
</style>
