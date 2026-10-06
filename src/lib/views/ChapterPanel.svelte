<script lang="ts">
  import { tick } from "svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import type { NoteHere } from "$lib/chapters/mentions";
  import type { Note, NoteCategory, Task } from "$lib/storage/organize";
  import type { UiKey } from "$lib/i18n";
  import { plural, t } from "$lib/ui.svelte";
  import ChecklistItem from "./ChecklistItem.svelte";
  import NoteMini from "./NoteMini.svelte";

  let {
    chapterLabel,
    title,
    todos,
    notes,
    book,
    showTodos,
    showNotes,
    openNoteId = "",
    addFocus = 0,
    onToggleTodo,
    onAddTodo,
    onShowNote,
    onOpenInNotes,
    onClose,
  }: {
    chapterLabel: string;
    title: string;
    /** The open chapter's to-dos. */
    todos: Task[];
    /** The notes the chapter mentions, most mentioned first. */
    notes: NoteHere[];
    /** Every note in the book, for "From note" lines and the links in a note's text. */
    book: Note[];
    showTodos: boolean;
    showNotes: boolean;
    /** The note shown open; the most mentioned one when empty. */
    openNoteId?: string;
    /** Bumps to put the keyboard in the add field. */
    addFocus?: number;
    onToggleTodo: (task: Task) => void;
    onAddTodo: (text: string) => void;
    onShowNote: (id: string) => void;
    onOpenInNotes: (id: string) => void;
    onClose: () => void;
  } = $props();

  const KINDS: Record<NoteCategory, UiKey> = {
    characters: "kindCharacter",
    places: "kindPlace",
    research: "kindResearch",
    ideas: "kindNote",
  };
  // Doing first, then what is left to do, then what is done.
  const ORDER = { doing: 0, todo: 1, done: 2 } as const;

  let draft = $state("");
  let addInput = $state<HTMLInputElement | undefined>(undefined);
  let seenFocus = 0;

  const ordered = $derived([...todos].sort((a, b) => ORDER[a.todoState] - ORDER[b.todoState]));
  const open = $derived(todos.filter((task) => task.todoState !== "done").length);
  const shown = $derived(notes.find((here) => here.note.id === openNoteId) ?? notes[0]);
  const rest = $derived(notes.filter((here) => here !== shown));

  $effect(() => {
    if (addFocus !== seenFocus) {
      seenFocus = addFocus;
      if (addFocus > 0) void tick().then(() => addInput?.focus());
    }
  });

  function noteTitle(id: string): string {
    return book.find((note) => note.id === id)?.title ?? "";
  }

  function fields(note: Note) {
    return note.fields.filter((field) => field.key.trim() || field.value.trim()).slice(0, 4);
  }

  /** A note's first paragraph, with its [[links]] as pieces that open the linked note. */
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

  function add(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAddTodo(text);
    draft = "";
  }
</script>

<!-- Beside the page in Write: the open chapter's to-dos, on chrome, and the notes it mentions, on a strip of desk. -->
<aside class="panel" aria-label={t("chapterPanel")}>
  <div class="head">
    <span class="faint">{chapterLabel}</span>
    <span class="faint" aria-hidden="true">·</span>
    <span class="name">{title}</span>
    <button type="button" class="close" title={t("closePanel")} aria-label={t("closePanel")} onclick={onClose}>
      <Icon name="x" />
    </button>
  </div>

  {#if showTodos}
    <section class="todos" class:alone={!showNotes}>
      <div class="heading">
        <h3>{t("todos")}</h3>
        <span>{plural("openCount", open)}</span>
      </div>
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
    </section>
  {/if}

  {#if showNotes}
    <section class="notes">
      <div class="heading">
        <h3>{t("notes")}</h3>
        <span>{t("mentionedHere")}</span>
      </div>
      {#if shown}
        {@const note = shown.note}
        <article class="open-note">
          <div class="top">
            <span class="kind">{t(KINDS[note.category])}</span>
            <span class="meta">{shown.count > 0 ? t("timesHere", { n: shown.count }) : t("linkedHere")}</span>
          </div>
          <button type="button" class="title" title={t("openInNotes")} onclick={() => onOpenInNotes(note.id)}>{note.title}</button>
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
        </article>
        {#each rest as here (here.note.id)}
          <NoteMini
            kind={t(KINDS[here.note.category])}
            title={here.note.title}
            meta={here.count > 0 ? t("timesShort", { n: here.count }) : t("linkedHere")}
            onclick={() => onShowNote(here.note.id)}
          />
        {/each}
        <span class="spacer"></span>
        <button type="button" class="more" onclick={() => onOpenInNotes(note.id)}>{t("openInNotes")}</button>
      {:else}
        <p class="empty">{t("noNotesHere")}</p>
      {/if}
    </section>
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

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    height: 44px;
    padding: 0 14px 0 20px;
    border-bottom: 1px solid var(--pv-line);
    font-size: var(--pv-text-md);
  }

  .faint {
    color: var(--pv-text-faint);
    white-space: nowrap;
  }

  .name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    width: 13px;
    height: 13px;
  }

  .close:hover {
    background: var(--pv-selected);
  }

  .close:active {
    background: var(--pv-pressed);
  }

  .todos {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: none;
    max-height: 45%;
    overflow: auto;
    padding: 16px 12px 6px;
    border-bottom: 1px solid var(--pv-line);
  }

  .todos.alone {
    flex: 1;
    max-height: none;
    border-bottom: 0;
  }

  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 6px;
  }

  .heading h3 {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-sm);
    font-weight: 400;
  }

  .heading span {
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
  }

  .add {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
    height: 32px;
    margin: 6px 8px 10px;
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

  .notes {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px 20px;
    background: var(--pv-desk);
  }

  .notes .heading {
    padding: 0;
  }

  .open-note {
    display: flex;
    flex-direction: column;
    gap: 9px;
    flex: none;
    padding: 14px 16px 16px;
    background-color: var(--pv-paper);
    box-shadow: var(--pv-shadow-sheet);
    color: var(--pv-ink);
  }

  :global(:root[data-grain="true"]) .open-note {
    background-image: var(--pv-grain);
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1.5px solid var(--pv-ink-rule-accent);
  }

  .kind {
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--pv-ink-accent);
  }

  .meta {
    font-size: var(--pv-text-sm);
    color: var(--pv-ink-muted);
  }

  .title {
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    font-family: var(--pv-font-heading);
    font-size: 19px;
  }

  .title:hover {
    text-decoration: underline;
    text-decoration-color: var(--pv-ink-link-underline);
  }

  .fields {
    display: grid;
    grid-template-columns: 52px 1fr;
    row-gap: 4px;
    column-gap: 8px;
    margin: 0;
    font-size: var(--pv-text-md);
  }

  .fields dt {
    color: var(--pv-ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fields dd {
    margin: 0;
    min-width: 0;
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
    color: var(--pv-ink-2);
  }

  .link {
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-ink-accent);
    font: inherit;
    text-decoration: underline;
    text-decoration-color: var(--pv-ink-link-underline);
    text-underline-offset: 2px;
  }

  .empty {
    margin: 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-faint);
  }

  .spacer {
    flex: 1;
  }

  .more {
    align-self: flex-start;
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-accent);
    font-size: var(--pv-text-md);
    font-weight: 600;
  }

  .more:hover {
    text-decoration: underline;
  }
</style>
