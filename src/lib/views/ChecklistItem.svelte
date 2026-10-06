<script lang="ts">
  import type { TodoState } from "$lib/storage/organize";
  import type { UiKey } from "$lib/i18n";
  import { t } from "$lib/ui.svelte";

  let {
    text,
    state = "todo",
    meta = "",
    truncate = false,
    flush = false,
    onToggle,
  }: {
    text: string;
    state?: TodoState;
    /** A second, quieter line: where the to-do came from. */
    meta?: string;
    /** One line, cut with an ellipsis, as on Home. */
    truncate?: boolean;
    /** No side padding, for a list that lines up with a heading. */
    flush?: boolean;
    /** Moves the to-do on: to do, doing, done, and back to do. */
    onToggle?: () => void;
  } = $props();

  const STATES: Record<TodoState, UiKey> = { todo: "columnTodo", doing: "columnDoing", done: "columnDone" };
</script>

<!-- A to-do on chrome, beside the page and on Home. To-dos on paper are drawn by their note card. -->
<div class="item" class:done={state === "done"} class:truncate class:flush>
  <button
    type="button"
    class="box {state}"
    title={t(STATES[state])}
    aria-label={`${text}: ${t(STATES[state])}`}
    disabled={!onToggle}
    onclick={() => onToggle?.()}
  >
    {#if state === "done"}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
    {/if}
  </button>
  <span class="words">
    <span class="text">{text}</span>
    {#if meta}
      <span class="meta">{meta}</span>
    {/if}
  </span>
</div>

<style>
  .item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 7px 8px;
    border-radius: var(--pv-radius-xs);
    font-size: var(--pv-text-base);
    line-height: 1.35;
    color: var(--pv-text);
  }

  .item.flush {
    padding: 6px 0;
  }

  .item.done {
    color: var(--pv-text-faint);
  }

  .box {
    display: grid;
    place-items: center;
    flex: none;
    width: 15px;
    height: 15px;
    margin-top: 1px;
    padding: 0;
    border: 1.5px solid var(--pv-text-faint);
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-chrome);
  }

  .box.doing {
    border-color: var(--pv-accent);
    background: linear-gradient(135deg, var(--pv-accent) 50%, transparent 50%);
  }

  .box.done {
    border: 0;
    background: var(--pv-success);
  }

  .box:disabled {
    cursor: default;
  }

  .box svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .words {
    flex: 1;
    min-width: 0;
  }

  .text {
    display: block;
  }

  .done .text {
    text-decoration: line-through;
  }

  .truncate .text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: block;
    margin-top: 2px;
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
  }
</style>
