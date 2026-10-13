<script module lang="ts">
  /** Where find looks: the chapter on the page, the whole project, or every project. */
  export type FindScope = "chapter" | "project" | "all";
</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import Icon from "./Icon.svelte";
  import { num, plural, t } from "$lib/ui.svelte";
  import type { FindOptions } from "./findPattern";
  import type { Found } from "./findMarks";
  import SearchResults from "$lib/views/SearchResults.svelte";
  import { searchHits, shownHits, type SearchHit, type SearchSource } from "$lib/views/searchAll";

  let {
    query = $bindable(""),
    replacement = $bindable(""),
    scope = $bindable<FindScope>("chapter"),
    options = $bindable<FindOptions>({ matchCase: false, wholeWord: false }),
    replaceShown = $bindable(false),
    input = $bindable<HTMLInputElement | undefined>(undefined),
    found,
    sources,
    progress = { done: 0, total: 0 },
    unread = [],
    openPath = "",
    notice = "",
    onStep,
    onReplace,
    onReplaceAll,
    onOpen,
    onClose,
  }: {
    query?: string;
    replacement?: string;
    scope?: FindScope;
    options?: FindOptions;
    replaceShown?: boolean;
    input?: HTMLInputElement;
    /** How many matches the chapter on the page has, and which she is at. */
    found: Found;
    /** The project, or every project, to look through; null while they are read. */
    sources: SearchSource[] | null;
    progress?: { done: number; total: number };
    /** Projects that couldn't be read, by name. */
    unread?: string[];
    openPath?: string;
    /** What the last replace did, or went wrong. */
    notice?: string;
    onStep: (step: 1 | -1) => void;
    onReplace: () => void;
    onReplaceAll: () => void;
    onOpen: (hit: SearchHit) => void;
    onClose: () => void;
  } = $props();

  const listId = $props.id();
  const listed = $derived(scope !== "chapter");
  // The words last looked for in the list: typing waits a moment, so every project isn't read at every letter.
  let searched = $state(untrack(() => query));
  let chosen = $state(0);
  // How far she opened each project's places, by its file.
  let opened = $state<Record<string, number>>({});

  $effect(() => {
    const words = query;
    const timer = window.setTimeout(() => {
      if (words === searched) return;
      searched = words;
      chosen = 0;
      opened = {};
    }, 150);
    return () => window.clearTimeout(timer);
  });

  const result = $derived(listed && sources ? searchHits(sources, searched, options) : null);
  // One project shows all its places; every project, the first two of each.
  const groups = $derived(result ? shownHits(result.groups, opened, scope === "project" ? 100 : 2) : []);
  const visible = $derived(groups.flatMap((group) => group.shown.map((row) => row.hit)));
  const placeholder = $derived(scope === "chapter" ? t("findInChapter") : scope === "project" ? t("findInProject") : t("findEverywhere"));

  /** What the field says at its end: where she is among the matches, or how many there are and where. */
  const counter = $derived.by(() => {
    if (!query.trim()) return "";
    if (!listed) {
      if (found.total === 0) return t("findNoMatches");
      return found.current < 0 ? plural("matchCount", found.total) : t("ofTotal", { done: num(found.current + 1), total: num(found.total) });
    }
    if (!result || !searched.trim()) return "";
    if (result.total === 0) return t("findNoMatches");
    return scope === "project" ? plural("matchCount", result.total) : `${num(result.total)} ${plural("inProjects", result.groups.length)}`;
  });
  const nothing = $derived(counter === t("findNoMatches"));

  async function choose(index: number) {
    chosen = Math.max(0, Math.min(visible.length - 1, index));
    await tick();
    document.getElementById(`${listId}-${chosen}`)?.scrollIntoView({ block: "nearest" });
  }

  function keys(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (!listed) {
      if (event.key === "Enter") {
        event.preventDefault();
        onStep(event.shiftKey ? -1 : 1);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void choose(chosen + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      // What she typed last counts, even within the moment typing waits.
      if (searched !== query) {
        searched = query;
        chosen = 0;
      }
      const hit = visible[chosen];
      if (hit) onOpen(hit);
    }
  }

  function pick(next: FindScope) {
    scope = next;
    chosen = 0;
    opened = {};
    if (next === "all") replaceShown = false;
  }

  // A press on any of find's buttons leaves the keyboard in the field, so Enter goes on finding.
  const keep = (event: MouseEvent) => event.preventDefault();
</script>

<!-- Find (owner, 13 October): in the chapter, with every match marked on the page, or in the project or every project as a list. -->
<div class="find-panel" class:listed role="search" aria-label={t("find")}>
  <div class="top">
    <label class="field">
      <Icon name="search" />
      <input
        bind:this={input}
        bind:value={query}
        onkeydown={keys}
        {placeholder}
        aria-label={placeholder}
        role={listed ? "combobox" : undefined}
        aria-expanded={listed ? visible.length > 0 : undefined}
        aria-controls={listed ? listId : undefined}
        aria-activedescendant={listed && visible.length > 0 ? `${listId}-${chosen}` : undefined}
      />
      {#if counter}<span class="counter" class:nothing aria-live="polite">{counter}</span>{/if}
    </label>
    {#if !listed}
      <button type="button" class="icon" title={t("findPrevious")} aria-label={t("findPrevious")} disabled={found.total === 0} onmousedown={keep} onclick={() => onStep(-1)}><Icon name="chevronUp" /></button>
      <button type="button" class="icon" title={t("findNextOne")} aria-label={t("findNextOne")} disabled={found.total === 0} onmousedown={keep} onclick={() => onStep(1)}><Icon name="chevronDown" /></button>
    {/if}
    <button type="button" class="icon" title={`${t("close")} (Esc)`} aria-label={t("close")} onmousedown={keep} onclick={onClose}><Icon name="x" /></button>
  </div>

  {#if replaceShown && scope !== "all"}
    <div class="replace">
      <input
        bind:value={replacement}
        placeholder={`${t("replaceWith")} …`}
        aria-label={t("replaceWith")}
        onkeydown={(event) => {
          if (event.key === "Enter" && !event.isComposing && !listed) {
            event.preventDefault();
            onReplace();
          }
        }}
      />
      {#if !listed}
        <button type="button" onmousedown={keep} onclick={onReplace} disabled={found.total === 0}>{t("replace")}</button>
      {/if}
      <button type="button" onmousedown={keep} onclick={onReplaceAll} disabled={listed ? !result || result.total === 0 : found.total === 0}>{t("replaceAllShort")}</button>
    </div>
    {#if scope === "project"}
      <p class="hint">{t("replaceInProjectHint")}</p>
    {/if}
  {/if}

  <div class="options">
    <div class="switch" role="radiogroup" aria-label={t("find")}>
      <button type="button" role="radio" aria-checked={scope === "chapter"} class:on={scope === "chapter"} onmousedown={keep} onclick={() => pick("chapter")}>{t("thisChapter")}</button>
      <button type="button" role="radio" aria-checked={scope === "project"} class:on={scope === "project"} onmousedown={keep} onclick={() => pick("project")}>{t("findThisProject")}</button>
      <button type="button" role="radio" aria-checked={scope === "all"} class:on={scope === "all"} onmousedown={keep} onclick={() => pick("all")}>{t("findAllProjects")}</button>
    </div>
    <span class="spacer"></span>
    <button
      type="button"
      class="toggle"
      class:on={options.matchCase}
      title={t("matchCase")}
      aria-label={t("matchCase")}
      aria-pressed={options.matchCase}
      onmousedown={keep}
      onclick={() => (options = { ...options, matchCase: !options.matchCase })}>Aa</button
    >
    <button
      type="button"
      class="toggle word"
      class:on={options.wholeWord}
      title={t("wholeWords")}
      aria-label={t("wholeWords")}
      aria-pressed={options.wholeWord}
      onmousedown={keep}
      onclick={() => (options = { ...options, wholeWord: !options.wholeWord })}>ab</button
    >
    {#if scope !== "all"}
      <button
        type="button"
        class="toggle replace-toggle"
        class:on={replaceShown}
        title={replaceShown ? t("replaceHide") : t("replaceShow")}
        aria-expanded={replaceShown}
        onmousedown={keep}
        onclick={() => (replaceShown = !replaceShown)}
      >
        {t("replace")}<Icon name={replaceShown ? "chevronUp" : "chevronDown"} />
      </button>
    {/if}
  </div>

  {#if notice}
    <p class="status" role="status">{notice}</p>
  {/if}

  {#if listed}
    <div class="list">
      {#if !sources}
        <p class="status" aria-live="polite">{t("searchReading", { done: progress.done, total: progress.total })}</p>
      {:else}
        {#if unread.length > 0}
          <p class="status unread">{t("searchUnread", { names: unread.join(", ") })}</p>
        {/if}
        {#if result?.capped}
          <p class="status">{t("searchCapped", { n: num(visible.length) })}</p>
        {/if}
        <SearchResults
          {groups}
          {chosen}
          {listId}
          label={placeholder}
          openPath={scope === "all" ? openPath : ""}
          onChoose={(index) => (chosen = index)}
          {onOpen}
          onMore={(path) => (opened = { ...opened, [path]: (groups.find((group) => group.path === path)?.shown.length ?? 0) + 50 })}
        />
      {/if}
      <p class="keys" aria-hidden="true">
        <span><b>↑↓</b> {t("keysMove")}</span>
        <span><b>Enter</b> {t("keysOpen")}</span>
        <span><b>Esc</b> {t("keysClose")}</span>
      </p>
    </div>
  {/if}
</div>

<style>
  .find-panel {
    position: absolute;
    top: 10px;
    right: 18px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    width: min(470px, calc(100% - 36px));
    max-height: calc(100% - 24px);
    border: 1px solid var(--pv-line);
    border-radius: 10px;
    background: var(--pv-chrome-raised);
    box-shadow: var(--pv-shadow-sheet);
    color: var(--pv-text);
    font-size: 13px;
  }

  .top,
  .replace,
  .options {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 12px 0;
  }

  .options {
    gap: 4px;
    padding-bottom: 12px;
  }

  .field {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 10px 0 11px;
    border: 1px solid var(--pv-line-strong);
    border-radius: 8px;
    background: var(--pv-field);
  }

  .field:focus-within {
    border-color: var(--pv-accent);
  }

  .field :global(svg) {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--pv-text-subtle);
  }

  .field input,
  .replace input {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text);
    font-size: 14.5px;
    outline: none;
  }

  .counter {
    flex: none;
    color: var(--pv-text-subtle);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .counter.nothing {
    color: var(--pv-danger);
  }

  .icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--pv-text-muted);
  }

  .icon :global(svg) {
    width: 17px;
    height: 17px;
  }

  .icon:hover:not(:disabled) {
    background: var(--pv-selected);
    color: var(--pv-text);
  }

  .icon:disabled {
    opacity: 0.4;
  }

  .replace input {
    height: 36px;
    padding: 0 11px;
    border: 1px solid var(--pv-line-strong);
    border-radius: 8px;
    background: var(--pv-field);
  }

  .replace input:focus {
    border-color: var(--pv-accent);
  }

  .replace button {
    flex: none;
    height: 36px;
    border: 1px solid var(--pv-line-strong);
    border-radius: 8px;
    padding: 0 13px;
    background: var(--pv-field);
    color: var(--pv-text);
    font-weight: 600;
  }

  .replace button:hover:not(:disabled) {
    background: var(--pv-selected);
  }

  .replace button:disabled {
    opacity: 0.5;
  }

  .hint {
    margin: 6px 14px 0;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--pv-text-subtle);
  }

  /* As Home's Grid and List: a soft track, the chosen one raised in the page's colours. */
  .switch {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 7px;
    background: var(--pv-selected);
  }

  .switch button {
    height: 26px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0 9px;
    background: transparent;
    color: var(--pv-text-subtle);
    font-size: 12.5px;
    white-space: nowrap;
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

  .spacer {
    flex: 1;
  }

  .toggle {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 28px;
    min-width: 30px;
    border: 0;
    border-radius: 6px;
    padding: 0 7px;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .toggle:hover {
    background: var(--pv-selected);
    color: var(--pv-text);
  }

  .toggle.on {
    background: color-mix(in srgb, var(--pv-accent) 14%, var(--pv-field));
    color: var(--pv-accent);
  }

  .toggle.word {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .toggle :global(svg) {
    width: 13px;
    height: 13px;
  }

  .replace-toggle.on {
    background: transparent;
    color: var(--pv-text);
  }

  .status {
    margin: -4px 14px 10px;
    font-size: 12.5px;
    color: var(--pv-text-subtle);
  }

  .status.unread {
    color: var(--pv-danger);
  }

  .list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--pv-divider);
  }

  .list .status {
    margin: 10px 16px 4px;
  }

  .keys {
    display: flex;
    gap: 16px;
    margin: 0;
    padding: 8px 16px 9px;
    border-top: 1px solid var(--pv-divider);
    font-size: 11.5px;
    color: var(--pv-text-subtle);
  }

  .keys b {
    font-weight: 600;
    color: var(--pv-text-muted);
  }
</style>
