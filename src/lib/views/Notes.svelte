<script lang="ts">
  import { onMount } from "svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import type { Chapter, DocumentJson } from "$lib/model";
  import { emptyDocument } from "$lib/model";
  import {
    deleteNote,
    flushNoteSave,
    listNotes,
    listTasks,
    saveNote,
    saveTask,
    scheduleNoteSave,
    watchNoteSaves,
    type Note,
    type NoteCategory,
    type NoteField,
    type Task,
    type TodoState,
  } from "$lib/storage/organize";
  import { snapshotSavedProject } from "$lib/storage/sqlite";
  import type { UiKey } from "$lib/i18n";
  import { ago, t } from "$lib/ui.svelte";
  import type { NoteTarget } from "$lib/editor/noteLinks";

  let {
    projectId,
    chapters,
    compact = false,
    language = "en",
    focusChapterId = "",
    onSaveError,
    onShowTodos,
    createRequest = 0,
    openRequest = null,
  }: {
    projectId: string;
    chapters: Chapter[];
    compact?: boolean;
    language?: "en" | "sl";
    focusChapterId?: string;
    onSaveError?: (message: string) => void;
    onShowTodos?: () => void;
    createRequest?: number;
    /** A note to open, from a link clicked in the manuscript. */
    openRequest?: (NoteTarget & { at: number }) | null;
  } = $props();

  let notes = $state<Note[]>([]);
  let tasks = $state<Task[]>([]);
  let activeId = $state<string | null>(null);
  let query = $state("");
  let message = $state("");
  let confirmDelete = $state<string | null>(null);
  let seenRequest = 0;
  let seenOpen = 0;
  let loaded = $state(false);

  const orderedChapters = $derived([...chapters].sort((a, b) => a.position - b.position));
  const active = $derived(notes.find((note) => note.id === activeId) ?? null);
  const openTodos = $derived(tasks.filter((task) => task.todoState !== "done").length + notes.filter((note) => note.todoState && note.todoState !== "done").length);
  const noteTodos = $derived(active ? tasks.filter((task) => task.noteId === active.id) : []);

  const groups: { id: NoteCategory; key: UiKey }[] = [
    { id: "characters", key: "groupCharacters" },
    { id: "places", key: "groupPlaces" },
    { id: "research", key: "groupResearch" },
    { id: "ideas", key: "groupIdeas" },
  ];

  function subtitle(note: Note): string {
    return note.tags.trim() || note.fields.find((field) => field.value.trim())?.value || "";
  }

  function matches(note: Note): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      note.title.toLowerCase().includes(needle) ||
      note.tags.toLowerCase().includes(needle) ||
      note.plainText.toLowerCase().includes(needle)
    );
  }

  function edited(iso: string): string {
    return t("editedAgo", { ago: ago(iso) });
  }

  function mentions(text: string, title: string): number {
    const needle = title.trim().toLowerCase();
    if (needle.length < 2) return 0;
    let count = 0;
    let from = 0;
    const haystack = text.toLowerCase();
    while (from < haystack.length) {
      const index = haystack.indexOf(needle, from);
      if (index === -1) break;
      count += 1;
      from = index + needle.length;
    }
    return count;
  }

  /** How many passages of a chapter are linked to the note with "Link a note". */
  function linksTo(doc: DocumentJson, noteId: string): number {
    let count = 0;
    const walk = (node: { marks?: { type?: string; attrs?: { noteId?: string } }[]; content?: unknown[] }) => {
      if (node.marks?.some((mark) => mark.type === "noteLink" && mark.attrs?.noteId === noteId)) count += 1;
      for (const child of node.content ?? []) walk(child as typeof node);
    };
    walk(doc as Parameters<typeof walk>[0]);
    return count;
  }

  const appears = $derived.by(() => {
    if (!active) return [];
    return orderedChapters.flatMap((chapter, index) => {
      const links = linksTo(chapter.contentJson, active.id);
      const count = Math.max(mentions(chapter.plainText, active.title), links);
      const linked = active.chapterIds.includes(chapter.id) || links > 0;
      if (!linked && count === 0) return [];
      return [{ id: chapter.id, label: `${index + 1} · ${chapter.title}`, count }];
    });
  });

  const linkedNotes = $derived.by(() => {
    if (!active) return [];
    const titles = [...active.plainText.matchAll(/\[\[(.+?)\]\]/g)].map((match) => match[1].trim());
    return [...new Set(titles)].flatMap((title) => {
      const note = notes.find((item) => item.title.toLowerCase() === title.toLowerCase());
      return note ? [note] : [];
    });
  });

  const backlinks = $derived.by(() => {
    if (!active) return [];
    const title = active.title.trim().toLowerCase();
    if (title.length < 2) return [];
    return notes.filter((note) => {
      if (note.id === active.id) return false;
      return [...note.plainText.matchAll(/\[\[(.+?)\]\]/g)].some((match) => match[1].trim().toLowerCase() === title);
    });
  });

  onMount(() => {
    watchNoteSaves((text) => {
      message = text;
      onSaveError?.(text);
    });
    void refresh();
    return () => {
      void flushNoteSave().catch(() => undefined);
    };
  });

  $effect(() => {
    if (createRequest !== seenRequest) {
      seenRequest = createRequest;
      if (createRequest > 0) void create();
    }
  });

  $effect(() => {
    // Wait for the notes to load, then open the one the manuscript link points to.
    if (!openRequest || openRequest.at === seenOpen || !loaded) return;
    seenOpen = openRequest.at;
    openLinked(openRequest, false);
  });

  /**
   * Opens the note a link points to: by id when the link carries one, otherwise by title. A [[link]]
   * in a note to a note that doesn't exist yet creates it, as in a wiki.
   */
  function openLinked(target: NoteTarget, createMissing: boolean) {
    const title = target.title.trim();
    const found =
      (target.id ? notes.find((note) => note.id === target.id) : undefined) ??
      notes.find((note) => note.title.trim().toLowerCase() === title.toLowerCase());
    if (found) activeId = found.id;
    else if (createMissing && title) void create(title);
  }

  async function refresh() {
    try {
      [notes, tasks] = await Promise.all([listNotes(projectId), listTasks(projectId)]);
      if (!activeId) activeId = notes[0]?.id ?? null;
      loaded = true;
    } catch (error) {
      message = error instanceof Error ? error.message : t("notesLoadFailed");
    }
  }

  function schedule(note: Note) {
    scheduleNoteSave(note);
  }

  function updateNote(id: string, patch: Partial<Note>) {
    const current = notes.find((note) => note.id === id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    notes = notes.map((note) => (note.id === id ? next : note));
    schedule(next);
  }

  function updateActive(patch: Partial<Note>) {
    if (active) updateNote(active.id, patch);
  }

  function updateField(index: number, patch: Partial<NoteField>) {
    if (!active) return;
    const fields = active.fields.map((field, item) => (item === index ? { ...field, ...patch } : field));
    updateActive({ fields });
  }

  async function create(title = "") {
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      projectId,
      title: title || t("newNoteTitle"),
      contentJson: emptyDocument(),
      plainText: "",
      category: "characters",
      tags: "",
      fields: [],
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
      message = error instanceof Error ? error.message : t("noteCreateFailed");
    }
  }

  async function remove(id: string) {
    confirmDelete = null;
    try {
      // Keep a snapshot with the note in it, so a mistaken delete can be undone from Home.
      await flushNoteSave();
      await snapshotSavedProject(projectId);
      await deleteNote(id);
      notes = notes.filter((note) => note.id !== id);
      tasks = tasks.filter((task) => task.noteId !== id);
      if (activeId === id) activeId = notes[0]?.id ?? null;
    } catch (error) {
      message = error instanceof Error ? error.message : t("noteDeleteFailed");
    }
  }

  function toggleChapter(chapterId: string) {
    if (!active) return;
    const chapterIds = active.chapterIds.includes(chapterId)
      ? active.chapterIds.filter((id) => id !== chapterId)
      : [...active.chapterIds, chapterId];
    updateActive({ chapterIds });
  }

  function nextState(state: TodoState): TodoState {
    if (state === "todo") return "doing";
    if (state === "doing") return "done";
    return "todo";
  }

  async function cycleTask(task: Task) {
    const next = { ...task, todoState: nextState(task.todoState), updatedAt: new Date().toISOString() };
    tasks = tasks.map((item) => (item.id === next.id ? next : item));
    try {
      await saveTask(next);
    } catch (error) {
      message = error instanceof Error ? error.message : t("todoUpdateFailed");
    }
  }

  /** "3 · Grandmother's Keys" for a to-do's chapter, or nothing when it belongs to the whole book. */
  function chapterLabel(chapterId: string): string {
    const index = orderedChapters.findIndex((chapter) => chapter.id === chapterId);
    return index < 0 ? "" : `${index + 1} · ${orderedChapters[index].title}`;
  }

  async function addNoteTodo(title: string, chapterId = "") {
    if (!active) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title,
      todoState: "todo",
      updatedAt: new Date().toISOString(),
      chapterId,
      noteId: active.id,
    };
    tasks = [task, ...tasks];
    try {
      await saveTask(task);
    } catch (error) {
      message = error instanceof Error ? error.message : t("todoAddFailed");
    }
  }
</script>

<section class="notes" class:compact>
  <aside>
    <div class="switch" role="tablist" aria-label={t("notesOrTodos")}>
      <button type="button" class="on" role="tab" aria-selected="true">{t("notes")} <span>{notes.length}</span></button>
      <button type="button" role="tab" onclick={() => onShowTodos?.()}>{t("todos")} <span>{openTodos}</span></button>
    </div>
    <label class="search">
      <Icon name="search" />
      <input placeholder={t("searchNotes")} aria-label={t("searchNotes")} bind:value={query} />
    </label>
    <div class="list">
      {#each groups as group (group.id)}
        {@const items = notes
          .filter((note) => note.category === group.id && matches(note))
          .sort((a, b) => {
            if (!focusChapterId) return 0;
            const aHit = a.chapterIds.includes(focusChapterId) ? 0 : 1;
            const bHit = b.chapterIds.includes(focusChapterId) ? 0 : 1;
            return aHit - bHit;
          })}
        {#if items.length > 0}
          <p class="eyebrow">{t(group.key)}</p>
          {#each items as note (note.id)}
            <button type="button" class="row" class:active={note.id === activeId} onclick={() => (activeId = note.id)}>
              <span class="name">{note.title}</span>
              {#if focusChapterId && note.chapterIds.includes(focusChapterId)}
                <span class="sub">{t("thisChapter")}</span>
              {/if}
              {#if subtitle(note)}
                <span class="sub">{subtitle(note)}</span>
              {/if}
            </button>
          {/each}
        {/if}
      {/each}
    </div>
    <button type="button" class="add" onclick={() => void create()}>{t("newNoteButton")}</button>
  </aside>

  <div class="desk">
    {#if active}
      {@const note = active}
      <article class="card">
        <header>
          <select
            aria-label={t("noteKind")}
            value={note.category}
            onchange={(event) =>
              updateActive({ category: (event.currentTarget as HTMLSelectElement).value as NoteCategory })}
          >
            <option value="characters">{t("kindCharacter")}</option>
            <option value="places">{t("kindPlace")}</option>
            <option value="research">{t("kindResearch")}</option>
            <option value="ideas">{t("kindNote")}</option>
          </select>
          <span>{edited(note.updatedAt)}</span>
        </header>
        <input
          class="title"
          aria-label={t("noteTitle")}
          value={note.title}
          oninput={(event) => updateActive({ title: (event.currentTarget as HTMLInputElement).value })}
        />
        <input
          class="tags"
          aria-label={t("shortDescription")}
          placeholder={t("shortDescriptionHint")}
          value={note.tags}
          oninput={(event) => updateActive({ tags: (event.currentTarget as HTMLInputElement).value })}
        />
        <div class="fields">
          {#each note.fields as field, index (index)}
            <input
              aria-label={t("fieldName")}
              value={field.key}
              placeholder={t("fieldNameHint")}
              oninput={(event) => updateField(index, { key: (event.currentTarget as HTMLInputElement).value })}
            />
            <input
              aria-label={t("fieldValue")}
              value={field.value}
              placeholder="34"
              oninput={(event) => updateField(index, { value: (event.currentTarget as HTMLInputElement).value })}
            />
          {/each}
          <button type="button" class="text" onclick={() => updateActive({ fields: [...note.fields, { key: "", value: "" }] })}>
            {t("addField")}
          </button>
        </div>
        {#key note.id}
          <Editor
            docId={note.id}
            initialContent={note.contentJson}
            {language}
            onChange={(json: DocumentJson, text: string, id?: string) =>
              id ? updateNote(id, { contentJson: json, plainText: text }) : updateActive({ contentJson: json, plainText: text })}
            onEditor={() => {}}
            onActivity={() => {}}
            noteLinkBrackets
            plain
            onOpenNote={(target) => openLinked(target, true)}
          />
        {/key}
        <div class="todos">
          <p class="eyebrow">{t("todos")}</p>
          {#each noteTodos as task (task.id)}
            <button type="button" class="todo" class:done={task.todoState === "done"} onclick={() => void cycleTask(task)}>
              <span class="box" class:doing={task.todoState === "doing"} class:done={task.todoState === "done"}>
                {#if task.todoState === "done"}
                  <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.6 6.3 5 8.6l4.4-5" /></svg>
                {/if}
              </span>
              <span class="todo-text">
                <span>{task.title}</span>
                {#if chapterLabel(task.chapterId)}
                  <span class="meta">{chapterLabel(task.chapterId)}</span>
                {/if}
              </span>
            </button>
          {/each}
          <form
            class="add-todo"
            onsubmit={(event) => {
              event.preventDefault();
              const fields = event.currentTarget.elements;
              const input = fields.namedItem("todo");
              const chapter = fields.namedItem("chapter");
              if (!(input instanceof HTMLInputElement)) return;
              const title = input.value.trim();
              if (!title) return;
              input.value = "";
              void addNoteTodo(title, chapter instanceof HTMLSelectElement ? chapter.value : "");
            }}
          >
            <input name="todo" placeholder={t("addTodoHint")} aria-label={t("addTodo")} />
            <!-- A to-do written on a character can belong to one chapter, as on the design's card. -->
            <select name="chapter" aria-label={t("chapter")} value={focusChapterId}>
              <option value="">{t("wholeBook")}</option>
              {#each orderedChapters as chapter, index (chapter.id)}
                <option value={chapter.id}>{index + 1} · {chapter.title}</option>
              {/each}
            </select>
          </form>
        </div>
        <div class="chapters">
          <p class="eyebrow">{t("linkedChapters")}</p>
          {#each orderedChapters as chapter (chapter.id)}
            <label>
              <input type="checkbox" checked={note.chapterIds.includes(chapter.id)} onchange={() => toggleChapter(chapter.id)} />
              {chapter.title}
            </label>
          {/each}
        </div>
        {#if confirmDelete === note.id}
          <div class="confirm" role="alertdialog" aria-label={t("deleteNote")}>
            <p>{t("deleteNoteQuestion", { title: note.title })}</p>
            <button type="button" class="danger" onclick={() => void remove(note.id)}>{t("delete")}</button>
            <button type="button" class="text" onclick={() => (confirmDelete = null)}>{t("cancel")}</button>
          </div>
        {:else}
          <button type="button" class="danger" onclick={() => (confirmDelete = note.id)}>{t("deleteNote")}</button>
        {/if}
      </article>
    {:else}
      <p class="quiet">{t("noNoteYet")}</p>
    {/if}
    {#if message}
      <p class="error" role="alert">{message}</p>
    {/if}
  </div>

  {#if !compact && active}
    <aside class="context">
      {#if appears.length > 0}
        <p class="eyebrow">{t("appearsIn")}</p>
        <ul>
          {#each appears as item (item.id)}
            <li><span>{item.label}</span><span>{item.count ? `${item.count}×` : t("linked")}</span></li>
          {/each}
        </ul>
      {/if}
      {#if linkedNotes.length > 0}
        <p class="eyebrow">{t("linkedNotes")}</p>
        <ul>
          {#each linkedNotes as link (link.id)}
            <li>
              <button type="button" onclick={() => (activeId = link.id)}>{link.title}</button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if backlinks.length > 0}
        <p class="eyebrow">{t("linkedFrom")}</p>
        <ul>
          {#each backlinks as link (link.id)}
            <li>
              <button type="button" onclick={() => (activeId = link.id)}>{link.title}</button>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="hint">{t("linkHint")}</p>
    </aside>
  {/if}
</section>

<style>
  .notes {
    display: grid;
    grid-template-columns: var(--pv-sidebar-wide-w) minmax(0, 1fr) var(--pv-aside-w);
    height: 100%;
    min-height: 0;
    background: var(--pv-desk);
    color: var(--pv-text);
  }

  .compact {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  aside,
  .context {
    min-height: 0;
    overflow: auto;
    background: var(--pv-chrome);
  }

  aside {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 12px;
    border-right: 1px solid var(--pv-line);
  }

  .context {
    padding: 20px 18px;
    border-left: 1px solid var(--pv-line);
  }

  .switch {
    display: flex;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
  }

  .switch button {
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--pv-text);
    padding: 6px 0;
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

  .search input,
  .tags,
  .fields input,
  .todos input,
  .title {
    border: 0;
    background: transparent;
    color: inherit;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 10px;
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text-faint);
  }

  .search:focus-within {
    outline: 2px solid var(--pv-accent);
    outline-offset: 2px;
  }

  .search :global(svg) {
    flex: none;
    width: 13px;
    height: 13px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    font: inherit;
    color: var(--pv-text);
    outline: none;
  }

  .list {
    flex: 1;
    overflow: auto;
  }

  .eyebrow {
    margin: 10px 8px 4px;
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
    color: var(--pv-text-faint);
    font-weight: 600;
  }

  .row {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    border-radius: var(--pv-radius-xs);
    padding: 7px 10px;
    color: var(--pv-text);
  }

  .row.active {
    background: var(--pv-selected);
    font-weight: 600;
  }

  .row:hover {
    background: var(--pv-selected);
  }

  .sub {
    font-size: var(--pv-text-sm);
    font-weight: 400;
    color: var(--pv-text-faint);
  }

  .name,
  .sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .add,
  .text,
  .danger {
    border: 0;
    background: transparent;
    color: var(--pv-accent);
    text-align: left;
    padding: 6px 8px;
  }

  .confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 12px;
  }

  .confirm p {
    width: 100%;
    margin: 0;
    color: var(--pv-ink-2);
    font-size: var(--pv-text-md);
  }

  .desk {
    min-width: 0;
    overflow: auto;
    padding: 36px 24px 48px;
  }

  .card {
    width: min(var(--pv-note-w), 100%);
    margin: 0 auto;
    padding: 30px 44px 36px;
    background-color: var(--pv-paper);
    background-image: var(--pv-grain);
    box-shadow: var(--pv-shadow-sheet);
    color: var(--pv-ink);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 14px;
    border-bottom: 1.5px solid var(--pv-ink-rule-accent);
    color: var(--pv-ink-muted);
    font-size: var(--pv-text-sm);
  }

  header select {
    border: 0;
    background: transparent;
    color: var(--pv-ink-accent);
    font-size: var(--pv-text-xs);
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .title {
    width: 100%;
    margin-top: 12px;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-2xl);
    font-weight: 400;
    color: var(--pv-ink);
  }

  .tags {
    width: 100%;
    margin: 4px 0 12px;
    color: var(--pv-ink-muted);
  }

  .fields {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--pv-ink-rule);
  }

  .fields .text {
    grid-column: 1 / -1;
    color: var(--pv-ink-accent);
  }

  .fields input {
    color: var(--pv-ink);
    border-bottom: 1px solid var(--pv-ink-rule);
  }

  .todos {
    margin-top: 16px;
  }

  .todo {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    color: var(--pv-ink);
    padding: 4px 0;
    font-size: var(--pv-text-lg);
  }

  .todo.done {
    color: var(--pv-ink-muted);
    text-decoration: line-through;
  }

  .box {
    width: 15px;
    height: 15px;
    margin-top: 2px;
    border: 1.5px solid var(--pv-ink-muted);
    border-radius: var(--pv-radius-xs);
    flex: none;
  }

  .box.doing {
    border-color: var(--pv-ink-accent);
    background: linear-gradient(135deg, var(--pv-ink-accent) 50%, transparent 50%);
  }

  .box.done {
    display: grid;
    place-items: center;
    border: 0;
    background: var(--pv-ink-success);
  }

  .box svg {
    width: 11px;
    height: 11px;
    fill: none;
    stroke: var(--pv-paper);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .todo-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .todo .meta {
    font-family: var(--pv-font-ui);
    font-size: var(--pv-text-sm);
    color: var(--pv-ink-muted);
  }

  .add-todo {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
  }

  .todos input {
    flex: 1;
    min-width: 0;
    color: var(--pv-ink);
  }

  .add-todo select {
    max-width: 11rem;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-ink-2);
    font-size: var(--pv-text-sm);
  }

  .chapters {
    margin-top: 16px;
    color: var(--pv-ink-2);
    font-size: var(--pv-text-md);
  }

  .chapters label {
    display: flex;
    gap: 8px;
    margin: 4px 0;
  }

  .context ul {
    list-style: none;
    margin: 0 0 18px;
    padding: 0;
  }

  .context li,
  .context button {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--pv-text);
    text-align: left;
    padding: 4px 0;
  }

  .context button {
    color: var(--pv-accent);
  }

  .hint,
  .quiet,
  .error {
    color: var(--pv-text-faint);
    font-size: var(--pv-text-md);
  }

  .error {
    color: var(--danger);
  }

  .card :global(.editor-host) {
    min-height: 0;
  }

  .card :global(.ProseMirror) {
    min-height: 8rem;
    font-size: 15px;
  }
</style>
