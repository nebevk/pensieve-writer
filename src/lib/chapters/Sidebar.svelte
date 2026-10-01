<script lang="ts">
  import type { Chapter } from "$lib/model";

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
      {#each chapters as chapter (chapter.id)}
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
              {chapter.title}
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
    background: var(--sidebar);
  }

  .sidebar-inner {
    width: 15rem;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 0.75rem 0.4rem;
  }

  h2 {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .sidebar-head button,
  li button,
  li input {
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
  }

  .sidebar-head button {
    padding: 0.2rem 0.45rem;
    color: var(--accent);
  }

  .sidebar-head button:hover,
  li button:hover {
    background: rgba(255, 255, 255, 0.45);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    overflow: auto;
    flex: 1;
  }

  li button,
  li input {
    width: 100%;
    text-align: left;
    padding: 0.45rem 0.6rem;
  }

  li button.active,
  li.drop-target button {
    background: var(--paper);
  }

  li input {
    background: var(--paper);
    border-color: var(--line);
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
    background: rgba(255, 255, 255, 0.45);
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
