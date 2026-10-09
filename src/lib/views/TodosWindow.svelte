<script lang="ts">
  import type { Chapter } from "$lib/model";
  import type { Note, Task, TodoState } from "$lib/storage/organize";
  import type { UiKey } from "$lib/i18n";
  import { t } from "$lib/ui.svelte";
  import ChecklistItem from "./ChecklistItem.svelte";
  import Modal from "./Modal.svelte";

  let {
    tasks,
    notes,
    chapters,
    docked = false,
    onPin,
    onUnpin,
    onToggle,
    onAdd,
    onOpenTodos,
    onClose,
  }: {
    /** The project's to-dos. */
    tasks: Task[];
    /** The project's notes, for "From note" lines. */
    notes: Note[];
    chapters: Chapter[];
    /** Pinned in the panel beside the page, to write with it open. */
    docked?: boolean;
    onPin?: () => void;
    onUnpin?: () => void;
    onToggle: (task: Task) => void;
    /** A new to-do for the whole project. */
    onAdd: (title: string) => void;
    /** The To-dos view, with its board and filters. */
    onOpenTodos: () => void;
    onClose: () => void;
  } = $props();

  const GROUPS: { id: TodoState; key: UiKey }[] = [
    { id: "doing", key: "columnDoing" },
    { id: "todo", key: "columnTodo" },
    { id: "done", key: "columnDone" },
  ];

  let draft = $state("");
  // What is done stays folded away until she asks for it.
  let showDone = $state(false);

  const ordered = $derived([...chapters].sort((a, b) => a.position - b.position));

  function where(task: Task): string {
    const index = ordered.findIndex((chapter) => chapter.id === task.chapterId);
    const place = index < 0 ? t("wholeProject") : `${index + 1} · ${ordered[index].title}`;
    const note = task.noteId ? notes.find((item) => item.id === task.noteId)?.title : "";
    return note ? `${place} · ${t("fromNote", { title: note })}` : place;
  }

  function add(event: SubmitEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    draft = "";
  }
</script>

<!-- The project's to-dos opened while writing (owner, 9 October), ticked off here; the board is a click away. -->
<Modal title={t("todos")} size="small" {docked} {onClose} {onPin} {onUnpin}>
  <div class="todos" class:docked>
    <form class="add" onsubmit={add}>
      <span aria-hidden="true">+</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={draft} placeholder={t("addTodoHint")} aria-label={t("addTodo")} autofocus={!docked} />
      {#if !docked}<span class="hint">{t("enterToAdd")}</span>{/if}
    </form>
    {#each GROUPS as group (group.id)}
      {@const items = tasks.filter((task) => task.todoState === group.id)}
      {#if items.length > 0}
        {#if group.id === "done"}
          <button type="button" class="eyebrow fold" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
            {t(group.key)} <span>{items.length}</span>
          </button>
        {:else}
          <p class="eyebrow">{t(group.key)} <span>{items.length}</span></p>
        {/if}
        {#if group.id !== "done" || showDone}
          {#each items as task (task.id)}
            <ChecklistItem text={task.title} state={task.todoState} meta={where(task)} flush onToggle={() => onToggle(task)} />
          {/each}
        {/if}
      {/if}
    {/each}
    {#if tasks.length === 0}
      <p class="none">{t("noTodosYet")}</p>
    {/if}
  </div>
  {#snippet foot()}
    <button type="button" onclick={onOpenTodos}>{t("openTodosView")}</button>
    <button type="button" class="primary" onclick={onClose}>{t("done")}</button>
  {/snippet}
</Modal>

<style>
  .todos {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px 24px 20px;
  }

  .todos.docked {
    padding: 12px 14px 16px;
  }

  .add {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    margin-bottom: 8px;
    padding: 0 12px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
    color: var(--pv-text-faint);
  }

  .add input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--pv-text);
    font-size: var(--pv-text-base);
  }

  .add input:focus {
    outline: none;
  }

  .add:focus-within {
    outline: 2px solid var(--pv-accent);
    outline-offset: 1px;
  }

  .hint {
    font-size: var(--pv-text-sm);
  }

  .eyebrow {
    margin: 14px 0 2px;
    font-size: var(--pv-text-xs);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--pv-text-faint);
  }

  .eyebrow span {
    margin-left: 4px;
    font-weight: 400;
  }

  .fold {
    display: block;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 3px 6px;
    margin-left: -6px;
    background: transparent;
  }

  .fold::before {
    content: "▸ ";
  }

  .fold[aria-expanded="true"]::before {
    content: "▾ ";
  }

  .fold:hover {
    background: var(--pv-selected);
  }

  .none {
    margin: 18px 0 0;
    color: var(--pv-text-muted);
  }
</style>
