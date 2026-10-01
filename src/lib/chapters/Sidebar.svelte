<script lang="ts">
  import type { Chapter } from "$lib/model";

  let {
    chapters,
    activeId,
    collapsed,
    onSelect,
    onCreate,
    onRename,
  }: {
    chapters: Chapter[];
    activeId: string | null;
    collapsed: boolean;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string, title: string) => void;
  } = $props();

  let editingId = $state<string | null>(null);
  let draftTitle = $state("");
  let renameInput = $state<HTMLInputElement | undefined>(undefined);
  let skipCommit = false;

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
        <li>
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
              class:active={chapter.id === activeId}
              onclick={() => onSelect(chapter.id)}
              ondblclick={() => beginRename(chapter)}
            >
              {chapter.title}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
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

  li button.active {
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
</style>
