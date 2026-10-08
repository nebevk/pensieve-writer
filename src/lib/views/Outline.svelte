<script lang="ts">
  import { tick } from "svelte";
  import { compactWords, wordsFor } from "$lib/editor/counts";
  import Icon from "$lib/editor/Icon.svelte";
  import { isUntitled } from "$lib/i18n";
  import type { Chapter } from "$lib/model";
  import type { OutlineLayout } from "$lib/prefs";
  import { num, plural, t } from "$lib/ui.svelte";

  let {
    chapters,
    title = "",
    layout = "grid",
    canAdd = true,
    onLayout,
    onUpdate,
    onReorder,
    onOpen,
    onRename,
    onCreate,
  }: {
    chapters: Chapter[];
    /** The writing's name, over its chapters. */
    title?: string;
    /** Cards, or one row each (remembered in Settings). */
    layout?: OutlineLayout;
    /** A writing in chapters can have more; a one-page writing can't. */
    canAdd?: boolean;
    onLayout: (layout: OutlineLayout) => void;
    onUpdate: (id: string, patch: Partial<Chapter>) => void;
    /** The dragged chapter takes the target's place, as in the chapter list. */
    onReorder: (draggedId: string, targetId: string) => void;
    /** The chapter on the page, in Write. */
    onOpen: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onCreate: () => void;
  } = $props();

  // The chapters in order, each with the part it begins (if any) and its words.
  const rows = $derived.by(() => {
    let lastPart = "";
    return [...chapters]
      .sort((a, b) => a.position - b.position)
      .map((chapter, index) => {
        const part = chapter.part.trim();
        const begins = part.length > 0 && part !== lastPart;
        lastPart = part || lastPart;
        return { chapter, index, begins, part, words: wordsFor(chapter.id, chapter.plainText) };
      });
  });
  const totalWords = $derived(rows.reduce((sum, row) => sum + row.words, 0));
  const totalGoal = $derived(rows.reduce((sum, row) => sum + Math.max(0, row.chapter.wordGoal), 0));

  let dragging = $state<string | null>(null);
  // Where a dragged chapter would land: before the target, or after it when moving down.
  let dropOn = $state<{ id: string; after: boolean } | null>(null);
  let renaming = $state<string | null>(null);
  let draft = $state("");
  let awaitingNew = false;
  // The pointer went down in a field, where dragging selects words.
  let fromField = false;
  let known = new Set<string>();

  const indexOf = (id: string) => rows.findIndex((row) => row.chapter.id === id);

  // A chapter made from here is named here: its title field opens as it appears.
  $effect(() => {
    const ids = rows.map((row) => row.chapter.id);
    const fresh = ids.find((id) => !known.has(id));
    known = new Set(ids);
    if (fresh && awaitingNew) {
      awaitingNew = false;
      const row = rows.find((item) => item.chapter.id === fresh);
      if (row) startRename(row.chapter);
    }
  });

  function startRename(chapter: Chapter) {
    renaming = chapter.id;
    draft = isUntitled(chapter.title) ? "" : chapter.title;
    void tick().then(() => {
      const field = document.querySelector<HTMLInputElement>(`.outline [data-id="${CSS.escape(chapter.id)}"] .title-field`);
      field?.scrollIntoView({ block: "nearest" });
      field?.focus();
      field?.select();
    });
  }

  function commitRename(chapter: Chapter) {
    if (renaming !== chapter.id) return;
    renaming = null;
    const name = draft.trim();
    if (name && name !== chapter.title) onRename(chapter.id, name);
  }

  function dragOver(event: DragEvent, id: string) {
    if (!dragging || dragging === id) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    dropOn = { id, after: indexOf(dragging) < indexOf(id) };
  }

  function drop(event: DragEvent, id: string) {
    event.preventDefault();
    const moved = dragging;
    dragging = null;
    dropOn = null;
    if (moved && moved !== id) onReorder(moved, id);
  }

  /** On its handle: Alt+↑ / Alt+↓ (or ↑ / ↓) moves the chapter one place, F2 renames it, Enter opens it. */
  function onItemKey(event: KeyboardEvent, chapter: Chapter) {
    const at = indexOf(chapter.id);
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const other = rows[at + (event.key === "ArrowUp" ? -1 : 1)];
      if (!other) return;
      onReorder(chapter.id, other.chapter.id);
      const handle = event.currentTarget as HTMLElement;
      void tick().then(() => handle.focus());
    } else if (event.key === "F2") {
      event.preventDefault();
      startRename(chapter);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onOpen(chapter.id);
    }
  }

  const progress = (words: number, goal: number) => (goal > 0 ? Math.min(1, words / goal) : 0);
</script>

<section class="outline" class:list={layout === "list"}>
  <header class="head">
    <div class="about">
      <h1>{title}</h1>
      <p>{plural("chapters", rows.length)} · {plural("words", totalWords)}{totalGoal > 0 ? ` / ${num(totalGoal)}` : ""}</p>
    </div>
    <div class="switch" role="radiogroup" aria-label={t("outlineLayout")}>
      <button type="button" role="radio" aria-checked={layout === "grid"} class:on={layout === "grid"} title={t("outlineGrid")} onclick={() => onLayout("grid")}>
        <Icon name="layoutGrid" />{t("outlineGrid")}
      </button>
      <button type="button" role="radio" aria-checked={layout === "list"} class:on={layout === "list"} title={t("outlineList")} onclick={() => onLayout("list")}>
        <Icon name="list" />{t("outlineList")}
      </button>
    </div>
    {#if canAdd}
      <button
        type="button"
        class="add"
        onclick={() => {
          awaitingNew = true;
          onCreate();
        }}
      >
        <Icon name="plus" />{t("newChapterTitle")}
      </button>
    {/if}
  </header>

  <!-- The chapters as cards or rows; each is dragged into its place, or moved with Alt+↑/↓. -->
  <div class="items" role="list" aria-label={t("chapters")}>
    {#each rows as row (row.chapter.id)}
      {@const chapter = row.chapter}
      {#if row.begins}
        <h2 class="part"><Icon name="bookmark" />{row.part}</h2>
      {/if}
      <div
        class="item"
        role="listitem"
        data-id={chapter.id}
        draggable={renaming === chapter.id ? undefined : "true"}
        class:dragging={dragging === chapter.id}
        class:drop-before={dropOn?.id === chapter.id && !dropOn.after}
        class:drop-after={dropOn?.id === chapter.id && dropOn.after}
        onpointerdown={(event) => (fromField = (event.target as HTMLElement).closest("input, textarea") !== null)}
        ondragstart={(event) => {
          // Selecting words in the synopsis or a field never drags the card.
          if (fromField) {
            event.preventDefault();
            return;
          }
          dragging = chapter.id;
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            // Something must travel with the drag for it to start; the id is no text to drop anywhere.
            event.dataTransfer.setData("application/x-pensieve-chapter", chapter.id);
          }
        }}
        ondragover={(event) => dragOver(event, chapter.id)}
        ondragleave={() => {
          if (dropOn?.id === chapter.id) dropOn = null;
        }}
        ondrop={(event) => drop(event, chapter.id)}
        ondragend={() => {
          dragging = null;
          dropOn = null;
        }}
      >
        <button type="button" class="grip" title={t("outlineMoveHint")} aria-label={`${t("outlineMove")}: ${chapter.title}`} onkeydown={(event) => onItemKey(event, chapter)}><Icon name="grip" /></button>
        <span class="num">{row.index + 1}</span>
        {#if renaming === chapter.id}
          <input
            class="title-field"
            bind:value={draft}
            aria-label={t("chapterTitle")}
            placeholder={chapter.title}
            onblur={() => commitRename(chapter)}
            onkeydown={(event) => {
              if (event.key === "Enter") commitRename(chapter);
              else if (event.key === "Escape") renaming = null;
            }}
          />
        {:else}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <h3 class="title" class:untitled={isUntitled(chapter.title)} ondblclick={() => startRename(chapter)}>{chapter.title}</h3>
        {/if}
        <button type="button" class="open" title={t("outlineOpen")} aria-label={`${t("outlineOpen")}: ${chapter.title}`} onclick={() => onOpen(chapter.id)}>
          <Icon name="arrowRight" />
        </button>
        <div class="count">
          <span class="words" class:empty={row.words === 0}>
            {row.words === 0 ? t("statusEmpty") : layout === "list" ? compactWords(row.words) : plural("words", row.words)}{chapter.wordGoal > 0 ? ` / ${layout === "list" ? compactWords(chapter.wordGoal) : num(chapter.wordGoal)}` : ""}
          </span>
          {#if chapter.wordGoal > 0}
            <span class="meter" aria-hidden="true"><span style:width="{progress(row.words, chapter.wordGoal) * 100}%"></span></span>
          {/if}
        </div>
        {#if layout === "list"}
          <input
            class="synopsis line"
            value={chapter.synopsis}
            placeholder={t("synopsisHint")}
            aria-label={t("synopsis")}
            onchange={(event) => onUpdate(chapter.id, { synopsis: (event.currentTarget as HTMLInputElement).value })}
          />
        {:else}
          <textarea
            class="synopsis"
            rows="4"
            value={chapter.synopsis}
            placeholder={t("synopsisHint")}
            aria-label={t("synopsis")}
            onchange={(event) => onUpdate(chapter.id, { synopsis: (event.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
        {/if}
        <div class="fields">
          <label>
            <span>{t("part")}</span>
            <input
              value={chapter.part}
              placeholder="—"
              onchange={(event) => onUpdate(chapter.id, { part: (event.currentTarget as HTMLInputElement).value.trim() })}
            />
          </label>
          <label>
            <span>{t("goalShort")}</span>
            <input
              type="number"
              min="0"
              step="100"
              value={chapter.wordGoal || ""}
              placeholder="—"
              onchange={(event) => onUpdate(chapter.id, { wordGoal: Math.max(0, Math.round(Number((event.currentTarget as HTMLInputElement).value) || 0)) })}
            />
          </label>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .outline {
    height: 100%;
    overflow: auto;
    padding: 18px 24px 40px;
    background: var(--pv-desk);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    max-width: 1200px;
    margin: 0 auto 16px;
  }

  .about {
    flex: 1;
    min-width: 12rem;
  }

  h1 {
    margin: 0;
    font-size: 1.6rem;
    line-height: 1.2;
    color: var(--pv-text);
  }

  .about p {
    margin: 2px 0 0;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
  }

  .switch {
    display: flex;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
  }

  .switch button,
  .add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: var(--pv-text);
    font-size: var(--pv-text-md);
  }

  .switch button :global(svg),
  .add :global(svg) {
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

  .add {
    border-radius: var(--pv-radius-sm);
    background: var(--pv-accent-solid);
    color: var(--pv-on-accent);
    font-weight: 600;
  }

  .add:hover {
    filter: brightness(1.08);
  }

  /* Cards: index cards on the desk, as many to a row as fit. */
  .items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 14px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .part {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0 -2px;
    color: var(--pv-text-muted);
    font-family: var(--pv-font-ui);
    font-size: var(--pv-text-sm);
    font-weight: 600;
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
  }

  .part :global(svg) {
    width: 14px;
    height: 14px;
  }

  .item {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "num title open"
      "count count count"
      "synopsis synopsis synopsis"
      "fields fields fields";
    align-items: center;
    gap: 8px 8px;
    padding: 14px 14px 12px 22px;
    border-radius: var(--pv-radius-sm);
    background: var(--pv-paper);
    color: var(--pv-ink);
    box-shadow: var(--pv-shadow-card);
    cursor: grab;
  }


  .item.dragging {
    opacity: 0.45;
  }

  /* Where the dragged chapter would land: a line before or after this one. */
  .item.drop-before::before,
  .item.drop-after::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 2px;
    background: var(--pv-accent);
  }

  .item.drop-before::before {
    left: -9px;
  }

  .item.drop-after::after {
    right: -9px;
  }

  .grip {
    position: absolute;
    top: 12px;
    left: 2px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-ink-meta);
    opacity: 0.6;
    cursor: grab;
  }

  .grip:focus-visible {
    opacity: 1;
    outline-offset: 0;
  }

  .grip :global(svg) {
    width: 14px;
    height: 14px;
  }

  .item:hover .grip {
    opacity: 1;
  }

  .num {
    grid-area: num;
    min-width: 1.2em;
    color: var(--pv-ink-meta);
    font-size: var(--pv-text-sm);
  }

  .title,
  .title-field {
    grid-area: title;
    min-width: 0;
    margin: 0;
    font-family: var(--pv-font-manuscript);
    font-size: 1.2rem;
    font-weight: 400;
    line-height: 1.25;
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }

  .title.untitled {
    color: var(--pv-ink-meta);
    font-style: italic;
  }

  .title-field {
    width: 100%;
    padding: 2px 6px;
    border: 1px solid var(--pv-accent);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-ink);
  }

  .open {
    grid-area: open;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-ink-accent);
  }

  .open :global(svg) {
    width: 15px;
    height: 15px;
  }

  .open:hover {
    background: var(--pv-ink-chip);
  }

  .count {
    grid-area: count;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .words {
    color: var(--pv-ink-muted);
    font-size: var(--pv-text-sm);
  }

  .words.empty {
    font-style: italic;
  }

  .meter {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: var(--pv-ink-rule);
    overflow: hidden;
  }

  .meter span {
    display: block;
    height: 100%;
    background: var(--pv-ink-success);
  }

  .synopsis {
    grid-area: synopsis;
    width: 100%;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: var(--pv-radius-xs);
    background: var(--pv-ink-chip);
    color: var(--pv-ink);
    font: inherit;
    font-size: var(--pv-text-md);
    line-height: 1.45;
    resize: vertical;
    cursor: text;
  }

  .synopsis::placeholder {
    color: var(--pv-ink-meta);
    font-style: italic;
  }

  .synopsis:focus {
    border-color: var(--pv-ink-rule-accent);
    outline: none;
  }

  .fields {
    grid-area: fields;
    display: flex;
    gap: 10px;
  }

  .fields label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--pv-ink-muted);
    font-size: var(--pv-text-sm);
  }

  .fields label:first-child {
    flex: 1;
  }

  .fields input {
    min-width: 0;
    width: 100%;
    padding: 2px 6px;
    border: 1px solid transparent;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-ink);
    font: inherit;
  }

  .fields label:last-child input {
    width: 5.5em;
  }

  .fields input:hover,
  .fields input:focus {
    border-color: var(--pv-ink-rule);
    background: var(--pv-ink-chip);
    outline: none;
  }

  /* The list: one row each, the synopsis on one line. */
  .list .items {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .list .part {
    margin: 12px 0 2px;
  }

  .list .item {
    grid-template-columns: 2em minmax(8rem, 15rem) minmax(0, 1fr) 7rem 13rem 26px;
    grid-template-areas: "num title synopsis count fields open";
    gap: 12px;
    padding: 6px 10px 6px 24px;
    box-shadow: var(--pv-shadow-slip);
  }

  .list .grip {
    top: 50%;
    transform: translateY(-50%);
  }

  .list .title,
  .list .title-field {
    font-size: 1rem;
  }

  .list .synopsis {
    padding: 3px 8px;
    background: transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .list .synopsis:hover,
  .list .synopsis:focus {
    background: var(--pv-ink-chip);
  }

  .list .item.drop-before::before,
  .list .item.drop-after::after {
    top: auto;
    bottom: auto;
    left: 0;
    right: 0;
    width: auto;
    height: 3px;
  }

  .list .item.drop-before::before {
    top: -4px;
  }

  .list .item.drop-after::after {
    bottom: -4px;
  }

  /* A narrow window: the list's rows give up the part and goal fields' room first. */
  @media (max-width: 1100px) {
    .list .item {
      grid-template-columns: 2em minmax(8rem, 14rem) minmax(0, 1fr) 6rem 26px;
      grid-template-areas: "num title synopsis count open";
    }

    .list .fields {
      display: none;
    }
  }
</style>
