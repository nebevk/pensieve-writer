<script lang="ts">
  import { pageAt } from "$lib/views/pageOf";
  import { summarize, type ProjectSummary } from "$lib/chapters/progress";
  import { compactWords, wordsFor } from "$lib/editor/counts";
  import { roman } from "$lib/chapters/labels";
  import Library from "$lib/chapters/Library.svelte";
  import TreeMenu, { type MenuItem } from "$lib/chapters/TreeMenu.svelte";
  import { isInside, type LibraryActions, type LibraryView } from "$lib/chapters/library";
  import type { AmbienceName, KnownProject, OutlineLayout, Prefs, ThemeName } from "$lib/prefs";
  import type { Chapter, Writing } from "$lib/model";
  import { isUntitled, type UiKey } from "$lib/i18n";
  import { ago, agoCapital, locale, num, plural, t, ui } from "$lib/ui.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import { WRITER } from "$lib/writer";
  import { randomVerse, verse } from "$lib/quotes";
  import { encouragementFor } from "$lib/encouragement";
  import type { Task } from "$lib/storage/organize";
  import ChecklistItem from "./ChecklistItem.svelte";
  import BrandMark from "$lib/editor/BrandMark.svelte";
  import EmptyState from "./EmptyState.svelte";

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
    onStartProject,
    onOpenBook,
    onOpenTodos,
    onAmbience,
    tasks = [],
    onToggleTask,
    loadError = "",
    currentPath = "",
    books = [],
    appearance = "daylight",
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
    onStartProject: () => void;
    onOpenBook: (path: string) => void;
    onOpenTodos: () => void;
    /** Opens Settings at the ambience. */
    onAmbience: () => void;
    /** The project's to-dos, the store's (notes.svelte.ts), and a to-do ticked on to its next state. */
    tasks?: Task[];
    onToggleTask: (task: Task) => void;
    /** Why the project's notes and to-dos couldn't be read. */
    loadError?: string;
    currentPath?: string;
    books?: KnownProject[];
    /** The look on now, for the large mark's colours. */
    appearance?: Exclude<ThemeName, "sunset">;
  } = $props();

  // A short verse for Eva under her greeting, a different one each time Home opens, in her language.
  const verseAt = randomVerse();
  const quote = $derived(verse(verseAt, ui.language));
  // A few words of encouragement after her greeting, for the time of day, a different line each time Home opens.
  const cheer = encouragementFor(new Date().getHours());
  const SOUNDS: Record<Exclude<AmbienceName, "off">, { key: UiKey; icon: string }> = {
    rain: { key: "soundRain", icon: "rain" },
    fire: { key: "soundFireplace", icon: "fireplace" },
    cafe: { key: "soundCafe", icon: "coffee" },
    piano: { key: "soundPiano", icon: "music" },
  };
  // A short list on Home; the rest are a link away.
  const TODOS_SHOWN = 5;


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
  // The card's running head: the writing; its chapter in Roman numerals, as the page's own running head writes
  // them (a writing of one page has none); and the page her last line is on, as Write's sheets count it (HOME-11).
  const runningHead = $derived.by(() => {
    const parts = [writing.title];
    if (latest && writing.split) parts.push(t("chapterShort", { n: roman(chapters.findIndex((chapter) => chapter.id === latest.id) + 1) }));
    if (latest && currentLine) parts.push(t("pageShort", { n: pageAt(latest.plainText.trimEnd().length - 1) }));
    return parts.join(" · ");
  });
  const otherBooks = $derived(books.filter((book) => book.path.toLowerCase() !== currentPath.toLowerCase()));

  // A card's menu, as the library's row has it for the same project.
  let cardMenu = $state<{ x: number; y: number; items: MenuItem[]; back: HTMLElement | null } | null>(null);
  const inLibrary = (path: string) => !!library.root && isInside(path, library.root);

  /** Asks before a project of the library goes to the Recycle Bin, as the library does. */
  function askToDelete(path: string, title: string, back: HTMLElement | null, at: { x: number; y: number }) {
    cardMenu = {
      ...at,
      back,
      items: [
        { text: t("deleteProjectQuestion", { title }) },
        "rule",
        { label: t("toRecycleBin"), danger: true, run: () => actions.deleteProject(path) },
        { label: t("cancel"), run: () => undefined },
      ],
    };
  }

  /** A project card's menu (owner, 13 October): open it, show it in Explorer, and delete it or take it off the list. */
  function openCardMenu(path: string, title: string, current: boolean, open: () => void, back: HTMLElement | null, at: { x: number; y: number }) {
    const items: MenuItem[] = [
      { label: t("openItem"), run: open },
      { label: t("showInExplorer"), run: () => actions.showInExplorer(path) },
    ];
    // Never the open project; one kept elsewhere only leaves the list, its files where they are.
    if (inLibrary(path)) {
      items.push("rule", { label: t("deleteProject"), keys: "Del", danger: true, disabled: current, run: () => askToDelete(path, title, back, at) });
    } else if (!current) {
      items.push("rule", { label: t("removeFromList"), run: () => actions.forgetProject(path) });
    }
    cardMenu = { ...at, back, items };
  }

  /** The menu key or Shift+F10 opens a card's menu where the keyboard is; Del asks to delete it. */
  function cardKeys(event: KeyboardEvent, path: string, title: string, current: boolean, open: () => void) {
    const card = event.currentTarget as HTMLElement;
    const box = card.getBoundingClientRect();
    const at = { x: box.left + 24, y: box.bottom };
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      openCardMenu(path, title, current, open, card, at);
    } else if (event.key === "Delete" && inLibrary(path) && !current) {
      event.preventDefault();
      askToDelete(path, title, card, at);
    }
  }
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

  /** "Good evening, Eva." (HOME-10), by the time of day; late at night it's "Late again, Eva." */
  function hello(at: number): string {
    const hour = new Date(at).getHours();
    const word = hour >= 23 || hour < 5 ? t("lateAgain") : hour < 12 ? t("morning") : hour < 18 ? t("afternoon") : t("evening");
    return `${word}, ${WRITER}.`;
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

</script>

<!-- A project as a little title page: its name, its writings, their words, when it was last written in. -->
{#snippet card(title: string, project: ProjectSummary | undefined, current: boolean, path: string, onclick: () => void)}
  <button
    type="button"
    class="card project"
    class:current
    {onclick}
    oncontextmenu={(event) => {
      if (!path) return;
      event.preventDefault();
      openCardMenu(path, title, current, onclick, event.currentTarget, { x: event.clientX, y: event.clientY });
    }}
    onkeydown={(event) => path && cardKeys(event, path, title, current, onclick)}
  >
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

<!-- The open writing's chapters in the table, each opening in Write; the one Continue opens is lit. -->
{#snippet chapterRows(depth: number)}
  <ul class="chapters">
    {#each chapters as chapter, index (chapter.id)}
      <li>
        <button type="button" class="tree-row chapter" class:latest={chapter.id === latest?.id} style:--depth={depth} title={chapter.title} onclick={() => onContinue(chapter.id)}>
          <span class="twist" aria-hidden="true"></span>
          <span class="num">{roman(index + 1)}</span>
          <span class="chapter-name" class:untitled={isUntitled(chapter.title)}>{chapter.title}</span>
          <span class="meta"></span>
          <span class="col-words">{num(wordsFor(chapter.id, chapter.plainText))}</span>
          <span class="col-edited">{agoCapital(chapter.updatedAt)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

<!-- Home (owner, 12 October): on the left the greeting, what she wrote last and her to-dos; on the right her projects. -->
<section class="home">
  <div class="left">
    <div class="intro">
      <div class="hero">
        <!-- The large mark (owner's design, 13 October): it moves, except in Gentle mode. -->
        <span class="glow" aria-hidden="true"><BrandMark {appearance} size={136} animated={!prefs.gentle} /></span>
        <div class="hello">
          <p class="date">
            {new Date(now).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })} ·
            {new Date(now).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}
          </p>
          <!-- The verse first and large beside the mark (owner, 13 October); a long one a little smaller, so it stays a few lines. -->
          <blockquote class="verse" class:short={quote.text.length <= 45} class:long={quote.text.length > 75}>
            <p>{quote.text}</p>
            <footer>{quote.reference}</footer>
          </blockquote>
          <!-- Then her greeting, small and in line with the verse, with a few words of encouragement where the chapter waiting was. -->
          <h1 class="greeting"><strong>{hello(now)}</strong> {cheer[ui.language]}</h1>
        </div>
      </div>
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
          <span>{runningHead}</span>
          <span class="edited">{latest ? t("editedAgo", { ago: ago(latest.updatedAt) }) : ""}</span>
        </div>
        <div class="excerpt">
          <p>{currentLine ? clip(currentLine, 160) : t("blankPage")}<span class="caret" aria-hidden="true"></span></p>
        </div>
        <div class="foot">
          <p class="sound">
            <Icon name={sound?.icon ?? "volumeX"} />
            <span>{sound ? t("ambienceStarts", { sound: t(sound.key) }) : t("ambienceSilent")} ·</span>
            <button type="button" onclick={onAmbience}>{t("change")}</button>
          </p>
          <!-- The two buttons stay together: short of room, they go under the sound, not into it. -->
          <span class="buttons">
            <button type="button" class="zen" onclick={() => onZen(latest?.id ?? null)}><Icon name="moon" />{t("zen")}</button>
            <button type="button" class="go" onclick={() => onContinue(latest?.id ?? null)}>{t("continue")} <Icon name="arrowRight" /></button>
          </span>
        </div>
      </div>
    </div>

    <div class="todos">
      <div class="head">
        <h2>{t("openTodosFilter")}</h2>
        <span class="count">{openTasks.length}</span>
        <button type="button" class="link" onclick={onOpenTodos}>{t("allTodos")}</button>
      </div>
      {#each openTasks.slice(0, TODOS_SHOWN) as task (task.id)}
        <ChecklistItem text={task.title} state={task.todoState} truncate flush onToggle={() => onToggleTask(task)} />
      {:else}
        <EmptyState kind="tasks" size="row" text={t("noOpenTodos")} />
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
      <!-- The design's button (12 October); another project from elsewhere opens from the library's +. -->
      <button type="button" class="new" onclick={onStartProject}><Icon name="plus" />{t("newProjectTitle")}</button>
    </div>

    {#if layout === "list"}
      <!-- The library's own tree: folders, projects, writings, notes and her files, as beside the page. -->
      <div class="tree">
        <Library
          table
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
        {@render card(projectTitle || writing.title, openSummary, true, currentPath, () => onContinue(null))}
        {#each otherBooks as book (book.path)}
          {@render card(book.title, book.summary, false, book.path, () => onOpenBook(book.path))}
        {/each}
        <button type="button" class="card new" onclick={onStartProject}>
          <Icon name="plus" />{t("newProjectTitle")}
        </button>
      </div>
    {/if}
  </div>

  {#if loadError}
    <p class="error load" role="alert">{loadError}</p>
  {/if}
</section>

{#if cardMenu}
  <!-- A question that takes the menu's place is a menu of its own, as in the library. -->
  {#key cardMenu}
    <TreeMenu
      x={cardMenu.x}
      y={cardMenu.y}
      items={cardMenu.items}
      onClose={() => {
        const back = cardMenu?.back;
        cardMenu = null;
        // Once the menu is gone, the card that opened it gets the keyboard back, unless the choice took it elsewhere.
        setTimeout(() => {
          if (back?.isConnected && (document.activeElement === document.body || !document.activeElement)) back.focus();
        });
      }}
    />
  {/key}
{/if}

<style>
  /* Two columns: hers on the left, her projects on the right; one under the other on a narrow window. */
  .home {
    flex: 1;
    min-height: 0;
    overflow: auto;
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 48px;
    padding: 30px 56px 40px;
    color: var(--pv-text);
  }

  .left {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  .right {
    min-width: 0;
  }

  .intro {
    display: flex;
    flex-direction: column;
  }

  /* The large mark, and the greeting beside it (owner's design, 13 October). */
  .hero {
    display: flex;
    align-items: center;
    gap: 22px;
  }

  /*
   * A soft light round the mark, in the look's accent; it reaches past the column, as light does. The mark's
   * basin starts 13 of its 100 units in: the light moves out so the basin stands on the column's left edge.
   */
  .glow {
    display: grid;
    place-items: center;
    flex: none;
    width: 184px;
    height: 184px;
    margin: -24px -6px -24px -42px;
    border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--pv-accent) 17%, transparent), color-mix(in srgb, var(--pv-accent) 6%, transparent) 72%, transparent);
  }

  .hello {
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

  /* The verse, large beside the mark (owner, 13 October): a short one larger, a long one smaller. */
  .verse {
    margin: 10px 0 0;
  }

  .verse p {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: 28px;
    font-weight: 400;
    line-height: 1.2;
    color: var(--pv-text);
    text-wrap: balance;
  }

  .verse.short p {
    font-size: 32px;
  }

  .verse.long p {
    font-size: 23px;
    line-height: 1.25;
  }

  /* Her greeting, small under the verse, the hello a little stronger than the words of encouragement. */
  .greeting {
    margin: 14px 0 0;
    font-family: var(--pv-font-manuscript);
    font-size: 17px;
    font-weight: 400;
    line-height: 1.5;
    color: var(--pv-text-2);
    text-wrap: pretty;
  }

  .greeting strong {
    font-weight: 600;
    color: var(--pv-text);
  }

  .verse footer {
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
    min-height: 228px;
    padding: 26px 34px 24px;
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
    gap: 16px;
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-running);
    text-transform: uppercase;
    color: var(--pv-ink-meta);
  }

  .running .edited {
    flex: none;
    letter-spacing: 0;
    text-transform: none;
    font-size: 12px;
    color: var(--pv-ink-muted);
  }

  .excerpt {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 18px 0;
    font-family: var(--pv-font-manuscript);
    font-size: 16px;
    line-height: 1.7;
  }

  .excerpt p {
    margin: 0;
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
    padding-top: 16px;
    border-top: 1px solid var(--pv-ink-rule);
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

  /* The sound that starts with writing, on the card's paper; one line, the buttons wrap below it rather than squeeze it. */
  .sound {
    flex: 1 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    white-space: nowrap;
    color: var(--pv-ink-muted);
  }

  .sound :global(svg) {
    flex: none;
    width: 13px;
    height: 13px;
  }

  .sound button {
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-ink-accent);
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

  /* Grid or List: a soft track, the chosen one raised on it in the page's colour, as the theme switch. */
  .switch {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 6px;
    background: var(--pv-selected);
  }

  .switch button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-text-subtle);
    font-size: 13px;
  }

  .switch button :global(svg) {
    width: 14px;
    height: 14px;
  }

  /* The page's colours, ink on paper, so it reads in the dark looks too. */
  .switch button.on {
    background: var(--pv-paper);
    color: var(--pv-ink);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(60, 45, 30, 0.18);
  }

  .switch button.on :global(svg) {
    color: var(--pv-ink-accent);
  }

  .switch button:not(.on):hover {
    color: var(--pv-text);
  }

  .new {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    margin-left: 4px;
    padding: 0 14px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .new :global(svg) {
    width: 15px;
    height: 15px;
    color: var(--pv-accent);
  }

  .new:hover {
    background: var(--pv-selected);
  }

  .new:active {
    background: var(--pv-pressed);
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
  .chapters {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* The chapter's number in Roman, as its running head writes it. */
  .num {
    flex: none;
    min-width: 14px;
    font-family: var(--pv-font-heading);
    font-size: 13px;
    color: var(--pv-accent);
  }

  .chapter-name {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .chapter-name.untitled {
    font-style: italic;
    color: var(--pv-text-faint);
  }

  /* The chapter Continue opens. */
  .tree-row.latest {
    background-color: color-mix(in srgb, var(--pv-accent) 10%, transparent);
  }

  .tree-row.latest .chapter-name {
    font-weight: 600;
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
