<script lang="ts">
  import { tick } from "svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import type { NoteHere } from "$lib/chapters/mentions";
  import type { Note, Task } from "$lib/storage/organize";
  import { num, plural, t } from "$lib/ui.svelte";
  import ChecklistItem from "./ChecklistItem.svelte";

  let {
    list,
    todos,
    notes,
    book,
    openNoteId = "",
    addFocus = 0,
    onAddFocused,
    onToggleTodo,
    onAddTodo,
    onShowNote,
    onOpenInNotes,
    wordsToday = 0,
    dailyGoal = 0,
    chapterWords = 0,
    chapterGoal = 0,
    onDailyGoal,
    onChapterGoal,
    onClose,
  }: {
    /** The one list the panel shows; the toolbar's To-dos, Notes and Goals buttons switch between them. */
    list: "todos" | "notes" | "goals";
    /** The open chapter's to-dos. */
    todos: Task[];
    /** The notes the chapter mentions, most mentioned first. */
    notes: NoteHere[];
    /** Every note in the book, for "From note" lines and the links in a note's text. */
    book: Note[];
    /** The note unfolded in the list, or "" when none is. */
    openNoteId?: string;
    /** Above 0, the keyboard goes to the add field; then onAddFocused, so it happens once. */
    addFocus?: number;
    onAddFocused?: () => void;
    onToggleTodo: (task: Task) => void;
    onAddTodo: (text: string) => void;
    /** Unfolds a note in the list; "" folds it again. */
    onShowNote: (id: string) => void;
    onOpenInNotes: (id: string) => void;
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

  // Doing first, then what is left to do, then what is done.
  const ORDER = { doing: 0, todo: 1, done: 2 } as const;

  let draft = $state("");
  let addInput = $state<HTMLInputElement | undefined>(undefined);

  const ordered = $derived([...todos].sort((a, b) => ORDER[a.todoState] - ORDER[b.todoState]));
  const open = $derived(todos.filter((task) => task.todoState !== "done").length);

  $effect(() => {
    if (addFocus <= 0) return;
    void tick().then(() => {
      addInput?.focus();
      onAddFocused?.();
    });
  });

  function noteTitle(id: string): string {
    return book.find((note) => note.id === id)?.title ?? "";
  }

  function fields(note: Note) {
    return note.fields.filter((field) => field.key.trim() || field.value.trim()).slice(0, 4);
  }

  /** A note's first paragraph, with its [[links]] as pieces that unfold the linked note. */
  function pieces(text: string): { text: string; link?: Note }[] {
    const first = text.trim().split(/\n\s*\n/)[0] ?? "";
    return first
      .split(/(\[\[[^\]\n]+\]\])/)
      .filter(Boolean)
      .map((part) => {
        const match = /^\[\[([^\]\n]+)\]\]$/.exec(part);
        if (!match) return { text: part };
        const name = match[1].trim();
        return { text: name, link: book.find((note) => note.title.trim().toLowerCase() === name.toLowerCase()) };
      });
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
</script>

{#snippet heading(title: string, aside: string)}
  <div class="heading">
    <h3>{title}</h3>
    {#if aside}<span class="aside">{aside}</span>{/if}
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

<!-- Beside the page in Write: one list at a time, the open chapter's to-dos, the notes it mentions or the word goals. -->
<aside class="panel" aria-label={t("chapterPanel")}>
  {#if list === "todos"}
    {@render heading(t("todos"), plural("openCount", open))}
    <div class="items">
      {#each ordered as task (task.id)}
        <ChecklistItem
          text={task.title}
          state={task.todoState}
          meta={task.noteId && noteTitle(task.noteId) ? t("fromNote", { title: noteTitle(task.noteId) }) : ""}
          onToggle={() => onToggleTodo(task)}
        />
      {/each}
      <form class="add" onsubmit={add}>
        <span aria-hidden="true">+</span>
        <input bind:this={addInput} bind:value={draft} placeholder={t("addChapterTodo")} aria-label={t("addChapterTodo")} />
      </form>
    </div>
  {:else if list === "goals"}
    {@render heading(t("wordGoals"), "")}
    <div class="items goals">
      {@render goal(t("today"), wordsToday, dailyGoal, t("dailyGoal"), onDailyGoal)}
      {@render goal(t("thisChapter"), chapterWords, chapterGoal, t("chapterGoal"), onChapterGoal)}
    </div>
  {:else}
    {@render heading(t("notes"), "")}
    <div class="items">
      {#each notes as here (here.note.id)}
        {@const note = here.note}
        {@const unfolded = note.id === openNoteId}
        <button type="button" class="row" aria-expanded={unfolded} onclick={() => onShowNote(unfolded ? "" : note.id)}>
          <span class="name">{note.title}</span>
          {#if here.count > 0}<span class="times">{t("timesShort", { n: here.count })}</span>{/if}
        </button>
        {#if unfolded}
          <div class="details">
            {#if fields(note).length > 0}
              <dl class="fields">
                {#each fields(note) as field, index (index)}
                  <dt>{field.key}</dt>
                  <dd>{field.value}</dd>
                {/each}
              </dl>
            {/if}
            {#if note.plainText.trim()}
              <p class="body">{#each pieces(note.plainText) as piece, index (index)}{#if piece.link}{@const target = piece.link}<button type="button" class="link" onclick={() => onShowNote(target.id)}>{piece.text}</button>{:else}{piece.text}{/if}{/each}</p>
            {/if}
            <button type="button" class="more" onclick={() => onOpenInNotes(note.id)}>{t("openInNotes")}</button>
          </div>
        {/if}
      {:else}
        <p class="empty">{t("noNotesHere")}</p>
      {/each}
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
    gap: 8px;
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

  .add {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
    height: 32px;
    margin: 6px 8px 0;
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

  .row[aria-expanded="true"] {
    font-weight: 600;
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

  .details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: none;
    padding: 2px 8px 12px;
  }

  .fields {
    display: grid;
    grid-template-columns: 56px 1fr;
    row-gap: 4px;
    column-gap: 8px;
    margin: 0;
    font-size: var(--pv-text-md);
  }

  .fields dt {
    color: var(--pv-text-faint);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fields dd {
    margin: 0;
    min-width: 0;
    color: var(--pv-text-2);
  }

  .body {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    overflow: hidden;
    margin: 0;
    font-family: var(--pv-font-manuscript);
    font-size: 13px;
    line-height: 1.6;
    color: var(--pv-text-2);
  }

  .link {
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-accent);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
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

  .empty {
    margin: 0;
    padding: 0 8px;
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
