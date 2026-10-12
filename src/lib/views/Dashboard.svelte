<script lang="ts">
  import { onMount } from "svelte";
  import { summarize, type ProjectSummary } from "$lib/chapters/progress";
  import { compactWords, wordsFor } from "$lib/editor/counts";
  import { roman } from "$lib/chapters/labels";
  import Library from "$lib/chapters/Library.svelte";
  import type { LibraryActions, LibraryView } from "$lib/chapters/library";
  import type { AmbienceName, KnownProject, OutlineLayout, Prefs } from "$lib/prefs";
  import type { Chapter, Writing } from "$lib/model";
  import { isUntitled, type UiKey } from "$lib/i18n";
  import { ago, locale, num, plural, t, ui } from "$lib/ui.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import { chapterTitle, isWelcomePage } from "$lib/chapters/welcome";
  import { WRITER } from "$lib/writer";
  import { randomVerse, verse } from "$lib/quotes";
  import { listTasks, saveTask, type Task } from "$lib/storage/organize";
  import ChecklistItem from "./ChecklistItem.svelte";

  let {
    writing,
    projectTitle = "",
    openSummary,
    lastChapterId = "",
    prefs,
    now = Date.now(),
    wordsToday = 0,
    layout = "grid",
    onLayout,
    library,
    actions,
    writingWords = 0,
    onContinue,
    onZen,
    onOpenProject,
    onStartProject,
    onOpenBook,
    onOpenTodos,
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
    /** The projects as cards, or as the library's tree (remembered). */
    layout?: OutlineLayout;
    onLayout: (layout: OutlineLayout) => void;
    /** The library, for its tree; and what its rows do from Home. */
    library: LibraryView;
    actions: LibraryActions;
    /** The open writing's words, counted as she types. */
    writingWords?: number;
    onContinue: (chapterId: string | null) => void;
    onZen: (chapterId: string | null) => void;
    onOpenProject: () => void;
    onStartProject: () => void;
    onOpenBook: (path: string) => void;
    onOpenTodos: () => void;
    /** Opens Settings at the ambience. */
    onAmbience: () => void;
    onSaveError?: (message: string) => void;
    currentPath?: string;
    books?: KnownProject[];
  } = $props();

  // A short verse for Eva under her greeting, a different one each time Home opens, in her language.
  const verseAt = randomVerse();
  const quote = $derived(verse(verseAt, ui.language));
  const SOUNDS: Record<Exclude<AmbienceName, "off">, { key: UiKey; icon: string }> = {
    rain: { key: "soundRain", icon: "rain" },
    fire: { key: "soundFireplace", icon: "flame" },
    cafe: { key: "soundCafe", icon: "" },
    piano: { key: "soundPiano", icon: "" },
  };
  const NEXT_STATE: Record<Task["todoState"], Task["todoState"]> = { todo: "doing", doing: "done", done: "todo" };
  // A short list on Home; the rest are a link away.
  const TODOS_SHOWN = 5;

  let menuOpen = $state(false);
  let tasks = $state<Task[]>([]);
  let message = $state("");

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
  const sound = $derived(prefs.ambience === "off" ? null : SOUNDS[prefs.ambience]);

  function paragraphs(chapter: Chapter | null): string[] {
    if (!chapter) return [];
    return chapter.plainText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
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

  /** What a project's card says: how many writings, and their words. */
  function projectWords(project: ProjectSummary): string {
    // One remembered before projects held writings knows its words, not yet its writings.
    if (project.writings.length === 0) return plural("words", project.words);
    return `${plural("writings", project.writings.length)} · ${plural("words", project.words)}`;
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
      tasks = await listTasks();
    } catch (error) {
      message = error instanceof Error ? error.message : t("homeLoadFailed");
    }
  }
</script>

<!-- A project as a little title page: its name, its writings, their words, when it was last written in. -->
{#snippet card(title: string, project: ProjectSummary | undefined, current: boolean, onclick: () => void)}
  <button type="button" class="card project" class:current {onclick}>
    {#if current}<span class="open">{t("openNow")}</span>{/if}
    <span class="title name">{title}</span>
    <span class="rule" aria-hidden="true"></span>
    {#if project && project.writings.length > 0}
      <span class="writings">
        {#each project.writings.slice(0, 3) as item (item.id)}
          <span class="writing"><Icon name={item.split ? "book" : "fileText"} />{item.title}</span>
        {/each}
        {#if project.writings.length > 3}
          <span class="more">{t("andMore", { n: project.writings.length - 3 })}</span>
        {/if}
      </span>
    {/if}
    <span class="meta">
      <span>{project ? projectWords(project) : t("book")}</span>
      {#if project?.editedAt}<span>{t("editedAgo", { ago: ago(project.editedAt) })}</span>{/if}
    </span>
  </button>
{/snippet}

<!-- The open writing's chapters in the tree, each opening in Write. -->
{#snippet chapterRows(depth: number)}
  <ul class="chapters">
    {#each chapters as chapter, index (chapter.id)}
      <li>
        <button type="button" class="tree-row" style:--depth={depth} title={chapter.title} onclick={() => onContinue(chapter.id)}>
          <span class="twist" aria-hidden="true"></span>
          <span class="num">{index + 1}</span>
          <span class="chapter-name" class:untitled={isUntitled(chapter.title)}>{chapter.title}</span>
          <span class="words">{compactWords(wordsFor(chapter.id, chapter.plainText))}</span>
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

<!-- Home (owner, 12 October): on the left the greeting, what she wrote last and her to-dos; on the right her projects. -->
<section class="home">
  <div class="left">
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
    </div>

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
      <p class="sound">
        {#if sound?.icon}<Icon name={sound.icon} />{/if}
        {sound ? t("ambienceStarts", { sound: t(sound.key) }) : t("ambienceSilent")} ·
        <button type="button" onclick={onAmbience}>{t("change")}</button>
      </p>
    </div>

    <div class="todos">
      <div class="head">
        <h2>{t("openTodosFilter")}</h2>
        <span class="count">{openTasks.length}</span>
        <button type="button" class="link" onclick={onOpenTodos}>{t("allTodos")}</button>
      </div>
      {#each openTasks.slice(0, TODOS_SHOWN) as task (task.id)}
        <ChecklistItem text={task.title} state={task.todoState} truncate flush onToggle={() => void toggle(task)} />
      {:else}
        <p class="empty">{t("noOpenTodos")}</p>
      {/each}
    </div>
  </div>

  <div class="right">
    <div class="head">
      <h2>{t("projects")}</h2>
      <span class="count">{otherBooks.length + 1}</span>
      <div class="switch" role="radiogroup" aria-label={t("homeLayout")}>
        <button type="button" role="radio" aria-checked={layout === "grid"} class:on={layout === "grid"} title={t("outlineGrid")} onclick={() => onLayout("grid")}>
          <Icon name="layoutGrid" />{t("outlineGrid")}
        </button>
        <button type="button" role="radio" aria-checked={layout === "list"} class:on={layout === "list"} title={t("outlineList")} onclick={() => onLayout("list")}>
          <Icon name="list" />{t("outlineList")}
        </button>
      </div>
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
            <span class="menu-rule" aria-hidden="true"></span>
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

    {#if layout === "list"}
      <!-- The library's own tree: folders, projects, writings, notes and her files, as beside the page. -->
      <div class="tree">
        <Library
          {library}
          {actions}
          writingId={writing.id}
          writingTitle={writing.title}
          writingSplit={writing.split}
          {writingWords}
          chapterRows={writing.split ? chapterRows : undefined}
        />
      </div>
    {:else}
      <div class="grid">
        {@render card(projectTitle || writing.title, openSummary, true, () => onContinue(null))}
        {#each otherBooks as book (book.path)}
          {@render card(book.title, book.summary, false, () => onOpenBook(book.path))}
        {/each}
        <button type="button" class="card new" onclick={onStartProject}>
          <Icon name="plus" />{t("newProjectTitle")}
        </button>
      </div>
    {/if}
  </div>

  {#if message}
    <p class="error load" role="alert">{message}</p>
  {/if}
</section>

<style>
  /* Two columns: hers on the left, her projects on the right; one under the other on a narrow window. */
  .home {
    flex: 1;
    min-height: 0;
    overflow: auto;
    position: relative;
    display: grid;
    grid-template-columns: minmax(360px, 500px) minmax(0, 1fr);
    align-items: start;
    gap: 48px;
    padding: 36px 56px 48px;
    color: var(--pv-text);
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 26px;
    min-width: 0;
  }

  .right {
    min-width: 0;
  }

  .intro {
    display: flex;
    flex-direction: column;
  }

  .date {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--pv-text-faint);
  }

  /* The greeting is quieter than the verse under it (owner, 12 October). */
  h1 {
    margin: 10px 0 0;
    font-family: var(--pv-font-heading);
    font-size: 30px;
    font-weight: 400;
    line-height: 1.15;
    text-wrap: pretty;
  }

  .quote {
    margin: 16px 0 0;
  }

  .quote p {
    margin: 0;
    font-family: var(--pv-font-manuscript);
    font-size: 24px;
    line-height: 1.4;
    color: var(--pv-text);
    text-wrap: pretty;
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

  /* The design's 250px card, taller when a long paragraph or Slovenian's longer words need it, never spilling. */
  .continue {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
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

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--pv-divider);
  }

  .head h2 {
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

  .empty {
    margin: 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-faint);
  }

  .switch {
    display: flex;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
  }

  .switch button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: var(--pv-text);
    font-size: var(--pv-text-md);
  }

  .switch button :global(svg) {
    width: 14px;
    height: 14px;
  }

  .switch button.on {
    background: var(--pv-mark-bg);
    color: var(--pv-mark-fg);
    font-weight: 600;
  }

  .switch button:not(.on):hover {
    background: var(--pv-selected);
  }

  .menu-wrap {
    position: relative;
    margin-left: 6px;
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

  .menu-rule {
    height: 1px;
    margin: 4px 2px;
    background: var(--pv-line);
  }

  /* The projects as little title pages, as many to a row as there's room for. */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
    gap: 16px;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 176px;
    border: 1px solid transparent;
    border-radius: var(--pv-radius-sm);
    padding: 20px 18px 14px;
    background-color: var(--pv-paper);
    box-shadow: var(--pv-shadow-card);
    color: var(--pv-ink);
    color-scheme: light;
    text-align: left;
  }

  .card:hover {
    border-color: var(--pv-ink-rule-accent);
  }

  .card:active {
    background-color: var(--pv-paper-under);
  }

  .card.current {
    border-color: var(--pv-ink-rule-accent);
  }

  .open {
    position: absolute;
    top: 10px;
    right: 12px;
    font-size: var(--pv-text-xs);
    font-weight: 600;
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
    color: var(--pv-ink-accent);
  }

  .title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    margin-top: 4px;
    font-family: var(--pv-font-heading);
    font-size: 19px;
    line-height: 1.2;
  }

  .card .rule {
    width: 28px;
    height: 1.5px;
    background: var(--pv-ink-rule-accent);
  }

  .writings {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .writing {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--pv-text-md);
    color: var(--pv-ink-2);
  }

  .writing :global(svg) {
    flex: none;
    width: 13px;
    height: 13px;
    color: var(--pv-ink-muted);
  }

  .more {
    font-size: var(--pv-text-sm);
    color: var(--pv-ink-muted);
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: auto;
    font-size: var(--pv-text-sm);
    color: var(--pv-ink-muted);
  }

  .card.new {
    align-items: center;
    justify-content: center;
    flex-direction: row;
    gap: 8px;
    border: 1.5px dashed var(--pv-line-strong);
    background: transparent;
    box-shadow: none;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-base);
  }

  .card.new:hover {
    border-color: var(--pv-accent);
    color: var(--pv-accent);
  }

  .card.new :global(svg) {
    width: 16px;
    height: 16px;
  }

  /* The tree, as beside the page, but with the room Home has. */
  .tree {
    max-width: 640px;
  }

  .chapters {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .num {
    flex: none;
    min-width: 16px;
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
  }

  .chapter-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .chapter-name.untitled {
    font-style: italic;
    color: var(--pv-text-faint);
  }

  .words {
    flex: none;
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
  }

  .error {
    color: var(--pv-danger);
  }

  .load {
    grid-column: 1 / -1;
    margin: 0;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @media (max-width: 1100px) {
    .home {
      grid-template-columns: minmax(0, 1fr);
      padding: 28px 28px 40px;
    }
  }
</style>
