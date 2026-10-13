<script lang="ts">
  import { onMount } from "svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import type { DocumentJson } from "$lib/model";
  import type { NoteTarget } from "$lib/editor/noteLinks";
  import { deleteNote, flushNoteSave, listNotes, saveNote, scheduleNoteSave, watchNoteSaves, type Note } from "$lib/storage/organize";
  import { readIdeaPlaces, saveIdeaPlaces, snapshotSavedWriting } from "$lib/storage/sqlite";
  import { ago, t } from "$lib/ui.svelte";
  import EmptyState from "./EmptyState.svelte";
  import IdeasMap from "./IdeasMap.svelte";
  import { ideaLinks, ideaMatches, newestFirst, ownCard, placed, readable, withLink, withoutLinks, type IdeaCard, type Place } from "./ideas";

  let {
    projectId,
    projectPath,
    projectTitle,
    writingId = "",
    language = "en",
    loadOthers,
    createRequest = null,
    onCreateHandled,
    openRequest = null,
    onOpenHandled,
    onOpenElsewhere,
    onOpenInNotes,
    onSaveError,
  }: {
    /** The open project, whose ideas are written here. */
    projectId: string;
    projectPath: string;
    projectTitle: string;
    /** The writing open in Write, whose earlier version keeps an idea before it's deleted. */
    writingId?: string;
    language?: "en" | "sl";
    /** Every other project's ideas, only to read, saying how far it has got; those that couldn't be read are named. */
    loadOthers: (progress: (done: number, total: number) => void) => Promise<{ cards: IdeaCard[]; unread: string[] }>;
    /** A new idea to make once: Ctrl+Shift+N while the tab is open. */
    createRequest?: { at: number } | null;
    onCreateHandled?: () => void;
    /** An idea to open once, after its project opened from All projects. */
    openRequest?: { id: string; at: number } | null;
    onOpenHandled?: () => void;
    /** Opens another project's idea in its own project, to write it there. */
    onOpenElsewhere: (card: IdeaCard) => void;
    onOpenInNotes: (id: string) => void;
    onSaveError?: (message: string) => void;
  } = $props();

  // The open project's notes, ideas and the rest, for the links between them; written here as Notes writes.
  let notes = $state<Note[]>([]);
  let loaded = $state(false);
  let message = $state("");
  let scope = $state<"project" | "all">("project");
  let query = $state("");
  let others = $state.raw<IdeaCard[] | null>(null);
  let unread = $state<string[]>([]);
  let progress = $state({ done: 0, total: 0 });
  // The idea open beside the cards, by its project's file and its id.
  let openKey = $state("");
  let fresh = $state(false);
  let confirmDelete = $state(false);
  let seenCreate = 0;
  let seenOpen = 0;
  // Cards, or the map of this project's ideas with where she put them.
  let layout = $state<"cards" | "map">("cards");
  let places = $state.raw(new Map<string, Place>());
  let placesRead = false;
  // Raised when the map changes the open idea's text, so its page shows the change and never writes over it.
  let pageTurn = $state(0);

  const keyOf = (card: { path: string; id: string }) => `${card.path.toLowerCase()}|${card.id}`;
  const ideas = $derived(notes.filter((note) => note.category === "ideas"));
  const own = $derived(ideas.map((note) => ownCard(note, projectPath, projectTitle)));
  const every = $derived(scope === "all" ? [...own, ...(others ?? [])] : own);
  const shown = $derived(newestFirst(every).filter((card) => ideaMatches(card, query)));
  const openCard = $derived([...own, ...(others ?? [])].find((card) => keyOf(card) === openKey) ?? null);
  const openNote = $derived(openCard?.own ? (ideas.find((note) => note.id === openCard.id) ?? null) : null);
  // Links among the project's notes: an idea's [[links]] reach other ideas and any note by its name.
  const links = $derived(ideaLinks(notes.map((note) => ({ id: note.id, title: note.title, aliases: note.aliases, text: note.plainText }))));
  const noteOf = (id: string) => notes.find((note) => note.id === id);
  const linksOut = $derived(openNote ? links.filter((link) => link.from === openNote.id).flatMap((link) => noteOf(link.to) ?? []) : []);
  const linksIn = $derived(openNote ? links.filter((link) => link.to === openNote.id).flatMap((link) => noteOf(link.from) ?? []) : []);
  const linkCount = (card: IdeaCard) => (card.own ? links.filter((link) => link.from === card.id).length : 0);
  // The map draws the links between ideas; a search fades the ideas without its words.
  const ideaToIdea = $derived(links.filter((link) => noteOf(link.from)?.category === "ideas" && noteOf(link.to)?.category === "ideas"));
  const matches = $derived(
    query.trim() ? new Set(ideas.filter((note) => ideaMatches({ title: note.title, aliases: note.aliases, text: note.plainText }, query)).map((note) => note.id)) : null,
  );

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

  async function refresh() {
    try {
      notes = await listNotes();
      loaded = true;
    } catch (error) {
      message = error instanceof Error ? error.message : t("notesLoadFailed");
    }
  }

  $effect(() => {
    if (!loaded || !createRequest || createRequest.at === seenCreate) return;
    seenCreate = createRequest.at;
    void create();
    onCreateHandled?.();
  });

  $effect(() => {
    if (!loaded || !openRequest || openRequest.at === seenOpen) return;
    seenOpen = openRequest.at;
    scope = "project";
    openKey = keyOf({ path: projectPath, id: openRequest.id });
    onOpenHandled?.();
  });

  /** Every project's ideas: the others are read the first time she asks, and kept while the tab is open. */
  async function showAll() {
    scope = "all";
    if (others) return;
    const read = await loadOthers((done, total) => (progress = { done, total }));
    others = read.cards;
    unread = read.unread;
  }

  function open(card: { path: string; id: string }) {
    confirmDelete = false;
    fresh = false;
    openKey = keyOf(card);
  }

  function update(id: string, patch: Partial<Note>) {
    const current = notes.find((note) => note.id === id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    notes = notes.map((note) => (note.id === id ? next : note));
    scheduleNoteSave(next);
  }

  /** The map, of this project's ideas: where she put them is read the first time it opens. */
  async function showMap() {
    layout = "map";
    scope = "project";
    if (openCard && !openCard.own) openKey = "";
    if (placesRead) return;
    placesRead = true;
    try {
      // A card moved while they were read stays where it was moved.
      const read = await readIdeaPlaces();
      places = new Map([...read, ...places]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  }

  /** An idea put somewhere on the map; every idea still in its row stays where it is, so none jumps. */
  function move(id: string, place: Place) {
    const moved: [string, Place][] = [...placed(ideas, places)].filter(([other]) => other !== id && !places.has(other));
    moved.push([id, { x: Math.round(place.x), y: Math.round(place.y) }]);
    places = new Map([...places, ...moved]);
    saveIdeaPlaces(moved).catch((error: unknown) => (message = error instanceof Error ? error.message : String(error)));
  }

  /** Two ideas linked on the map: a [[link]] to the second at the end of the first's text, once. */
  function link(from: string, to: string) {
    const source = noteOf(from);
    const target = noteOf(to);
    if (!source || !target?.title.trim() || links.some((item) => item.from === from && item.to === to)) return;
    update(from, withLink(source.contentJson, target.title.trim()));
    if (openNote?.id === from) pageTurn += 1;
  }

  /** A link taken away on the map: every [[link]] in the first idea to the second, by any of its names. */
  function unlink(from: string, to: string) {
    const source = noteOf(from);
    const target = noteOf(to);
    if (!source || !target) return;
    update(from, withoutLinks(source.contentJson, [target.title, ...target.aliases.split(",")]));
    if (openNote?.id === from) pageTurn += 1;
  }

  /** A new idea, open beside the cards with its name ready to be typed over; one a [[link]] asked for has that name, one made on the map is where she made it. */
  async function create(title = "", place?: Place) {
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      projectId,
      title: title || t("newIdea"),
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
      plainText: "",
      category: "ideas",
      tags: "",
      aliases: "",
      fields: [],
      todoState: null,
      chapterIds: [],
      createdAt: now,
      updatedAt: now,
    };
    notes = [note, ...notes];
    if (place) move(note.id, place);
    scope = "project";
    query = "";
    confirmDelete = false;
    openKey = keyOf({ path: projectPath, id: note.id });
    fresh = !title;
    try {
      await saveNote(note);
    } catch (error) {
      message = error instanceof Error ? error.message : t("noteCreateFailed");
    }
  }

  async function remove(id: string) {
    confirmDelete = false;
    try {
      // An earlier version keeps the idea, so a mistaken delete can be undone from Write.
      await flushNoteSave();
      if (writingId) await snapshotSavedWriting(writingId);
      await deleteNote(id);
      notes = notes.filter((note) => note.id !== id);
      openKey = "";
    } catch (error) {
      message = error instanceof Error ? error.message : t("noteDeleteFailed");
    }
  }

  /** A [[link]] in an idea: another idea opens beside, any other note in Notes, and a name with no note yet becomes an idea. */
  function openLinked(target: NoteTarget) {
    const name = target.title.trim().toLowerCase();
    const found =
      (target.id ? notes.find((note) => note.id === target.id) : undefined) ??
      notes.find((note) => [note.title, ...note.aliases.split(",")].some((other) => other.trim().toLowerCase() === name));
    if (found?.category === "ideas") open({ path: projectPath, id: found.id });
    else if (found) onOpenInNotes(found.id);
    else if (name) void create(target.title.trim());
  }

  /** The name of a new idea takes the keyboard, selected, so typing replaces it. */
  function takeName(node: HTMLInputElement) {
    if (!fresh) return;
    node.focus();
    node.select();
    fresh = false;
  }

  const paragraphs = (text: string) => readable(text).split("\n").filter(Boolean);
</script>

<!-- Ideas (owner, 13 October): every idea as a card, this project's or every project's, found by its words. -->
<section class="ideas-view">
  <header class="bar">
    <h1>{t("groupIdeas")}</h1>
    <span class="count">{shown.length}</span>
    <div class="switch" role="radiogroup" aria-label={t("groupIdeas")}>
      <button type="button" role="radio" aria-checked={scope === "project"} class:on={scope === "project"} onclick={() => (scope = "project")}>{t("ideasThisProject")}</button>
      <!-- The map is of this project's ideas, where she put them. -->
      <button
        type="button"
        role="radio"
        aria-checked={scope === "all"}
        class:on={scope === "all"}
        disabled={layout === "map"}
        title={layout === "map" ? t("ideasMapOneProject") : undefined}
        onclick={() => void showAll()}
      >
        {t("ideasAllProjects")}
      </button>
    </div>
    <div class="switch" role="radiogroup" aria-label={t("ideasMap")}>
      <button type="button" role="radio" aria-checked={layout === "cards"} class:on={layout === "cards"} onclick={() => (layout = "cards")}>{t("ideasCards")}</button>
      <button type="button" role="radio" aria-checked={layout === "map"} class:on={layout === "map"} onclick={() => void showMap()}>{t("ideasMap")}</button>
    </div>
    <label class="search">
      <Icon name="search" />
      <input bind:value={query} placeholder={t("searchIdeas")} aria-label={t("searchIdeas")} />
    </label>
    <span class="spacer"></span>
    <button type="button" class="new" onclick={() => void create()}><Icon name="plus" />{t("newIdea")}</button>
  </header>
  {#if scope === "all" && !others}
    <p class="status" aria-live="polite">{t("searchReading", { done: progress.done, total: progress.total })}</p>
  {/if}
  {#if scope === "all" && unread.length > 0}
    <p class="status unread">{t("searchUnread", { names: unread.join(", ") })}</p>
  {/if}
  {#if message}
    <p class="status unread" role="alert">{message}</p>
  {/if}
  {#if layout === "map"}
    <p class="status">{t("ideasMapHint")}</p>
  {/if}
  <div class="body">
    {#if layout === "map"}
      <IdeasMap
        {ideas}
        links={ideaToIdea}
        {places}
        {matches}
        openId={openNote?.id ?? ""}
        onOpen={(id) => open({ path: projectPath, id })}
        onMove={move}
        onLink={link}
        onUnlink={unlink}
        onCreateAt={(place) => void create("", place)}
      />
    {:else}
    <div class="cards">
      {#each shown as card (keyOf(card))}
        <button type="button" class="card" class:open={keyOf(card) === openKey} onclick={() => open(card)}>
          <span class="title">{card.title || t("untitled")}</span>
          {#if card.text.trim()}<span class="text">{readable(card.text)}</span>{/if}
          <span class="meta">
            {#if scope === "all"}<span class="project">{card.project}</span> ·{/if}
            {ago(card.createdAt)}
            {#if linkCount(card) > 0}<span class="links">· → {linkCount(card)}</span>{/if}
          </span>
        </button>
      {:else}
        {#if loaded && (scope === "project" || others)}
          {#if query.trim()}
            <p class="empty">{t("searchNothing")}</p>
          {:else}
            <EmptyState kind="notes" text={t("emptyIdeasLine")} action={t("newIdea")} onAction={() => void create()} />
          {/if}
        {/if}
      {/each}
    </div>
    {/if}
    {#if openNote}
      {@const note = openNote}
      <aside class="idea" aria-label={note.title}>
        <div class="paper">
          <!-- Made afresh for each idea, so a new one's name takes the keyboard even with another open before. -->
          {#key note.id}
            <div class="head">
              <input
                class="title"
                aria-label={t("noteTitle")}
                value={note.title}
                use:takeName
                oninput={(event) => update(note.id, { title: (event.currentTarget as HTMLInputElement).value })}
              />
              <button type="button" class="close" title={t("close")} aria-label={t("close")} onclick={() => (openKey = "")}><Icon name="x" /></button>
            </div>
          {/key}
          {#key `${note.id}:${pageTurn}`}
            <Editor
              docId={note.id}
              initialContent={note.contentJson}
              {language}
              focusOnOpen={false}
              onChange={(json: DocumentJson, text: string, id?: string) => update(id ?? note.id, { contentJson: json, plainText: text })}
              onEditor={() => {}}
              onActivity={() => {}}
              noteLinkBrackets
              onOpenNote={openLinked}
            />
          {/key}
          {#if linksOut.length > 0 || linksIn.length > 0}
            <div class="linked">
              <p class="eyebrow">{t("ideaLinks")}</p>
              {#each linksOut as other (other.id)}
                <button type="button" title={t("ideaLeadsTo", { title: other.title })} onclick={() => openLinked({ id: other.id, title: other.title })}>→ {other.title}</button>
              {/each}
              {#each linksIn as other (other.id)}
                <button type="button" title={t("ideaComesFrom", { title: other.title })} onclick={() => openLinked({ id: other.id, title: other.title })}>← {other.title}</button>
              {/each}
            </div>
          {/if}
        </div>
        <footer>
          {#if confirmDelete}
            <p class="say">{t("deleteNoteQuestion", { title: note.title })}</p>
            <button type="button" onclick={() => (confirmDelete = false)}>{t("cancel")}</button>
            <button type="button" class="danger" onclick={() => void remove(note.id)}>{t("delete")}</button>
          {:else}
            <button type="button" class="quiet" onclick={() => (confirmDelete = true)}>{t("delete")}</button>
            <button type="button" onclick={() => onOpenInNotes(note.id)}>{t("openInNotesView")}</button>
          {/if}
        </footer>
      </aside>
    {:else if openCard && !openCard.own}
      {@const card = openCard}
      <aside class="idea" aria-label={card.title}>
        <div class="paper">
          <div class="head">
            <h2 class="title">{card.title || t("untitled")}</h2>
            <button type="button" class="close" title={t("close")} aria-label={t("close")} onclick={() => (openKey = "")}><Icon name="x" /></button>
          </div>
          <p class="from">{card.project}</p>
          {#each paragraphs(card.text) as line, index (index)}
            <p class="line">{line}</p>
          {/each}
        </div>
        <footer>
          <button type="button" class="primary" onclick={() => onOpenElsewhere(card)}>{t("openInItsProject")}</button>
        </footer>
      </aside>
    {/if}
  </div>
</section>

<style>
  .ideas-view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    color: var(--pv-text);
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 18px 28px 14px;
    border-bottom: 1px solid var(--pv-divider);
  }

  h1 {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: 22px;
    font-weight: 400;
  }

  .count {
    color: var(--pv-text-faint);
    font-size: var(--pv-text-md);
  }

  .spacer {
    flex: 1;
  }

  /* As Home's Grid and List: a soft track, the chosen one raised in the page's colours. */
  .switch {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 6px;
    background: var(--pv-selected);
  }

  .switch button {
    height: 26px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0 10px;
    background: transparent;
    color: var(--pv-text-subtle);
    font-size: 13px;
  }

  .switch button.on {
    background: var(--pv-paper);
    color: var(--pv-ink);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(60, 45, 30, 0.18);
  }

  .switch button:not(.on):hover {
    color: var(--pv-text);
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: min(320px, 100%);
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
  }

  /* The field shows the keyboard as every control does (IMP-25): its frame takes the accent ring. */
  .search:focus-within {
    border-color: var(--pv-accent);
    outline: 2px solid var(--pv-accent);
    outline-offset: 2px;
  }

  .search :global(svg) {
    flex: none;
    width: 15px;
    height: 15px;
    color: var(--pv-text-subtle);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text);
    outline: none;
  }

  .new {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 14px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    font-size: 13.5px;
    font-weight: 600;
  }

  .new :global(svg) {
    width: 15px;
    height: 15px;
    color: var(--pv-accent);
  }

  .new:hover {
    background: var(--pv-selected);
  }

  .status {
    margin: 10px 28px 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-subtle);
  }

  .status.unread {
    color: var(--pv-danger);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  /* The ideas as cards, as many to a row as there's room for, newest first. */
  .cards {
    flex: 1;
    min-width: 0;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    align-content: start;
    gap: 16px;
    padding: 22px 28px 40px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 120px;
    border: 1px solid var(--pv-line);
    border-radius: var(--pv-radius-sm);
    padding: 16px 18px 14px;
    background: var(--pv-paper);
    box-shadow: var(--pv-shadow-card);
    color: var(--pv-ink);
    text-align: left;
  }

  .card:hover {
    border-color: var(--pv-line-strong);
  }

  .card.open {
    outline: 2px solid var(--pv-accent);
    outline-offset: -1px;
  }

  .card .title {
    font-family: var(--pv-font-heading);
    font-size: 17px;
    line-height: 1.25;
  }

  .card .text {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-line;
    font-family: var(--pv-font-manuscript);
    font-size: 14px;
    line-height: 1.5;
    color: var(--pv-ink-2);
  }

  .card .meta {
    margin-top: auto;
    font-size: 12px;
    color: var(--pv-ink-muted);
  }

  .card .project {
    font-weight: 600;
    color: var(--pv-ink-accent);
  }

  .empty {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--pv-text-faint);
    font-size: var(--pv-text-md);
  }

  /* No ideas yet: the picture across the cards' room, a little down from the top. */
  .cards > :global(.empty-state) {
    grid-column: 1 / -1;
    padding-top: 48px;
  }

  /* The idea open beside the cards, on paper, as a note beside the page. */
  .idea {
    flex: none;
    display: flex;
    flex-direction: column;
    width: min(420px, 40%);
    min-height: 0;
    border-left: 1px solid var(--pv-divider);
    padding-top: 14px;
  }

  .paper {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0 14px;
    padding: 16px 18px 20px;
    background-color: var(--pv-paper);
    background-image: var(--pv-grain);
    box-shadow: var(--pv-shadow-card);
    color: var(--pv-ink);
    color-scheme: light;
  }

  .head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1.5px solid var(--pv-ink-rule-accent);
  }

  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    border: 0;
    padding: 0;
    background: transparent;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-xl);
    font-weight: 400;
    color: var(--pv-ink);
  }

  .close {
    display: grid;
    place-items: center;
    flex: none;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 4px;
    background: transparent;
    color: var(--pv-ink-muted);
  }

  .close :global(svg) {
    width: 15px;
    height: 15px;
  }

  .close:hover {
    background: var(--pv-ink-chip);
  }

  .paper :global(.ProseMirror) {
    min-height: 9rem;
    font-size: 15px;
  }

  .from {
    margin: -4px 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--pv-ink-accent);
  }

  .line {
    margin: 0 0 10px;
    font-family: var(--pv-font-manuscript);
    font-size: 15px;
    line-height: 1.55;
  }

  .linked {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid var(--pv-ink-rule);
  }

  .eyebrow {
    margin: 0 0 4px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--pv-ink-muted);
  }

  .linked button {
    border: 0;
    padding: 2px 0;
    background: none;
    color: var(--pv-ink-accent);
    font-size: var(--pv-text-md);
    text-align: left;
  }

  .linked button:hover {
    text-decoration: underline;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: none;
    padding: 10px 14px 12px;
  }

  footer button {
    height: 30px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    padding: 0 12px;
    background: var(--pv-field);
    color: var(--pv-text);
  }

  footer button:hover {
    background: var(--pv-selected);
  }

  footer button.quiet {
    margin-right: auto;
    border-color: transparent;
    background: transparent;
    color: var(--pv-text-subtle);
  }

  footer button.primary,
  footer button.danger {
    border-color: transparent;
    background: var(--pv-accent-solid);
    color: var(--pv-on-accent);
  }

  footer button.danger {
    background: var(--pv-danger);
  }

  .say {
    flex: 1 1 100%;
    margin: 0 0 2px;
    font-size: var(--pv-text-md);
  }
</style>
