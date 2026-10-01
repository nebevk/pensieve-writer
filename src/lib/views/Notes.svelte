<script lang="ts">
  import { onMount } from "svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import type { Chapter, DocumentJson } from "$lib/model";
  import { emptyDocument } from "$lib/model";
  import {
    deleteNote,
    listNotes,
    saveNote,
    type Note,
    type NoteCategory,
    type TodoState,
  } from "$lib/storage/organize";

  let { projectId, chapters }: { projectId: string; chapters: Chapter[] } = $props();

  let notes = $state<Note[]>([]);
  let activeId = $state<string | null>(null);
  let message = $state("");
  let timer: ReturnType<typeof setTimeout> | null = null;

  const active = $derived(notes.find((note) => note.id === activeId) ?? null);

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    try {
      notes = await listNotes(projectId);
      if (!activeId) activeId = notes[0]?.id ?? null;
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not load notes";
    }
  }

  function schedule(note: Note) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void saveNote(note).catch((error) => {
        message = error instanceof Error ? error.message : "Could not save the note";
      });
    }, 800);
  }

  function updateActive(patch: Partial<Note>) {
    if (!active) return;
    const next = { ...active, ...patch, updatedAt: new Date().toISOString() };
    notes = notes.map((note) => (note.id === next.id ? next : note));
    schedule(next);
  }

  async function create() {
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      projectId,
      title: "New note",
      contentJson: emptyDocument(),
      plainText: "",
      category: "ideas",
      tags: "",
      todoState: null,
      chapterIds: [],
      createdAt: now,
      updatedAt: now,
    };
    notes = [note, ...notes];
    activeId = note.id;
    try {
      await saveNote(note);
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not create the note";
    }
  }

  async function remove(id: string) {
    try {
      await deleteNote(id);
      notes = notes.filter((note) => note.id !== id);
      if (activeId === id) activeId = notes[0]?.id ?? null;
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not delete the note";
    }
  }

  function toggleChapter(chapterId: string) {
    if (!active) return;
    const chapterIds = active.chapterIds.includes(chapterId)
      ? active.chapterIds.filter((id) => id !== chapterId)
      : [...active.chapterIds, chapterId];
    updateActive({ chapterIds });
  }
</script>

<section class="notes">
  <aside>
    <div class="head">
      <h2>Notes</h2>
      <button type="button" onclick={() => void create()}>New</button>
    </div>
    <ul>
      {#each notes as note (note.id)}
        <li>
          <button type="button" class:active={note.id === activeId} onclick={() => (activeId = note.id)}>
            {note.title}
          </button>
        </li>
      {/each}
    </ul>
  </aside>
  <div class="editor">
    {#if active}
      {@const note = active}
      <input
        class="title"
        aria-label="Note title"
        value={note.title}
        oninput={(event) => updateActive({ title: (event.currentTarget as HTMLInputElement).value })}
      />
      <div class="meta">
        <label>
          Category
          <select
            value={note.category}
            onchange={(event) =>
              updateActive({
                category: (event.currentTarget as HTMLSelectElement).value as NoteCategory,
              })}
          >
            <option value="ideas">Ideas</option>
            <option value="characters">Characters</option>
            <option value="places">Places</option>
            <option value="research">Research</option>
          </select>
        </label>
        <label>
          Tags
          <input
            value={note.tags}
            placeholder="comma, separated"
            oninput={(event) => updateActive({ tags: (event.currentTarget as HTMLInputElement).value })}
          />
        </label>
        <label>
          Todo
          <select
            value={note.todoState ?? ""}
            onchange={(event) => {
              const value = (event.currentTarget as HTMLSelectElement).value;
              updateActive({ todoState: value === "" ? null : (value as TodoState) });
            }}
          >
            <option value="">None</option>
            <option value="todo">Todo</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
          </select>
        </label>
        <button type="button" onclick={() => void remove(note.id)}>Delete note</button>
      </div>
      <fieldset>
        <legend>Linked chapters</legend>
        {#each chapters as chapter (chapter.id)}
          <label>
            <input
              type="checkbox"
              checked={note.chapterIds.includes(chapter.id)}
              onchange={() => toggleChapter(chapter.id)}
            />
            {chapter.title}
          </label>
        {/each}
      </fieldset>
      {#key note.id}
        <div class="paper">
          <Editor
            initialContent={note.contentJson}
            onChange={(json: DocumentJson, text: string) => updateActive({ contentJson: json, plainText: text })}
            onEditor={() => {}}
            onActivity={() => {}}
          />
        </div>
      {/key}
    {:else}
      <p class="quiet">Create a note for a character, place, or idea.</p>
    {/if}
    {#if message}
      <p class="error" role="alert">{message}</p>
    {/if}
  </div>
</section>

<style>
  .notes {
    display: grid;
    grid-template-columns: 15rem 1fr;
    height: 100%;
    min-height: 0;
  }

  aside {
    background: var(--sidebar);
    border-right: 1px solid var(--line);
    overflow: auto;
  }

  .head,
  .meta,
  fieldset {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .head {
    justify-content: space-between;
    padding: 0.85rem 0.75rem 0.4rem;
  }

  h2 {
    margin: 0;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
  }

  li button {
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    border-radius: 6px;
    padding: 0.45rem 0.6rem;
  }

  li button.active {
    background: var(--paper);
  }

  .editor {
    overflow: auto;
    padding: 1rem 1.25rem 2rem;
  }

  .title {
    width: min(44rem, 100%);
    border: 0;
    background: transparent;
    font-family: var(--font-writing);
    font-size: 1.6rem;
    margin-bottom: 0.6rem;
  }

  .meta,
  fieldset {
    margin-bottom: 0.8rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  fieldset {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.5rem 0.7rem;
  }

  .paper {
    width: min(var(--column), 100%);
    background: var(--paper);
  }

  button,
  select,
  input {
    font: inherit;
  }

  .meta button,
  .head button {
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 0.2rem 0.45rem;
  }

  .quiet,
  .error {
    color: var(--muted);
  }

  .error {
    color: var(--danger);
  }
</style>
