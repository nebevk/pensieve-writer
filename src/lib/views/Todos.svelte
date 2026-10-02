<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Chapter } from "$lib/model";
  import {
    listNotes,
    listTasks,
    saveNote,
    saveTask,
    type Note,
    type Task,
    type TodoState,
  } from "$lib/storage/organize";

  let {
    projectId,
    chapters = [],
    compact = false,
    onShowNotes,
    focusRequest = 0,
  }: {
    projectId: string;
    chapters?: Chapter[];
    compact?: boolean;
    onShowNotes?: () => void;
    focusRequest?: number;
  } = $props();

  let notes = $state<Note[]>([]);
  let tasks = $state<Task[]>([]);
  let draft = $state("");
  let message = $state("");
  let filter = $state<string>("open");
  let addInput = $state<HTMLInputElement | undefined>(undefined);
  let seenFocus = 0;

  const ordered = $derived([...chapters].sort((a, b) => a.position - b.position));
  const columns: { id: TodoState; label: string }[] = [
    { id: "todo", label: "To do" },
    { id: "doing", label: "Doing" },
    { id: "done", label: "Done" },
  ];

  const cards = $derived.by(() => {
    const fromNotes = notes
      .filter((note) => note.todoState)
      .map((note) => ({
        id: note.id,
        title: note.title,
        state: note.todoState ?? "todo",
        kind: "note" as const,
        chapterId: "",
        noteId: note.id,
        noteTitle: note.title,
      }));
    const fromTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      state: task.todoState,
      kind: "task" as const,
      chapterId: task.chapterId,
      noteId: task.noteId,
      noteTitle: notes.find((note) => note.id === task.noteId)?.title ?? "",
    }));
    return [...fromTasks, ...fromNotes];
  });

  const openCount = $derived(cards.filter((card) => card.state !== "done").length);
  const noteCount = $derived(notes.length);

  function chapterLabel(id: string): string {
    if (!id) return "Whole book";
    const index = ordered.findIndex((chapter) => chapter.id === id);
    const chapter = ordered[index];
    return chapter ? `${index + 1} · ${chapter.title}` : "Chapter";
  }

  function visible(card: (typeof cards)[number]): boolean {
    if (filter === "open") return true;
    if (filter === "notes") return card.noteId.length > 0 || card.kind === "note";
    if (filter === "book") return card.chapterId === "" && card.kind === "task";
    return card.chapterId === filter;
  }

  onMount(() => {
    void refresh();
  });

  $effect(() => {
    if (focusRequest !== seenFocus) {
      seenFocus = focusRequest;
      if (focusRequest > 0) void tick().then(() => addInput?.focus());
    }
  });

  async function refresh() {
    try {
      [notes, tasks] = await Promise.all([listNotes(projectId), listTasks(projectId)]);
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not load to-dos";
    }
  }

  function nextState(state: TodoState): TodoState {
    if (state === "todo") return "doing";
    if (state === "doing") return "done";
    return "todo";
  }

  async function cycle(id: string, kind: "note" | "task") {
    const updatedAt = new Date().toISOString();
    try {
      if (kind === "note") {
        const note = notes.find((item) => item.id === id);
        if (!note?.todoState) return;
        const next = { ...note, todoState: nextState(note.todoState), updatedAt };
        notes = notes.map((item) => (item.id === id ? next : item));
        await saveNote(next);
      } else {
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        const next = { ...task, todoState: nextState(task.todoState), updatedAt };
        tasks = tasks.map((item) => (item.id === id ? next : item));
        await saveTask(next);
      }
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not update that to-do";
    }
  }

  async function add() {
    const title = draft.trim();
    if (!title) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title,
      todoState: "todo",
      updatedAt: new Date().toISOString(),
      chapterId: filter !== "open" && filter !== "notes" && filter !== "book" ? filter : "",
      noteId: "",
    };
    draft = "";
    tasks = [task, ...tasks];
    try {
      await saveTask(task);
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not add that to-do";
    }
  }
</script>

<section class="board" class:compact>
  {#if !compact}
    <aside>
      <div class="switch" role="tablist">
        <button type="button" role="tab" onclick={() => onShowNotes?.()}>Notes <span>{noteCount}</span></button>
        <button type="button" class="on" role="tab" aria-selected="true">To-dos <span>{openCount}</span></button>
      </div>
      <p class="eyebrow">Show</p>
      <button type="button" class="row" class:active={filter === "open"} onclick={() => (filter = "open")}>
        <span>Open to-dos</span><span>{openCount}</span>
      </button>
      <button type="button" class="row" class:active={filter === "notes"} onclick={() => (filter = "notes")}>
        <span>From notes</span>
        <span>{cards.filter((card) => card.state !== "done" && (card.noteId || card.kind === "note")).length}</span>
      </button>
      <p class="eyebrow">By chapter</p>
      <button type="button" class="row" class:active={filter === "book"} onclick={() => (filter = "book")}>
        <span>Whole book</span>
        <span>{cards.filter((card) => card.state !== "done" && card.chapterId === "" && card.kind === "task").length}</span>
      </button>
      {#each ordered as chapter, index (chapter.id)}
        <button type="button" class="row" class:active={filter === chapter.id} onclick={() => (filter = chapter.id)}>
          <span>{index + 1} · {chapter.title}</span>
          <span>{cards.filter((card) => card.state !== "done" && card.chapterId === chapter.id).length}</span>
        </button>
      {/each}
    </aside>
  {/if}

  <div class="desk">
    <form
      class="quick"
      onsubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <span>+</span>
      <input bind:this={addInput} bind:value={draft} placeholder="Add a to-do…" aria-label="Add a to-do" />
      <span class="hint">Enter to add</span>
    </form>
    <div class="columns">
      {#each columns as column (column.id)}
        {@const items = cards.filter((card) => card.state === column.id && visible(card))}
        <section>
          <h2>{column.label} <span>{items.length}</span></h2>
          {#each items as card (card.kind + card.id)}
            <button type="button" class="slip" class:done={column.id === "done"} onclick={() => void cycle(card.id, card.kind)}>
              <span>{card.title}</span>
              <span class="tags">
                {#if card.kind === "task"}
                  <span class="tag">{chapterLabel(card.chapterId)}</span>
                {/if}
                {#if card.noteTitle && card.kind === "task"}
                  <span class="tag note">{card.noteTitle}</span>
                {:else if card.kind === "note"}
                  <span class="tag note">{card.noteTitle}</span>
                {/if}
              </span>
            </button>
          {/each}
        </section>
      {/each}
    </div>
    {#if message}
      <p class="error" role="alert">{message}</p>
    {/if}
  </div>
</section>

<style>
  .board {
    display: grid;
    grid-template-columns: var(--pv-sidebar-wide-w) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    background: var(--pv-desk);
    color: var(--pv-text);
  }

  .compact {
    grid-template-columns: 1fr;
  }

  aside {
    overflow: auto;
    padding: 16px 12px;
    border-right: 1px solid var(--pv-line);
    background: var(--pv-chrome);
  }

  .switch {
    display: flex;
    margin-bottom: 8px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
  }

  .switch button,
  .row {
    border: 0;
    background: transparent;
    color: var(--pv-text);
    text-align: left;
  }

  .switch button {
    flex: 1;
    padding: 6px 0;
    text-align: center;
    font-size: var(--pv-text-md);
  }

  .switch button.on {
    background: var(--pv-mark-bg);
    color: var(--pv-mark-fg);
    font-weight: 600;
  }

  .switch span {
    opacity: 0.6;
  }

  .eyebrow {
    margin: 12px 8px 4px;
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
    color: var(--pv-text-faint);
    font-weight: 600;
  }

  .row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    border-radius: var(--pv-radius-xs);
    padding: 7px 10px;
    font-size: var(--pv-text-base);
  }

  .row.active,
  .row:hover {
    background: var(--pv-selected);
  }

  .row.active {
    font-weight: 600;
  }

  .row span:last-child {
    color: var(--pv-text-faint);
    font-weight: 400;
  }

  .desk {
    min-width: 0;
    overflow: auto;
    padding: 26px 32px 48px;
  }

  .quick {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(560px, 100%);
    height: 38px;
    margin-bottom: 22px;
    padding: 0 14px;
    background: var(--pv-paper);
    box-shadow: var(--pv-shadow-field);
    color: var(--pv-ink-muted);
  }

  .quick span:first-child {
    color: var(--pv-ink-accent);
    font-size: 17px;
  }

  .quick input {
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--pv-ink);
  }

  .hint {
    font-size: var(--pv-text-sm);
  }

  .columns {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }

  .compact .columns {
    flex-direction: column;
  }

  section {
    flex: 1;
    min-width: 0;
  }

  h2 {
    margin: 0 0 12px;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-md);
    font-weight: 400;
  }

  h2 span {
    color: var(--pv-text-faint);
    font-family: var(--pv-font-ui);
    font-size: var(--pv-text-sm);
  }

  .slip {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-bottom: 10px;
    padding: 14px 16px;
    border: 0;
    text-align: left;
    background-color: var(--pv-paper);
    background-image: var(--pv-grain);
    box-shadow: var(--pv-shadow-slip);
    color: var(--pv-ink);
    font-size: var(--pv-text-lg);
  }

  .slip:hover {
    transform: translateY(-2px);
  }

  .slip.done {
    color: var(--pv-ink-muted);
    text-decoration: line-through;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    text-decoration: none;
  }

  .tag {
    padding: 2px 6px;
    border-radius: var(--pv-radius-xs);
    background: var(--pv-ink-chip);
    color: var(--pv-ink-chip-text);
    font-size: 11px;
    line-height: 1.35;
  }

  .tag.note {
    background: var(--pv-ink-tint);
    color: var(--pv-ink-tint-text);
  }

  .error {
    color: var(--danger);
  }
</style>
