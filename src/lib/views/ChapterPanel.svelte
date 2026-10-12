<script lang="ts">
  import Icon from "$lib/editor/Icon.svelte";
  import type { Chapter } from "$lib/model";
  import type { Note, Task, TodoState } from "$lib/storage/organize";
  import type { UiKey } from "$lib/i18n";
  import { num, plural, t } from "$lib/ui.svelte";
  import ChecklistItem from "./ChecklistItem.svelte";
  import type { PanelNotes } from "./panelNotes";

  let {
    list,
    todos,
    chapterId,
    chapters,
    todoScope,
    onTodoScope,
    notes,
    book,
    query = $bindable(""),
    onNewNote,
    onOpenNote,
    onToggleTodo,
    onAddTodo,
    onOpenBoard,
    wordsToday = 0,
    dailyGoal = 0,
    chapterWords = 0,
    chapterGoal = 0,
    onDailyGoal,
    onChapterGoal,
    onClose,
  }: {
    /** The one list the panel shows; the toolbar's Notes, To-dos and Goals buttons switch between them. */
    list: "todos" | "notes" | "goals";
    /** Every to-do of the project. */
    todos: Task[];
    /** The chapter on the page, and the writing's chapters, for where a to-do belongs. */
    chapterId: string;
    chapters: Chapter[];
    /** The open chapter's to-dos, or all of the project's (owner, 12 October). */
    todoScope: "chapter" | "all";
    onTodoScope: (scope: "chapter" | "all") => void;
    /** The notes listed: the chapter's and the others, or what a search found. */
    notes: PanelNotes;
    /** Every note in the project, for "From note" lines. */
    book: Note[];
    /** The words the notes are searched for. */
    query?: string;
    onNewNote: () => void;
    /** Shows a note in the panel, to read and write. */
    onOpenNote: (id: string) => void;
    onToggleTodo: (task: Task) => void;
    /** A new to-do: for the chapter or the whole project, as the list shows. */
    onAddTodo: (text: string) => void;
    /** The To-dos view, with its board. */
    onOpenBoard: () => void;
    /** Words written today, and the day's goal (0 for none). */
    wordsToday?: number;
    dailyGoal?: number;
    /** The open chapter's words, and its goal (0 for none). */
    chapterWords?: number;
    chapterGoal?: number;
    onDailyGoal: (goal: number) => void;
    onChapterGoal: (goal: number) => void;
    /** Folds the panel away; the toolbar's buttons bring it back. */
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
  const shown = $derived(todoScope === "chapter" ? todos.filter((task) => task.chapterId === chapterId) : todos);
  const open = $derived(shown.filter((task) => task.todoState !== "done").length);

  function noteTitle(id: string): string {
    return book.find((note) => note.id === id)?.title ?? "";
  }

  /** Under a to-do: its note, and, among all the project's, its chapter or "Whole project". */
  function meta(task: Task): string {
    const note = task.noteId && noteTitle(task.noteId) ? t("fromNote", { title: noteTitle(task.noteId) }) : "";
    if (todoScope === "chapter") return note;
    const index = ordered.findIndex((chapter) => chapter.id === task.chapterId);
    const place = !task.chapterId ? t("wholeProject") : index >= 0 ? `${index + 1} · ${ordered[index].title}` : t("chapter");
    return note ? `${place} · ${note}` : place;
  }

  /** A goal as typed: a whole number of words, where a dot only groups thousands, as in "12.000". */
  function goalFrom(input: HTMLInputElement): number {
    const goal = Number(input.value.replace(/\D/g, "")) || 0;
    // The field shows what was kept, also when that is the goal it had.
    input.value = String(goal);
    return goal;
  }

  function add(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAddTodo(text);
    draft = "";
  }

  /** Enter in the search opens the first note found. */
  function searchKeys(event: KeyboardEvent) {
    if (event.key !== "Enter" || !notes.searching || notes.found.length === 0) return;
    event.preventDefault();
    onOpenNote(notes.found[0].id);
  }
</script>

{#snippet heading(title: string, aside: string, onAdd?: () => void)}
  <div class="heading">
    <h3>{title}</h3>
    {#if aside}<span class="aside">{aside}</span>{/if}
    {#if onAdd}
      <button type="button" class="close" title={t("newNoteTitle")} aria-label={t("newNoteTitle")} onclick={onAdd}>
        <Icon name="plus" />
      </button>
    {/if}
    <button type="button" class="close" title={t("hidePanel")} aria-label={t("hidePanel")} onclick={onClose}>
      <Icon name="panelRightClose" />
    </button>
  </div>
{/snippet}

<!-- One goal: the words so far, a bar toward the goal, and the goal itself to change. -->
{#snippet goal(title: string, words: number, target: number, label: string, onSet: (goal: number) => void)}
  {@const reached = target > 0 && words >= target}
  <section class="goal" class:reached>
    <div class="goal-head">
      <h4>{title}</h4>
      {#if reached}
        <span class="aside">{t("goalReached")}</span>
      {:else if target > 0}
        <span class="aside">{t("percent", { n: Math.floor((words / target) * 100) })}</span>
      {/if}
    </div>
    {#if target > 0}
      <p class="words"><b>{num(words)}</b> {plural("wordsOf", target)}</p>
      <div class="bar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(words, target)}>
        <span style:width="{Math.min(100, (words / target) * 100)}%"></span>
      </div>
    {:else}
      <p class="words"><b>{plural("words", words)}</b></p>
    {/if}
    <label class="target">
      {label}
      <input type="number" min="0" step="50" value={target} onchange={(event) => onSet(goalFrom(event.currentTarget))} />
    </label>
  </section>
{/snippet}

{#snippet noteRow(note: Note, count: number)}
  <button type="button" class="row" onclick={() => onOpenNote(note.id)}>
    <span class="name">{note.title}</span>
    {#if count > 0}<span class="times">{t("timesShort", { n: count })}</span>{/if}
  </button>
{/snippet}

<!-- Beside the page in Write: the notes, the to-dos or the word goals, one at a time. -->
<aside class="panel" aria-label={t("chapterPanel")}>
  {#if list === "todos"}
    {@render heading(t("todos"), plural("openCount", open))}
    <!-- The chapter's to-dos or all of the project's, in one list (owner, 12 October). -->
    <div class="scope" role="tablist" aria-label={t("todos")}>
      <button type="button" role="tab" aria-selected={todoScope === "chapter"} class:on={todoScope === "chapter"} onclick={() => onTodoScope("chapter")}>{t("thisChapter")}</button>
      <button type="button" role="tab" aria-selected={todoScope === "all"} class:on={todoScope === "all"} onclick={() => onTodoScope("all")}>{t("wholeProject")}</button>
    </div>
    <form class="add" onsubmit={add}>
      <span aria-hidden="true">+</span>
      <input
        bind:value={draft}
        placeholder={todoScope === "chapter" ? t("addChapterTodo") : t("addTodoHint")}
        aria-label={todoScope === "chapter" ? t("addChapterTodo") : t("addTodoHint")}
      />
    </form>
    <div class="items">
      {#each GROUPS as group (group.id)}
        {@const items = shown.filter((task) => task.todoState === group.id)}
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
              <ChecklistItem text={task.title} state={task.todoState} meta={meta(task)} onToggle={() => onToggleTodo(task)} />
            {/each}
          {/if}
        {/if}
      {/each}
      {#if shown.length === 0}
        <p class="empty">{t("noTodosYet")}</p>
      {/if}
    </div>
    <button type="button" class="more board" onclick={onOpenBoard}>{t("openTodosView")} →</button>
  {:else if list === "goals"}
    {@render heading(t("wordGoals"), "")}
    <div class="items goals">
      {@render goal(t("today"), wordsToday, dailyGoal, t("dailyGoal"), onDailyGoal)}
      {@render goal(t("thisChapter"), chapterWords, chapterGoal, t("chapterGoal"), onChapterGoal)}
    </div>
  {:else}
    {@render heading(t("notes"), "", onNewNote)}
    <!-- The chapter's notes first, then all the others; a search looks through every note (owner, 12 October). -->
    <label class="search">
      <Icon name="search" />
      <input type="search" bind:value={query} placeholder={t("findNote")} aria-label={t("findNote")} onkeydown={searchKeys} />
    </label>
    <div class="items">
      {#if notes.searching}
        {#each notes.found as note (note.id)}
          {@render noteRow(note, 0)}
        {:else}
          <p class="empty">{t("notFound")}</p>
        {/each}
      {:else}
        {#if notes.here.length > 0}
          <p class="eyebrow">{t("thisChapter")}</p>
          {#each notes.here as here (here.note.id)}
            {@render noteRow(here.note, here.count)}
          {/each}
        {/if}
        {#if notes.others.length > 0}
          <p class="eyebrow">{t("otherNotes")}</p>
          {#each notes.others as note (note.id)}
            {@render noteRow(note, 0)}
          {/each}
        {/if}
        {#if notes.here.length === 0 && notes.others.length === 0}
          <p class="empty">{t("noNotesYet")}</p>
        {/if}
      {/if}
    </div>
  {/if}
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--pv-chrome);
    border-left: 1px solid var(--pv-line);
  }

  .heading {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
    padding: 16px 14px 10px 20px;
  }

  .heading h3 {
    flex: 1;
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-sm);
    font-weight: 400;
  }

  .aside {
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
  }

  .heading .aside {
    margin-right: 4px;
  }

  .close {
    display: flex;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 3px;
    background: transparent;
    color: var(--pv-text-subtle);
  }

  .close :global(svg) {
    width: 15px;
    height: 15px;
  }

  .close:hover {
    background: var(--pv-selected);
  }

  .close:active {
    background: var(--pv-pressed);
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 12px 16px;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    height: 32px;
    margin: 0 12px 8px 20px;
    padding: 0 10px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text-faint);
  }

  .search:focus-within {
    border-color: var(--pv-accent);
  }

  .search :global(svg) {
    flex: none;
    width: 14px;
    height: 14px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text);
    font-size: var(--pv-text-md);
    outline: none;
  }

  .scope {
    display: flex;
    gap: 2px;
    flex: none;
    margin: 0 12px 6px 20px;
    padding: 2px;
    border-radius: var(--pv-radius-sm);
    background: var(--pv-line);
  }

  .scope button {
    flex: 1;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 4px 8px;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: var(--pv-text-md);
  }

  .scope button.on {
    background: var(--pv-chrome);
    color: var(--pv-text);
    font-weight: 600;
    box-shadow: var(--pv-shadow-field);
  }

  .add {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
    height: 32px;
    margin: 4px 12px 8px 20px;
    padding: 0 10px;
    border: 1px dashed var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    font-size: var(--pv-text-md);
  }

  .add:focus-within {
    border-color: var(--pv-accent);
  }

  .add span {
    color: var(--pv-accent);
    font-size: 16px;
    line-height: 1;
  }

  .add input {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text);
    font: inherit;
    outline: none;
  }

  .eyebrow {
    margin: 12px 8px 4px;
    font-size: var(--pv-text-xs);
    font-weight: 600;
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
    color: var(--pv-text-faint);
  }

  .eyebrow span {
    margin-left: 4px;
    font-weight: 400;
  }

  .fold {
    display: block;
    flex: none;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 3px 6px;
    margin-left: 2px;
    background: transparent;
    text-align: left;
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

  /* A note is one line: its name, and how often the chapter mentions it. */
  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex: none;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 7px 8px;
    background: transparent;
    color: var(--pv-text);
    font-size: var(--pv-text-md);
    text-align: left;
  }

  .row:hover {
    background: var(--pv-selected);
  }

  .row:active {
    background: var(--pv-pressed);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .times {
    flex: none;
    font-size: var(--pv-text-sm);
    font-weight: 400;
    color: var(--pv-text-faint);
  }

  .more {
    align-self: flex-start;
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-accent);
    font-size: var(--pv-text-sm);
    font-weight: 600;
  }

  .more:hover {
    text-decoration: underline;
  }

  .board {
    flex: none;
    margin: 4px 20px 16px;
  }

  .empty {
    margin: 0;
    padding: 4px 8px;
    font-size: var(--pv-text-md);
    color: var(--pv-text-faint);
  }

  .goals {
    gap: 22px;
    padding-top: 4px;
  }

  .goal {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: none;
    padding: 0 8px;
  }

  .goal-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .goal h4 {
    flex: 1;
    margin: 0;
    font-size: var(--pv-text-xs);
    font-weight: 600;
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
    color: var(--pv-text-faint);
  }

  .goal.reached .aside {
    color: var(--pv-status-final);
    font-weight: 600;
  }

  .words {
    margin: 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-muted);
  }

  .words b {
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-sm);
    font-weight: 400;
    color: var(--pv-text);
  }

  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--pv-line);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--pv-accent);
    transition: width var(--pv-dur) var(--pv-ease);
  }

  .goal.reached .bar span {
    background: var(--pv-status-final);
  }

  .target {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--pv-text-md);
    color: var(--pv-text-muted);
  }

  .target input {
    width: 84px;
    margin-left: auto;
    padding: 4px 8px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    text-align: right;
  }
</style>
