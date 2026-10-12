<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import { plural, t } from "$lib/ui.svelte";
  import { searchProjects, type SearchPlace, type SearchSource } from "./searchAll";

  let {
    initial = "",
    openPath,
    load,
    onOpen,
    onClose,
  }: {
    /** What to look for to start with: the find bar's words, say. */
    initial?: string;
    /** The open project's file, marked as open among the results. */
    openPath: string;
    /** Reads every project, saying how far it has got, and names those that couldn't be read. */
    load: (progress: (done: number, total: number) => void) => Promise<{ sources: SearchSource[]; unread: string[] }>;
    onOpen: (place: SearchPlace, query: string) => void;
    onClose: () => void;
  } = $props();

  const listId = $props.id();
  let query = $state(untrack(() => initial));
  // The words last searched for: typing waits a moment, so a long book isn't searched at every letter.
  let searched = $state(untrack(() => initial));
  let sources = $state.raw<SearchSource[] | null>(null);
  let unread = $state<string[]>([]);
  let progress = $state({ done: 0, total: 0 });
  let chosen = $state(0);
  let timer = 0;

  onMount(() => {
    void load((done, total) => (progress = { done, total })).then((read) => {
      sources = read.sources;
      unread = read.unread;
    });
    return () => window.clearTimeout(timer);
  });

  const result = $derived(sources ? searchProjects(sources, searched) : null);
  // Every place with its number in the list, for the arrow keys.
  const rows = $derived.by(() => {
    let index = 0;
    return (result?.groups ?? []).map((group) => ({ ...group, rows: group.places.map((place) => ({ place, index: index++ })) }));
  });
  const places = $derived(rows.flatMap((group) => group.rows.map((row) => row.place)));
  const matches = $derived(places.reduce((sum, place) => sum + place.count, 0));
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const optionId = (index: number) => `${listId}-${index}`;

  function typed() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      searched = query;
      chosen = 0;
    }, 150);
  }

  async function choose(index: number) {
    chosen = Math.max(0, Math.min(places.length - 1, index));
    await tick();
    document.getElementById(optionId(chosen))?.scrollIntoView({ block: "nearest" });
  }

  function keys(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void choose(chosen + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      // What she typed last counts, even within the moment typing waits.
      if (searched !== query) {
        window.clearTimeout(timer);
        searched = query;
        chosen = 0;
      }
      const place = places[chosen];
      if (place) onOpen(place, query.trim());
    }
  }
</script>

<!-- Search across every project (owner, 12 October): chapters, their titles and notes, with the words shown in place. -->
<Modal title={t("searchEverything")} {onClose}>
  <div class="search">
    <label class="field">
      <Icon name="search" />
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value={query}
        oninput={typed}
        onkeydown={keys}
        placeholder={t("searchEverything")}
        autofocus
        role="combobox"
        aria-expanded={places.length > 0}
        aria-controls={listId}
        aria-activedescendant={places.length > 0 ? optionId(chosen) : undefined}
        aria-autocomplete="list"
      />
    </label>
    <p class="status" aria-live="polite">
      {#if !result}
        {t("searchReading", { done: progress.done, total: progress.total })}
      {:else if !searched.trim()}
        {t("searchEverythingHint")}
      {:else if places.length === 0}
        {t("searchNothing")}
      {:else}
        {plural("matchCount", matches)} {plural("inProjects", rows.length)}{#if result.capped} · {t("searchCapped", { n: places.length })}{/if}
      {/if}
    </p>
    {#if unread.length > 0}
      <p class="status unread">{t("searchUnread", { names: unread.join(", ") })}</p>
    {/if}
    <div class="results" id={listId} role="listbox" aria-label={t("searchEverything")}>
      {#each rows as group (group.path)}
        <h3>
          {group.name}
          {#if same(group.path, openPath)}<span class="open">{t("openNow")}</span>{/if}
        </h3>
        {#each group.rows as row (row.place.kind + row.place.chapterId + row.place.noteId)}
          <button
            type="button"
            role="option"
            id={optionId(row.index)}
            aria-selected={row.index === chosen}
            class:chosen={row.index === chosen}
            onmousemove={() => (chosen = row.index)}
            onclick={() => onOpen(row.place, searched.trim())}
          >
            <span class="where">
              <Icon name={row.place.kind === "note" ? "notes" : "book"} />
              <span class="label">{row.place.label}</span>
              {#if row.place.count > 1}<span class="count">{row.place.count}</span>{/if}
            </span>
            <span class="text">{row.place.before}<mark>{row.place.match}</mark>{row.place.after}</span>
          </button>
        {/each}
      {/each}
    </div>
  </div>
</Modal>

<style>
  .search {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 16px 20px 0;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
  }

  .field:focus-within {
    border-color: var(--pv-accent);
  }

  .field :global(svg) {
    flex: none;
    width: 17px;
    height: 17px;
    color: var(--pv-text-subtle);
  }

  .field input {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text);
    font-size: 15px;
    outline: none;
  }

  .status {
    margin: 8px 2px 6px;
    font-size: var(--pv-text-md);
    color: var(--pv-text-subtle);
  }

  .status.unread {
    margin-top: 0;
    color: var(--pv-danger);
  }

  .results {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0 -20px;
    padding: 0 20px 16px;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 4px;
    font-family: var(--pv-font-heading);
    font-size: 17px;
    font-weight: 400;
  }

  .open {
    font-family: var(--pv-font-ui);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--pv-accent);
  }

  button {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    border: 0;
    border-radius: var(--pv-radius-sm);
    padding: 8px 10px;
    background: transparent;
    color: var(--pv-text);
    text-align: left;
  }

  button.chosen {
    background: var(--pv-selected);
  }

  .where {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    font-size: var(--pv-text-md);
    font-weight: 600;
  }

  .where :global(svg) {
    flex: none;
    width: 14px;
    height: 14px;
    color: var(--pv-text-subtle);
  }

  .label {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .count {
    flex: none;
    padding: 0 6px;
    border-radius: 8px;
    background: var(--pv-ink-chip);
    color: var(--pv-ink-chip-text);
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
  }

  .text {
    padding-left: 21px;
    font-family: var(--pv-font-manuscript);
    font-size: 14px;
    line-height: 1.45;
    color: var(--pv-text-muted);
  }

  mark {
    border-radius: 2px;
    padding: 0 1px;
    background: var(--pv-ink-tint);
    color: var(--pv-ink-tint-text);
  }
</style>
