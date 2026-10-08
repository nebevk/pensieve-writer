<script lang="ts">
  import { onMount } from "svelte";
  import { bookProgress, summarize, type ProjectSummary } from "$lib/chapters/progress";
  import { compactWords, wordsFor } from "$lib/editor/counts";
  import { roman } from "$lib/chapters/labels";
  import type { AmbienceName, KnownProject, Prefs } from "$lib/prefs";
  import type { Chapter, Writing } from "$lib/model";
  import { isUntitled, type UiKey } from "$lib/i18n";
  import { ago, locale, num, plural, t, ui } from "$lib/ui.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import { chapterTitle, isWelcomePage } from "$lib/chapters/welcome";
  import { WRITER } from "$lib/writer";
  import { randomQuote } from "$lib/quotes";
  import { listNotes, listTasks, saveTask, type Note, type NoteCategory, type Task } from "$lib/storage/organize";
  import ChecklistItem from "./ChecklistItem.svelte";
  import NoteMini from "./NoteMini.svelte";

  let {
    writing,
    projectTitle = "",
    openSummary,
    lastChapterId = "",
    prefs,
    now = Date.now(),
    wordsToday = 0,
    onContinue,
    onZen,
    onRename,
    onOpenProject,
    onStartProject,
    onOpenBook,
    onOpenTodos,
    onOpenNotes,
    onOpenNote,
    onAmbience,
    onSaveError,
    currentPath = "",
    books = [],
  }: {
    /** The writing open in Write. */
    writing: Writing;
    /** The open project's name, and its writings added up. */
    projectTitle?: string;
    openSummary: ProjectSummary;
    /** The chapter that was open last in this writing: what Continue writing opens. */
    lastChapterId?: string;
    prefs: Prefs;
    /** The page's minute clock, for the time beside the date. */
    now?: number;
    wordsToday?: number;
    onContinue: (chapterId: string | null) => void;
    onZen: (chapterId: string | null) => void;
    onRename: (title: string) => void;
    onOpenProject: () => void;
    onStartProject: () => void;
    onOpenBook: (path: string) => void;
    onOpenTodos: () => void;
    onOpenNotes: () => void;
    onOpenNote: (id: string, title: string) => void;
    /** Opens Settings at the ambience. */
    onAmbience: () => void;
    onSaveError?: (message: string) => void;
    currentPath?: string;
    books?: KnownProject[];
  } = $props();

  // A short verse for Eva under her greeting, a different one each time Home opens.
  const quote = randomQuote();
  const NOTE_KINDS: Record<NoteCategory, UiKey> = {
    characters: "kindCharacter",
    places: "kindPlace",
    research: "kindResearch",
    ideas: "kindNote",
  };
  const SOUNDS: Record<Exclude<AmbienceName, "off">, { key: UiKey; icon: string }> = {
    rain: { key: "soundRain", icon: "rain" },
    fire: { key: "soundFireplace", icon: "flame" },
    cafe: { key: "soundCafe", icon: "" },
    piano: { key: "soundPiano", icon: "" },
  };
  const NEXT_STATE: Record<Task["todoState"], Task["todoState"]> = { todo: "doing", doing: "done", done: "todo" };

  let renaming = $state(false);
  let titleDraft = $state("");
  let titleInput = $state<HTMLInputElement | undefined>(undefined);
  let menuOpen = $state(false);
  let notes = $state<Note[]>([]);
  let tasks = $state<Task[]>([]);
  let message = $state("");

  $effect(() => {
    if (renaming) titleInput?.focus();
  });

  const chapters = $derived([...writing.chapters].sort((a, b) => a.position - b.position));
  const summary = $derived(summarize(writing));
  // The chapter Continue writing opens: the one open last, else the one written in last.
  const latest = $derived(
    chapters.find((chapter) => chapter.id === lastChapterId) ??
      [...chapters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
      null,
  );
  const lines = $derived(paragraphs(latest));
  const currentLine = $derived(lines.at(-1) ?? "");
  const previousLine = $derived(lines.at(-2) ?? "");
  const otherBooks = $derived(books.filter((book) => book.path.toLowerCase() !== currentPath.toLowerCase()));
  // Doing first, as on the board.
  const openTasks = $derived(
    tasks
      .filter((task) => task.todoState !== "done")
      .sort((a, b) => Number(b.todoState === "doing") - Number(a.todoState === "doing")),
  );
  const recentNotes = $derived([...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3));
  // How many chapters, and how many are still empty: no statuses for now (owner, 8 October).
  const chapterCounts = $derived.by(() => {
    const empty = chapters.filter((chapter) => statusOf(chapter) === "empty").length;
    return [plural("chapters", chapters.length), ...(empty > 0 ? [`${num(empty)} ${t("statusEmpty").toLowerCase()}`] : [])];
  });
  const sound = $derived(prefs.ambience === "off" ? null : SOUNDS[prefs.ambience]);

  function paragraphs(chapter: Chapter | null): string[] {
    if (!chapter) return [];
    return chapter.plainText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function statusOf(chapter: Chapter): "written" | "empty" {
    return chapter.plainText.trim() ? "written" : "empty";
  }

  /**
   * "Good evening, Eva. The Attic is waiting." (HOME-10): the time of day, then the chapter Continue
   * opens. Late at night it's "Late again, Eva."; a new book's welcome page gets the greeting alone.
   */
  function greeting(at: number): string {
    const hour = new Date(at).getHours();
    const hello =
      hour >= 23 || hour < 5 ? t("lateAgain") : hour < 12 ? t("morning") : hour < 18 ? t("afternoon") : t("evening");
    const greet = `${hello}, ${WRITER}.`;
    const chapter = latest;
    if (!chapter || isWelcomePage(chapter)) return greet;
    const name = isUntitled(chapter.title)
      ? chapterTitle(ui.language, chapters.findIndex((item) => item.id === chapter.id) + 1)
      : chapter.title.trim();
    return `${greet} ${t("chapterWaiting", { chapter: name })}`;
  }

  function clip(text: string, max = 88): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
  }

  /** Today, yesterday, or the date. */
  function when(iso: string): string {
    const then = new Date(iso).getTime();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (then >= start.getTime()) return t("today");
    if (then >= start.getTime() - 24 * 60 * 60 * 1000) {
      const yesterday = t("yesterday");
      return yesterday.charAt(0).toUpperCase() + yesterday.slice(1);
    }
    return new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short" });
  }

  /** What a project row says: how many writings, and their words. */
  function rowStatus(project: ProjectSummary): string {
    // One remembered before projects held writings knows its words, not yet its writings.
    if (project.writings.length === 0) return plural("words", project.words);
    return `${plural("writings", project.writings.length)} · ${plural("words", project.words)}`;
  }

  /** How far along a project is: its one writing's progress, or none to show for several. */
  function rowProgress(project: ProjectSummary | undefined): number {
    return project?.writings.length === 1 ? bookProgress(project.writings[0]) : 0;
  }

  function taskMeta(task: Task): string {
    const index = chapters.findIndex((chapter) => chapter.id === task.chapterId);
    // A to-do on another writing's chapter says nothing about where; one on no chapter is the project's.
    const chapter = index >= 0 ? `${index + 1} · ${chapters[index].title}` : task.chapterId ? "" : t("wholeProject");
    const note = task.noteId ? notes.find((item) => item.id === task.noteId)?.title : "";
    return note ? (chapter ? `${chapter} · ${note}` : note) : chapter;
  }

  function startRename() {
    titleDraft = writing.title;
    renaming = true;
  }

  function finishRename() {
    if (!renaming) return;
    renaming = false;
    onRename(titleDraft);
  }

  async function toggle(task: Task) {
    const next = { ...task, todoState: NEXT_STATE[task.todoState], updatedAt: new Date().toISOString() };
    tasks = tasks.map((item) => (item.id === task.id ? next : item));
    try {
      await saveTask(next);
    } catch (error) {
      onSaveError?.(error instanceof Error ? error.message : t("todoUpdateFailed"));
      void refresh();
    }
  }

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    try {
      [notes, tasks] = await Promise.all([listNotes(), listTasks()]);
    } catch (error) {
      message = error instanceof Error ? error.message : t("homeLoadFailed");
    }
  }
</script>

{#snippet projectRow(title: string, project: ProjectSummary | undefined, onclick: () => void)}
  <!-- A project as a tiny title page, with its writings and words (design round 6; projects since 7 October). -->
  <button type="button" class="project" {onclick}>
    <span class="page" class:stacked={(project?.writings.length ?? 0) > 1}>
      {title.trim().charAt(0) || "·"}
    </span>
    <span class="about">
      <span class="line">
        <span class="name">{title}</span>
      </span>
      <span class="bar" aria-hidden="true">
        <span style:width="{Math.round(rowProgress(project) * 100)}%"></span>
      </span>
      <span class="kind-line">{project ? rowStatus(project) : t("book")}</span>
    </span>
  </button>
{/snippet}

<section class="home">
  <div class="hero">
    <div class="intro">
      <p class="date">
        {new Date(now).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })} ·
        {new Date(now).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}
      </p>
      <h1>{greeting(now)}</h1>
      <blockquote class="quote">
        <p>{quote.text}</p>
        <footer>{quote.reference}</footer>
      </blockquote>
      <div class="stats">
        <div>
          <p class="value">{num(wordsToday)}</p>
          <p class="label">{t("wordsToday")}</p>
        </div>
        <div>
          <p class="value">{num(summary.words)}{#if summary.target > 0}<span>{` / ${compactWords(summary.target)}`}</span>{/if}</p>
          <p class="label">{t("inBook")}</p>
        </div>
      </div>

      <!-- The open book's chapters as bars, written or still empty; each opens its chapter. -->
      <div class="strip">
        <div class="strip-head">
          {#if renaming}
            <input
              class="title-edit"
              aria-label={t("projectTitle")}
              bind:this={titleInput}
              bind:value={titleDraft}
              onkeydown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  finishRename();
                }
              }}
              onblur={finishRename}
            />
          {:else}
            <button type="button" class="book-title" title={t("renameBook")} onclick={startRename}>{writing.title}</button>
          {/if}
          <span class="counts">{chapterCounts.join(" · ")}</span>
        </div>
        <div class="bars" class:many={chapters.length > 12}>
          {#each chapters as chapter, index (chapter.id)}
            <button type="button" class="chapter" title={`${index + 1} · ${chapter.title}`} onclick={() => onContinue(chapter.id)}>
              <span class="mark {statusOf(chapter)}"></span>
              <span class="chapter-name" class:current={chapter.id === latest?.id} class:untitled={isUntitled(chapter.title)}>
                <span class="n">{index + 1}</span>
                {chapter.title}
              </span>
              <span class="words">{compactWords(wordsFor(chapter.id, chapter.plainText))}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="side">
      <div class="continue">
        <div class="sheet">
          <div class="running">
            <span>{writing.title}</span>
            <!-- The chapter in Roman numerals, as the page's own running head writes it. -->
            <span>{latest ? t("chapterShort", { n: roman(chapters.findIndex((chapter) => chapter.id === latest.id) + 1) }) : ""}</span>
          </div>
          <div class="excerpt">
            {#if previousLine}
              <p class="faded">{clip(previousLine, 140)}</p>
            {/if}
            <p>{currentLine ? clip(currentLine, 160) : t("blankPage")}<span class="caret" aria-hidden="true"></span></p>
          </div>
          <div class="foot">
            <span class="edited">{latest ? t("editedAgo", { ago: ago(latest.updatedAt) }) : ""}</span>
            <!-- The two buttons stay together: short of room, they go under the time, not into it. -->
            <span class="buttons">
              <button type="button" class="zen" onclick={() => onZen(latest?.id ?? null)}><Icon name="moon" />{t("zen")}</button>
              <button type="button" class="go" onclick={() => onContinue(latest?.id ?? null)}>{t("continue")} <Icon name="arrowRight" /></button>
            </span>
          </div>
        </div>
      </div>
      <p class="sound">
        {#if sound?.icon}<Icon name={sound.icon} />{/if}
        {sound ? t("ambienceStarts", { sound: t(sound.key) }) : t("ambienceSilent")} ·
        <button type="button" onclick={onAmbience}>{t("change")}</button>
      </p>
    </div>
  </div>

  <div class="columns">
    <div class="column">
      <div class="column-head">
        <h2>{t("openTodosFilter")}</h2>
        <span class="count">{openTasks.length}</span>
        <button type="button" class="link" onclick={onOpenTodos}>{t("allTodos")}</button>
      </div>
      {#each openTasks.slice(0, 4) as task (task.id)}
        <ChecklistItem text={task.title} state={task.todoState} meta={taskMeta(task)} truncate flush onToggle={() => void toggle(task)} />
      {:else}
        <p class="empty">{t("noOpenTodos")}</p>
      {/each}
    </div>

    <div class="column">
      <div class="column-head">
        <h2>{t("recentNotes")}</h2>
        <span class="count">{notes.length}</span>
        <button type="button" class="link" onclick={onOpenNotes}>{t("allNotes")}</button>
      </div>
      <div class="notes">
        {#each recentNotes as note (note.id)}
          <NoteMini
            variant="card"
            kind={t(NOTE_KINDS[note.category])}
            title={note.title}
            meta={when(note.updatedAt)}
            onclick={() => onOpenNote(note.id, note.title)}
          />
        {:else}
          <p class="empty">{t("noNotesYet")}</p>
        {/each}
      </div>
    </div>

    <div class="column">
      <div class="column-head">
        <h2>{t("projects")}</h2>
        <span class="count">{otherBooks.length + 1}</span>
        <div
          class="menu-wrap"
          role="presentation"
          onkeydown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              event.stopPropagation();
              menuOpen = false;
            }
          }}
          onfocusout={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) menuOpen = false;
          }}
        >
          <button type="button" class="link" aria-haspopup="menu" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
            {t("newProject")}
          </button>
          {#if menuOpen}
            <div class="menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onclick={() => {
                  menuOpen = false;
                  onStartProject();
                }}
              >
                {t("newProjectTitle")}
              </button>
              <span class="rule" aria-hidden="true"></span>
              <button
                type="button"
                role="menuitem"
                onclick={() => {
                  menuOpen = false;
                  onOpenProject();
                }}
              >
                {t("open")}
              </button>
            </div>
          {/if}
        </div>
      </div>
      {@render projectRow(projectTitle || writing.title, openSummary, () => onContinue(null))}
      {#each otherBooks as book (book.path)}
        {@render projectRow(book.title, book.summary, () => onOpenBook(book.path))}
      {/each}
    </div>
  </div>

  {#if message}
    <p class="error load" role="alert">{message}</p>
  {/if}
</section>

<style>
  .home {
    flex: 1;
    min-height: 0;
    overflow: auto;
    position: relative;
    color: var(--pv-text);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 440px);
    gap: 56px;
    padding: 36px 64px 0;
  }

  .intro {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .date {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--pv-text-faint);
  }

  h1 {
    margin: 12px 0 0;
    max-width: 560px;
    font-family: var(--pv-font-heading);
    font-size: 46px;
    font-weight: 400;
    line-height: 1.08;
    text-wrap: pretty;
  }

  .quote {
    margin: 10px 0 0;
    max-width: 34rem;
  }

  .quote p {
    margin: 0;
    font-family: var(--pv-font-manuscript);
    font-size: 17px;
    line-height: 1.45;
    color: var(--pv-text-2);
  }

  .quote footer {
    margin-top: 6px;
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
    color: var(--pv-text-faint);
  }

  .stats {
    display: flex;
    gap: 40px;
    margin-top: 18px;
  }

  .value {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: 28px;
  }

  .value span {
    font-size: 16px;
    color: var(--pv-text-faint);
  }

  .label {
    margin: 2px 0 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-subtle);
  }

  .strip {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--pv-divider);
  }

  .strip-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: var(--pv-text-md);
  }

  .book-title,
  .title-edit {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text);
    font: inherit;
    font-weight: 600;
  }

  .book-title:hover {
    text-decoration: underline;
    text-decoration-color: var(--pv-line-strong);
  }

  .title-edit {
    min-width: 12rem;
    border-bottom: 1px solid var(--pv-line-strong);
  }

  .counts {
    color: var(--pv-text-faint);
  }

  .bars {
    display: flex;
    gap: 6px;
  }

  .chapter {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .mark {
    height: 6px;
    border-radius: 1px;
  }

  /* A chapter with text in it; no statuses for now (owner, 8 October). */
  .mark.written {
    background: color-mix(in oklch, var(--pv-text) 30%, transparent);
  }

  .mark.empty {
    border: 1.5px dashed var(--pv-empty);
  }

  .chapter:hover .mark {
    filter: brightness(1.08);
  }

  .chapter-name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 12px;
    color: var(--pv-text);
  }

  .chapter-name.current {
    font-weight: 600;
  }

  .chapter-name.untitled {
    font-style: italic;
    color: var(--pv-text-faint);
  }

  .n {
    font-weight: 400;
    color: var(--pv-text-faint);
  }

  .words {
    margin-top: -4px;
    font-size: 11px;
    color: var(--pv-text-faint);
  }

  /* With many chapters, the bars are enough; each one's name shows on hover. */
  .bars.many .chapter-name,
  .bars.many .words {
    display: none;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* The design's 250px card, taller when a long paragraph or Slovenian's longer words need it, never spilling. */
  .continue {
    position: relative;
  }

  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 250px;
    padding: 30px 36px;
    background-color: var(--pv-paper);
    box-shadow: var(--pv-shadow-sheet);
    color: var(--pv-ink);
    color-scheme: light;
  }

  :global(:root[data-grain="true"]) .sheet {
    background-image: var(--pv-grain);
  }

  .running {
    display: flex;
    justify-content: space-between;
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-running);
    text-transform: uppercase;
    color: var(--pv-ink-meta);
  }

  .excerpt {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    font-family: var(--pv-font-manuscript);
    font-size: 15px;
    line-height: 1.75;
  }

  .excerpt p {
    margin: 0;
  }

  .faded {
    opacity: 0.55;
    color: var(--pv-ink-2);
  }

  .caret {
    display: inline-block;
    width: 1px;
    height: 0.95em;
    margin-left: 2px;
    background: var(--pv-ink-accent);
    vertical-align: text-bottom;
    animation: blink 1.1s steps(1) infinite;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 8px;
  }

  /* One line: the buttons wrap below it rather than squeeze it onto two. */
  .edited {
    flex: 1 0 auto;
    white-space: nowrap;
    font-size: var(--pv-text-md);
    color: var(--pv-ink-muted);
  }

  .buttons {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .zen,
  .go {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: var(--pv-radius-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .zen {
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--pv-ink-rule-accent);
    background: transparent;
    color: var(--pv-ink-accent);
  }

  .zen:hover {
    background: var(--pv-ink-tint);
  }

  .zen:active {
    background: var(--pv-ink-chip);
  }

  .go {
    height: 36px;
    padding: 0 16px;
    border: 0;
    background: var(--pv-ink-accent);
    color: var(--pv-on-accent);
  }

  /* A solid button brightens on hover and darkens when pressed. */
  .go:hover {
    filter: brightness(1.08);
  }

  .go:active {
    filter: brightness(0.92);
  }

  .zen :global(svg),
  .go :global(svg) {
    width: 15px;
    height: 15px;
  }

  .sound {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding-left: 2px;
    font-size: 12px;
    color: var(--pv-text-subtle);
  }

  .sound :global(svg) {
    width: 13px;
    height: 13px;
  }

  .sound button {
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-accent);
    font: inherit;
    font-weight: 600;
  }

  .sound button:hover {
    text-decoration: underline;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 44px;
    padding: 30px 64px 0;
  }

  .column {
    min-width: 0;
  }

  .column-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--pv-divider);
  }

  .column-head h2 {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: 19px;
    font-weight: 400;
  }

  .count {
    flex: 1;
    font-size: var(--pv-text-md);
    color: var(--pv-text-faint);
  }

  .link {
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-accent);
    font-size: var(--pv-text-md);
    font-weight: 600;
    white-space: nowrap;
  }

  .link:hover {
    text-decoration: underline;
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .empty {
    margin: 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-faint);
  }

  .menu-wrap {
    position: relative;
  }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-width: 13rem;
    padding: 4px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-chrome-raised);
    box-shadow: var(--pv-shadow-window);
  }

  .menu button {
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 6px 8px;
    background: transparent;
    color: var(--pv-text);
    text-align: left;
    font-size: var(--pv-text-md);
  }

  .menu button:hover {
    background: var(--pv-selected);
  }

  .menu button:active {
    background: var(--pv-pressed);
  }

  .menu .rule {
    height: 1px;
    margin: 4px 2px;
    background: var(--pv-line);
  }

  /* A project as a tiny title page with its language and progress. */
  .project {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 6px 4px;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .project:hover {
    background: var(--pv-selected);
  }

  .project:active {
    background: var(--pv-pressed);
  }

  .page {
    display: grid;
    place-items: center;
    flex: none;
    width: 42px;
    height: 54px;
    background: var(--pv-paper);
    box-shadow: var(--pv-shadow-slip);
    color: var(--pv-ink-accent);
    font-family: var(--pv-font-manuscript);
    font-size: 13px;
  }

  .page.stacked {
    box-shadow:
      var(--pv-shadow-slip),
      3px 3px 0 -1px var(--pv-paper-under),
      3px 3px 0 0 var(--pv-line-strong);
  }

  .about {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--pv-text-base);
    font-weight: 600;
  }

  .bar {
    display: block;
    height: 2px;
    background: var(--pv-divider);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--pv-accent);
  }

  .kind-line {
    font-size: var(--pv-text-sm);
    color: var(--pv-text-subtle);
  }

  .error {
    color: var(--pv-danger);
  }

  .load {
    margin: 0;
    padding: 28px 64px;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @media (max-width: 1100px) {
    .hero,
    .columns,
    .load {
      padding-left: 28px;
      padding-right: 28px;
    }

    .hero {
      grid-template-columns: 1fr;
    }

    .columns {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
