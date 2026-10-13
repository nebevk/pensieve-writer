<script lang="ts">
  import { num, plural, t } from "$lib/ui.svelte";
  import type { SearchHit, ShownGroup } from "./searchAll";

  let {
    groups,
    chosen,
    listId,
    label,
    openPath = "",
    onChoose,
    onOpen,
    onMore,
  }: {
    /** The projects with the words, each with the places it shows. */
    groups: ShownGroup[];
    /** The place the arrow keys are on, by its number down the list. */
    chosen: number;
    listId: string;
    label: string;
    /** The open project's file, marked as open. */
    openPath?: string;
    onChoose: (index: number) => void;
    onOpen: (hit: SearchHit) => void;
    /** More of a project's places, by its file. */
    onMore: (path: string) => void;
  } = $props();

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  /** Where a place is: the writing and its chapter, or its page in a writing of one page; or the note. */
  function where(hit: SearchHit): string {
    if (hit.kind === "note") return `${t("notes")} · ${hit.title}`;
    if (hit.chapter > 0) return `${hit.title} · ${t("hitChapter", { n: hit.chapter })}`;
    return `${hit.title} · ${t("hitPage", { n: hit.page })}`;
  }
</script>

<!-- Find's list (owner, 13 October): project by project, each place with its words in their sentence. -->
<div class="results" id={listId} role="listbox" aria-label={label}>
  {#each groups as group (group.path)}
    <section class="group">
      <h3>
        <span class="name">{group.name}</span>
        <span class="count">{num(group.count)}</span>
        {#if openPath && same(group.path, openPath)}<span class="open">{t("openNow")}</span>{/if}
      </h3>
      {#each group.shown as row (`${row.hit.chapterId}${row.hit.noteId}:${row.hit.nth}`)}
        <button
          type="button"
          role="option"
          id="{listId}-{row.index}"
          aria-selected={row.index === chosen}
          class="hit"
          class:chosen={row.index === chosen}
          onmousedown={(event) => event.preventDefault()}
          onmousemove={() => onChoose(row.index)}
          onclick={() => onOpen(row.hit)}
        >
          <span class="where">{where(row.hit)}</span>
          <span class="text">{row.hit.before}<mark>{row.hit.match}</mark>{row.hit.after}</span>
        </button>
      {/each}
      {#if group.more > 0}
        <button type="button" class="more" onmousedown={(event) => event.preventDefault()} onclick={() => onMore(group.path)}>
          {plural("moreMatches", group.more)}
        </button>
      {/if}
    </section>
  {/each}
</div>

<style>
  .results {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .group {
    padding: 10px 0 8px;
    border-top: 1px solid var(--pv-divider);
  }

  .group:first-child {
    border-top: 0;
  }

  h3 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 4px 16px 6px;
    font-family: var(--pv-font-ui);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--pv-text-subtle);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .count {
    flex: none;
    font-weight: 500;
    color: var(--pv-text-faint);
  }

  .open {
    flex: none;
    color: var(--pv-accent);
  }

  .hit {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: calc(100% - 12px);
    margin: 0 6px;
    border: 0;
    border-radius: var(--pv-radius-sm);
    padding: 8px 10px;
    background: transparent;
    color: var(--pv-text);
    text-align: left;
  }

  .hit.chosen {
    background: color-mix(in srgb, var(--pv-accent) 13%, var(--pv-chrome-raised));
  }

  .where {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 12.5px;
    font-weight: 600;
  }

  .text {
    font-family: var(--pv-font-manuscript);
    font-size: 14.5px;
    line-height: 1.45;
    color: var(--pv-text-2);
  }

  mark {
    border-radius: 2px;
    padding: 0 1px;
    background: var(--pv-ink-tint);
    color: var(--pv-ink-tint-text);
  }

  .hit.chosen mark {
    background: color-mix(in srgb, var(--pv-accent) 28%, var(--pv-field));
  }

  .more {
    margin: 2px 6px 0;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 4px 10px;
    background: transparent;
    color: var(--pv-accent);
    font-size: 12.5px;
    font-weight: 600;
  }

  .more:hover {
    background: var(--pv-selected);
  }
</style>
