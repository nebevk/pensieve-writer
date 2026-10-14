<script lang="ts">
  import type { DocumentsRead } from "$lib/export/documentsRead.svelte";
  import { draftsFound, type WritingDraft } from "$lib/export/importWriting";
  import { plural, t } from "$lib/ui.svelte";

  let {
    reader,
    drafts,
  }: {
    /** The documents being read, or read. */
    reader: DocumentsRead;
    /** The writings they make, as they will be made. */
    drafts: WritingDraft[];
  } = $props();

  const SHOWN = 5;
  const found = $derived(draftsFound(drafts));
</script>

<!-- What the chosen documents hold, before anything is made: chapters and words, and the first titles. -->
<div class="found" aria-live="polite">
  {#if reader.progress}
    <p class="say">{t("readingFiles", { done: reader.progress.done, total: reader.progress.total })}</p>
  {:else}
    {#if drafts.length > 0}
      <p class="sum">
        {#if drafts.length > 1}{plural("writings", drafts.length)}{:else if drafts[0].split}{plural("chapters", found.chapters)}{:else}{t("foundOnePage")}{/if}
        · {plural("words", found.words)}
      </p>
      {#if found.titles.length > 0}
        <ol>
          {#each found.titles.slice(0, SHOWN) as title, index (index)}
            <li>{title}</li>
          {/each}
        </ol>
        {#if found.titles.length > SHOWN}
          <p class="more">{t("andMore", { n: found.titles.length - SHOWN })}</p>
        {/if}
      {/if}
    {/if}
    {#if reader.failed.length > 0}
      <p class="problem" role="alert">
        {#if reader.read.length === 0 && reader.failed.length === 1}
          {t("documentUnread", { name: reader.failed[0].name, message: reader.failed[0].message })}
        {:else}
          {t("filesLeftOut", { names: reader.failed.map((item) => item.name).join(", ") })}
        {/if}
      </p>
    {/if}
  {/if}
</div>

<style>
  .found {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--pv-line);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
    font-size: var(--pv-text-md);
  }

  p {
    margin: 0;
  }

  .sum {
    color: var(--pv-text);
    font-weight: 600;
  }

  .say,
  .more {
    color: var(--pv-text-subtle);
  }

  /* The titles as they are, numbered or not ("1. poglavje"), a little in from the line above. */
  ol {
    margin: 0;
    padding-left: 1.5em;
    list-style: none;
    color: var(--pv-text-muted);
  }

  li {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .problem {
    color: var(--pv-danger);
  }
</style>
