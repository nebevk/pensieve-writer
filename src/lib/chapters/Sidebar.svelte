<script lang="ts">
  import type { Chapter } from "$lib/model";
  import { compactWords, countWords } from "$lib/editor/counts";

  let {
    chapters,
    activeId,
    collapsed,
    onSelect,
    onCreate,
    onRename,
    onDuplicate,
    onDelete,
    onReorder,
  }: {
    chapters: Chapter[];
    activeId: string | null;
    collapsed: boolean;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string, title: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onReorder: (draggedId: string, targetId: string) => void;
  } = $props();

  let editingId = $state<string | null>(null);
  let draftTitle = $state("");
  let renameInput = $state<HTMLInputElement | undefined>(undefined);
  let skipCommit = false;
  let confirmDelete = $state(false);
  let draggingId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);
  let previousActiveId = $state<string | null | undefined>(undefined);

  const active = $derived(chapters.find((chapter) => chapter.id === activeId) ?? null);

  $effect(() => {
    if (previousActiveId === undefined) {
      previousActiveId = activeId;
      return;
    }
    if (activeId === previousActiveId) return;
    previousActiveId = activeId;
    confirmDelete = false;
  });

  $effect(() => {
    if (editingId && renameInput) renameInput.focus();
  });

  function beginRename(chapter: Chapter) {
    editingId = chapter.id;
    draftTitle = chapter.title;
    skipCommit = false;
  }

  function commitRename() {
    if (skipCommit) {
      skipCommit = false;
      editingId = null;
      return;
    }
    if (!editingId) return;
    const id = editingId;
    const title = draftTitle.trim() || "Untitled";
    editingId = null;
    onRename(id, title);
  }

  function onRenameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      skipCommit = true;
      editingId = null;
    }
  }
</script>

<aside class="sidebar" inert={collapsed}>
  <div class="sidebar-inner">
    <div class="sidebar-head">
      <h2>Chapters</h2>
      <button type="button" onclick={onCreate}>New</button>
    </div>
    <ul>
      {#each chapters as chapter, index (chapter.id)}
        <li
          class:drop-target={dropTargetId === chapter.id}
          ondragover={(event) => {
            event.preventDefault();
            dropTargetId = chapter.id;
          }}
          ondrop={() => {
            if (draggingId) onReorder(draggingId, chapter.id);
            draggingId = null;
            dropTargetId = null;
          }}
        >
          {#if editingId === chapter.id}
            <input
              bind:this={renameInput}
              bind:value={draftTitle}
              aria-label="Chapter title"
              onblur={commitRename}
              onkeydown={onRenameKeydown}
            />
          {:else}
            <button
              type="button"
              draggable="true"
              class:active={chapter.id === activeId}
              onclick={() => onSelect(chapter.id)}
              ondblclick={() => beginRename(chapter)}
              ondragstart={() => (draggingId = chapter.id)}
              ondragend={() => {
                draggingId = null;
                dropTargetId = null;
              }}
            >
              <span class="num">{index + 1}</span>
              <span class="name">{chapter.title}</span>
              <span class="dot" class:final={chapter.status === "final"} class:revised={chapter.status === "revised"} class:empty={!chapter.plainText.trim()} aria-label={chapter.status}></span>
              <span class="count">{compactWords(countWords(chapter.plainText))}</span>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    <div class="chapter-actions">
      <button type="button" disabled={!active} onclick={() => active && onDuplicate(active.id)}>
        Duplicate
      </button>
      <button
        type="button"
        disabled={!active || chapters.length < 2}
        title={chapters.length < 2 ? "A project keeps at least one chapter" : "Delete this chapter"}
        onclick={() => (confirmDelete = true)}
      >
        Delete
      </button>
    </div>
    {#if confirmDelete && active}
      <div class="confirm">
        <p>Delete “{active.title}”?</p>
        <button type="button" class="danger" onclick={() => onDelete(active.id)}>Delete</button>
        <button type="button" onclick={() => (confirmDelete = false)}>Cancel</button>
      </div>
    {/if}
    <a class="spike" href="/spellcheck">Spell check test</a>
  </div>
</aside>

<style>
  .sidebar {
    min-width: 0;
    overflow: hidden;
    background: var(--pv-chrome);
    color: var(--pv-text);
  }

  .sidebar-inner {
    width: var(--pv-sidebar-w);
    height: 100%;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--pv-line);
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 12px 8px;
  }

  h2 {
    margin: 0;
    font-size: var(--pv-heading-sm);
    font-weight: 400;
    color: var(--pv-text);
  }

  .sidebar-head button,
  li button,
  li input {
    border: 0;
    background: transparent;
    border-radius: var(--pv-radius-xs);
  }

  .sidebar-head button {
    padding: 2px 6px;
    color: var(--pv-accent);
    font-size: var(--pv-text-md);
  }

  .sidebar-head button:hover,
  li button:hover {
    background: var(--pv-selected);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0 8px;
    overflow: auto;
    flex: 1;
  }

  li button,
  li input {
    width: 100%;
    text-align: left;
    padding: 7px 8px;
  }

  li button {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--pv-text-base);
    color: var(--pv-text);
  }

  li button.active,
  li.drop-target button {
    background: var(--pv-selected);
    font-weight: 600;
  }

  .num,
  .count {
    color: var(--pv-text-faint);
    font-weight: 400;
    font-size: var(--pv-text-sm);
  }

  .num {
    width: 14px;
    font-size: 11px;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    width: 28px;
    text-align: right;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    box-sizing: border-box;
    border: 1.5px solid var(--pv-text-faint);
    flex: none;
  }

  .dot.final {
    background: var(--pv-status-final);
    border: 0;
  }

  .dot.revised {
    background: var(--pv-accent);
    border: 0;
  }

  .dot.empty {
    border-color: var(--pv-empty);
    background: transparent;
  }

  li input {
    background: var(--pv-field);
    border: 1px solid var(--pv-line-strong);
    color: var(--pv-text);
  }

  .spike {
    margin: 0.5rem 0.75rem 0.85rem;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .chapter-actions,
  .confirm {
    display: flex;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem 0;
  }

  .chapter-actions button,
  .confirm button {
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 0.2rem 0.4rem;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .chapter-actions button:hover:not(:disabled),
  .confirm button:hover {
    background: var(--pv-selected);
  }

  .chapter-actions button:disabled {
    opacity: 0.4;
  }

  .confirm {
    flex-wrap: wrap;
    align-items: center;
  }

  .confirm p {
    margin: 0;
    width: 100%;
    color: var(--ink);
    font-size: 0.8rem;
  }

  .confirm .danger {
    color: var(--danger);
  }
</style>
