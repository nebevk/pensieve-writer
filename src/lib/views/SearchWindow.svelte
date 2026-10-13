<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import { num, plural, t } from "$lib/ui.svelte";
  import SearchResults from "./SearchResults.svelte";
  import { searchHits, shownHits, type SearchHit, type SearchSource } from "./searchAll";

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
    onOpen: (hit: SearchHit, query: string) => void;
    onClose: () => void;
  } = $props();

  const listId = $props.id();
  const ANY = { matchCase: false, wholeWord: false };
  let query = $state(untrack(() => initial));
  // The words last searched for: typing waits a moment, so a long book isn't searched at every letter.
  let searched = $state(untrack(() => initial));
  let sources = $state.raw<SearchSource[] | null>(null);
  let unread = $state<string[]>([]);
  let progress = $state({ done: 0, total: 0 });
  let chosen = $state(0);
  // How far she opened each project's places, by its file.
  let opened = $state<Record<string, number>>({});
  let timer = 0;

  onMount(() => {
    void load((done, total) => (progress = { done, total })).then((read) => {
      sources = read.sources;
      unread = read.unread;
    });
    return () => window.clearTimeout(timer);
  });

  const result = $derived(sources ? searchHits(sources, searched, ANY) : null);
  // The first three places of each project, as find's list in Write shows them.
  const groups = $derived(result ? shownHits(result.groups, opened, 3) : []);
  const visible = $derived(groups.flatMap((group) => group.shown.map((row) => row.hit)));

  function typed() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      searched = query;
      chosen = 0;
      opened = {};
    }, 150);
  }

  async function choose(index: number) {
    chosen = Math.max(0, Math.min(visible.length - 1, index));
    await tick();
    document.getElementById(`${listId}-${chosen}`)?.scrollIntoView({ block: "nearest" });
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
      const hit = visible[chosen];
      if (hit) onOpen(hit, query.trim());
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
        aria-expanded={visible.length > 0}
        aria-controls={listId}
        aria-activedescendant={visible.length > 0 ? `${listId}-${chosen}` : undefined}
        aria-autocomplete="list"
      />
    </label>
    <p class="status" aria-live="polite">
      {#if !result}
        {t("searchReading", { done: progress.done, total: progress.total })}
      {:else if !searched.trim()}
        {t("searchEverythingHint")}
      {:else if result.total === 0}
        {t("searchNothing")}
      {:else}
        {plural("matchCount", result.total)} {plural("inProjects", result.groups.length)}{#if result.capped} · {t("searchCapped", { n: num(visible.length) })}{/if}
      {/if}
    </p>
    {#if unread.length > 0}
      <p class="status unread">{t("searchUnread", { names: unread.join(", ") })}</p>
    {/if}
    <div class="list">
      <SearchResults
        {groups}
        {chosen}
        {listId}
        label={t("searchEverything")}
        {openPath}
        onChoose={(index) => (chosen = index)}
        onOpen={(hit) => onOpen(hit, searched.trim())}
        onMore={(path) => (opened = { ...opened, [path]: (groups.find((group) => group.path === path)?.shown.length ?? 0) + 50 })}
      />
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

  .list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin: 0 -20px;
    padding-bottom: 8px;
    border-top: 1px solid var(--pv-divider);
  }
</style>
