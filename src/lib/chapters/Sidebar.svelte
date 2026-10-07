<script lang="ts">
  import type { Chapter } from "$lib/model";
  import type { SidebarView } from "$lib/prefs";
  import Library from "./Library.svelte";
  import TreeMenu, { type MenuItem } from "./TreeMenu.svelte";
  import type { LibraryActions, LibraryView } from "./library";
  import { compactWords, wordsFor } from "$lib/editor/counts";
  import { isUntitled, type UiKey } from "$lib/i18n";
  import { t } from "$lib/ui.svelte";
  import Icon from "$lib/editor/Icon.svelte";

  let {
    chapters,
    activeId,
    collapsed,
    hidden = false,
    article = false,
    onSelect,
    onCreate,
    onRename,
    onDuplicate,
    onDelete,
    onReorder,
    onHistory,
    onHide,
    view,
    onView,
    library,
    actions,
    writingId,
    writingTitle,
    writingSplit,
    writingWords,
  }: {
    chapters: Chapter[];
    activeId: string | null;
    collapsed: boolean;
    hidden?: boolean;
    /** A one-page writing: no chapter rows or "+" in the library, and no Chapters tab. */
    article?: boolean;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string, title: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onReorder: (draggedId: string, targetId: string) => void;
    onHistory: () => void;
    /** Folds the list away; the toolbar's Chapters button brings it back. */
    onHide: () => void;
    /** What the list shows: the open writing's chapters, or the library of projects. */
    view: SidebarView;
    onView: (view: SidebarView) => void;
    library: LibraryView;
    actions: LibraryActions;
    /** The open writing, apart from the library, so typing in it doesn't redraw the whole tree. */
    writingId: string;
    writingTitle: string;
    writingSplit: boolean;
    writingWords: number;
  } = $props();

  // A one-page writing has no chapter list: the library shows beside it whichever tab was chosen.
  const shown = $derived(article ? "library" : view);
  // What the header asked the tree to name: a new writing in the open project, or a new project.
  let createRequest = $state<{ kind: "writing" | "project"; at: number } | null>(null);
  // A chapter's menu in the tree, from a right-click or the menu key.
  let chapterMenu = $state<{ x: number; y: number; items: MenuItem[]; back: HTMLElement | null } | null>(null);

  function openChapterMenu(chapter: Chapter, element: HTMLElement, event?: MouseEvent) {
    const box = element.getBoundingClientRect();
    const at = event ? { x: event.clientX, y: event.clientY } : { x: box.left + 24, y: box.bottom };
    const items: MenuItem[] = [
      { label: t("rename"), keys: "F2", run: () => beginRename(chapter) },
      { label: t("duplicate"), run: () => onDuplicate(chapter.id) },
      { label: t("earlierVersions"), run: onHistory },
      "rule",
      {
        label: t("delete"),
        danger: true,
        disabled: chapters.length < 2,
        run: () => {
          chapterMenu = {
            ...at,
            back: element,
            items: [
              { text: t("deleteQuestion", { title: chapter.title }) },
              "rule",
              { label: t("delete"), danger: true, run: () => onDelete(chapter.id) },
              { label: t("cancel"), run: () => undefined },
            ],
          };
        },
      },
    ];
    chapterMenu = { ...at, items, back: element };
  }

  let editingId = $state<string | null>(null);
  let draftTitle = $state("");
  let renameInput = $state<HTMLInputElement | undefined>(undefined);
  let skipCommit = false;
  let confirmDelete = $state(false);
  let draggingId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);
  let previousActiveId = $state<string | null | undefined>(undefined);
  // Parts folded away in the library's tree, by name.
  let foldedParts = $state(new Set<string>());

  const STATUS: Record<Chapter["status"], UiKey> = { draft: "statusDraft", revised: "statusRevised", final: "statusFinal" };

  const active = $derived(chapters.find((chapter) => chapter.id === activeId) ?? null);
  const rows = $derived.by(() => {
    const ordered = [...chapters].sort((a, b) => a.position - b.position);
    let lastPart = "";
    // The part a chapter is read in: the last one begun before it, as in Word, where a part runs until the next.
    let group = "";
    return ordered.map((chapter, index) => {
      const part = chapter.part.trim();
      const showPart = part.length > 0 && part !== lastPart;
      lastPart = part;
      if (part) group = part;
      return { chapter, index, showPart, part, group };
    });
  });

  $effect(() => {
    if (previousActiveId === undefined) {
      previousActiveId = activeId;
      return;
    }
    if (activeId === previousActiveId) return;
    previousActiveId = activeId;
    confirmDelete = false;
  });

  $effect(() => {
    if (editingId && renameInput) renameInput.focus();
  });

  function beginRename(chapter: Chapter) {
    editingId = chapter.id;
    draftTitle = chapter.title;
    skipCommit = false;
  }

  function commitRename() {
    if (skipCommit) {
      skipCommit = false;
      editingId = null;
      return;
    }
    if (!editingId) return;
    const id = editingId;
    const title = draftTitle.trim() || t("untitled");
    editingId = null;
    onRename(id, title);
  }

  function togglePart(part: string) {
    const next = new Set(foldedParts);
    if (next.has(part)) next.delete(part);
    else next.add(part);
    foldedParts = next;
  }

  function onRenameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      skipCommit = true;
      editingId = null;
    }
  }
</script>

{#if !hidden}
<aside class="sidebar" inert={collapsed}>
  <div class="sidebar-inner">
    <div class="sidebar-head">
      <div class="views" role="tablist" aria-label={t("sidebarViews")}>
        {#if !article}
          <button type="button" role="tab" aria-selected={view === "chapters"} class:on={view === "chapters"} onclick={() => onView("chapters")}>{t("chapters")}</button>
        {/if}
        <button type="button" role="tab" aria-selected={shown === "library"} class:on={shown === "library"} onclick={() => onView("library")}>{t("library")}</button>
      </div>
      {#if shown === "library"}
        <button type="button" class="new-writing" title={t("newWritingTitle")} aria-label={t("newWritingTitle")} onclick={() => (createRequest = { kind: "writing", at: Date.now() })}><Icon name="newNote" /></button>
        <button type="button" class="new-project" title={t("newProjectTitle")} aria-label={t("newProjectTitle")} onclick={() => (createRequest = { kind: "project", at: Date.now() })}><Icon name="folderPlus" /></button>
        <button type="button" class="open-book" title={t("open")} aria-label={t("open")} onclick={actions.openAnother}><Icon name="folderOpen" /></button>
      {:else if !article}
        <button type="button" class="add" title={t("newChapterTitle")} aria-label={t("newChapterTitle")} onclick={onCreate}><Icon name="plus" /></button>
      {/if}
      <button type="button" class="hide" title={t(shown === "library" ? "hideLibrary" : "hideChapters")} aria-label={t(shown === "library" ? "hideLibrary" : "hideChapters")} onclick={onHide}><Icon name="panelLeftClose" /></button>
    </div>
    <!-- With a depth, the rows are part of the library's tree: each is indented by its depth, and parts fold. -->
    {#snippet chapterRows(depth: number | null)}
    <ul class:tree={depth !== null}>
      {#each rows as row (row.chapter.id)}
        {@const chapter = row.chapter}
        {@const words = wordsFor(chapter.id, chapter.plainText)}
        {@const inTree = depth === null ? undefined : depth + (row.group ? 1 : 0)}
        {#if row.showPart}
          {#if depth === null}
            <li class="part">{row.part}</li>
          {:else}
            {@const open = !foldedParts.has(row.part)}
            <li>
              <button type="button" class="tree-row" style:--depth={depth} aria-expanded={open} onclick={() => togglePart(row.part)}>
                <span class="twist" class:open aria-hidden="true"><Icon name="chevronRight" /></span>
                <span class="tree-icon" aria-hidden="true"><Icon name="bookmark" /></span>
                <span class="name">{row.part}</span>
              </button>
            </li>
          {/if}
        {/if}
        {#if depth === null || !row.group || !foldedParts.has(row.group)}
          <li
            class:drop-target={dropTargetId === chapter.id}
            ondragover={(event) => {
              // Only a chapter lands here; something else dragged in the library passes over.
              if (!draggingId) return;
              event.preventDefault();
              dropTargetId = chapter.id;
            }}
            ondrop={() => {
              if (draggingId) onReorder(draggingId, chapter.id);
              draggingId = null;
              dropTargetId = null;
            }}
          >
            {#if editingId === chapter.id}
              <input
                bind:this={renameInput}
                bind:value={draftTitle}
                style:--depth={inTree}
                aria-label={t("chapterTitle")}
                onblur={commitRename}
                onkeydown={onRenameKeydown}
              />
            {:else}
              <button
                type="button"
                draggable="true"
                class:tree-row={depth !== null}
                class:active={chapter.id === activeId}
                style:--depth={inTree}
                title={depth === null ? undefined : chapter.title}
                onclick={() => onSelect(chapter.id)}
                ondblclick={() => beginRename(chapter)}
                oncontextmenu={(event) => {
                  if (depth === null) return;
                  event.preventDefault();
                  openChapterMenu(chapter, event.currentTarget, event);
                }}
                onkeydown={(event) => {
                  if (depth === null) return;
                  if (event.key === "F2") {
                    event.preventDefault();
                    beginRename(chapter);
                  } else if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
                    event.preventDefault();
                    openChapterMenu(chapter, event.currentTarget);
                  }
                }}
                ondragstart={() => (draggingId = chapter.id)}
                ondragend={() => {
                  draggingId = null;
                  dropTargetId = null;
                }}
              >
                {#if depth !== null}<span class="twist" aria-hidden="true"></span>{/if}
                <span class="num">{row.index + 1}</span>
                <span class="name" class:untitled={isUntitled(chapter.title)}>{chapter.title}</span>
                <span class="dot" class:final={chapter.status === "final"} class:revised={chapter.status === "revised"} class:empty={!chapter.plainText.trim()} aria-label={t(STATUS[chapter.status])}></span>
                <!-- The tree keeps to the words; the goal is in the chapter list and the Goals list. -->
                <span class="count">{compactWords(words)}{depth === null && chapter.wordGoal > 0 ? `/${compactWords(chapter.wordGoal)}` : ""}</span>
              </button>
            {/if}
          </li>
        {/if}
      {/each}
    </ul>
    {/snippet}
    {#if shown === "library"}
      <Library {library} {actions} {createRequest} {writingId} {writingTitle} {writingSplit} {writingWords} chapterRows={article ? undefined : chapterRows} />
      {#if chapterMenu}
        {#key chapterMenu}
          <TreeMenu
            x={chapterMenu.x}
            y={chapterMenu.y}
            items={chapterMenu.items}
            onClose={() => {
              const back = chapterMenu?.back;
              chapterMenu = null;
              setTimeout(() => {
                if (back?.isConnected && (document.activeElement === document.body || !document.activeElement)) back.focus();
              });
            }}
          />
        {/key}
      {/if}
    {:else}
    {@render chapterRows(null)}
    <!-- What the dots mean, as at the foot of the design's chapter list. -->
    <div class="legend" aria-hidden="true">
      <span><span class="dot final"></span>{t("statusFinal")}</span>
      <span><span class="dot revised"></span>{t("statusRevised")}</span>
      <span><span class="dot"></span>{t("statusDraft")}</span>
    </div>
    <!-- A part begins where a Heading 1 is on the page, and the word goal is in the Goals list beside it. -->
    <div class="chapter-actions">
      <button type="button" disabled={!active} onclick={() => active && onDuplicate(active.id)}>
        {t("duplicate")}
      </button>
      <button type="button" disabled={!active} onclick={onHistory}>{t("earlierVersions")}</button>
      <button
        type="button"
        disabled={!active || chapters.length < 2}
        title={chapters.length < 2 ? t("keepsOneChapter") : t("deleteChapter")}
        onclick={() => (confirmDelete = true)}
      >
        {t("delete")}
      </button>
    </div>
    {#if confirmDelete && active}
      <div class="confirm">
        <p>{t("deleteQuestion", { title: active.title })}</p>
        <button type="button" class="danger" onclick={() => onDelete(active.id)}>{t("delete")}</button>
        <button type="button" onclick={() => (confirmDelete = false)}>{t("cancel")}</button>
      </div>
    {/if}
    {/if}
  </div>
</aside>
{/if}

<style>
  .sidebar {
    min-width: 0;
    overflow: hidden;
    background: var(--pv-chrome);
    color: var(--pv-text);
  }

  .sidebar-inner {
    width: var(--pv-sidebar-w);
    height: 100%;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--pv-line);
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 14px 12px 8px;
  }

  .sidebar-head button,
  li button,
  li input {
    border: 0;
    background: transparent;
    border-radius: var(--pv-radius-xs);
  }

  .sidebar-head button {
    display: grid;
    place-items: center;
    padding: 3px;
    color: var(--pv-accent);
    font-size: var(--pv-text-md);
  }

  .sidebar-head button :global(svg) {
    width: 16px;
    height: 16px;
  }

  .sidebar-head .hide {
    color: var(--pv-text-subtle);
  }

  /* Chapters or the library, as two quiet tabs. */
  .views {
    display: flex;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .sidebar-head .views button {
    display: block;
    padding: 3px 7px;
    color: var(--pv-text-muted);
    font-size: var(--pv-text-md);
  }

  .sidebar-head .views button.on {
    background: var(--pv-selected);
    color: var(--pv-text);
    font-weight: 600;
  }

  .sidebar-head .hide :global(svg) {
    width: 15px;
    height: 15px;
  }

  .sidebar-head .open-book,
  .sidebar-head .new-project {
    color: var(--pv-text-subtle);
  }

  /* Colours only, so a row of the library's tree keeps its guides. */
  .sidebar-head button:hover,
  li button:hover {
    background-color: var(--pv-selected);
  }

  .sidebar-head button:active,
  li button:active {
    background-color: var(--pv-pressed);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0 8px;
    overflow: auto;
    flex: 1;
  }

  /* Under the open book in the library, the chapters are rows of the tree (see Library.svelte). */
  ul.tree {
    flex: none;
    overflow: visible;
    padding: 0;
  }

  /* A chapter's number stands where a file's icon would. */
  ul.tree .num {
    width: 16px;
    text-align: center;
  }

  ul.tree .count {
    width: auto;
    margin-left: 2px;
  }

  /* Renaming in the tree: the field starts where the chapter's number does (past the indent and the arrow's place). */
  ul.tree li input {
    height: 24px;
    margin-left: calc(22px + var(--depth, 0) * 10px);
    width: calc(100% - 22px - var(--depth, 0) * 10px);
    padding: 0 6px;
  }

  li button,
  li input {
    width: 100%;
    text-align: left;
    padding: 7px 8px;
  }

  li button {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--pv-text-base);
    color: var(--pv-text);
  }

  li button.active,
  li.drop-target button {
    background-color: var(--pv-selected);
    font-weight: 600;
  }

  .num,
  .count {
    color: var(--pv-text-faint);
    font-weight: 400;
    font-size: var(--pv-text-sm);
  }

  .num {
    width: 14px;
    font-size: 11px;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A chapter without a title of its own, as the design draws it. */
  .name.untitled {
    font-style: italic;
    color: var(--pv-text-faint);
  }

  .legend {
    display: flex;
    /* A long label moves to the next row whole: Slovenian's "V popravljanju" doesn't fit one row. */
    flex-wrap: wrap;
    gap: 4px 12px;
    padding: 8px 20px 4px;
    font-size: 11px;
    color: var(--pv-text-subtle);
  }

  .legend > span {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .count {
    width: 28px;
    text-align: right;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    box-sizing: border-box;
    border: 1.5px solid var(--pv-text-faint);
    flex: none;
  }

  .dot.final {
    background: var(--pv-status-final);
    border: 0;
  }

  .dot.revised {
    background: var(--pv-accent);
    border: 0;
  }

  .dot.empty {
    border-color: var(--pv-empty);
    background: transparent;
  }

  li input {
    background: var(--pv-field);
    border: 1px solid var(--pv-line-strong);
    color: var(--pv-text);
  }

  li.part {
    padding: 0.45rem 0.2rem 0.1rem;
    font-size: var(--pv-text-xs);
    font-weight: 600;
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
    color: var(--pv-text-faint);
  }

  .chapter-actions,
  .confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem 0;
  }

  .chapter-actions button,
  .confirm button {
    border: 1px solid transparent;
    background: transparent;
    border-radius: var(--pv-radius-xs);
    padding: 0.2rem 0.4rem;
    color: var(--pv-text-muted);
    font-size: var(--pv-text-md);
  }

  .chapter-actions button:hover:not(:disabled),
  .confirm button:hover {
    background: var(--pv-selected);
  }

  .chapter-actions button:active:not(:disabled),
  .confirm button:active {
    background: var(--pv-pressed);
  }

  .chapter-actions button:disabled {
    opacity: 0.4;
  }

  .confirm {
    flex-wrap: wrap;
    align-items: center;
  }

  .confirm p {
    margin: 0;
    width: 100%;
    color: var(--pv-text);
    font-size: var(--pv-text-md);
  }

  .confirm .danger {
    color: var(--pv-danger);
  }
</style>
