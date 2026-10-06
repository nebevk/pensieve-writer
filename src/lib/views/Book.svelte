<script lang="ts">
  import { blocksToHtml, documentToBlocks } from "$lib/export/document";
  import type { Chapter } from "$lib/model";
  import { t } from "$lib/ui.svelte";

  let { chapters }: { chapters: Chapter[] } = $props();

  let size = $state<"a5" | "pocket">("a5");

  const pages = $derived(
    [...chapters]
      .sort((a, b) => a.position - b.position)
      .map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        html: blocksToHtml(documentToBlocks(chapter.contentJson)),
      })),
  );
</script>

<section class="book" class:pocket={size === "pocket"}>
  <div class="bar">
    <label>
      {t("page")}
      <select bind:value={size}>
        <option value="a5">A5</option>
        <option value="pocket">{t("pocketSize")}</option>
      </select>
    </label>
    <button type="button" onclick={() => window.print()}>{t("printOrPdf")}</button>
  </div>
  <div class="spread">
    {#each pages as page (page.id)}
      <article class="page">
        <h2>{page.title}</h2>
        {@html page.html}
      </article>
    {/each}
  </div>
</section>

<style>
  .book {
    height: 100%;
    overflow: auto;
    background: var(--pv-desk);
  }

  .bar {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    padding: 0.7rem 1rem;
    color: var(--pv-text-muted);
  }

  .bar select,
  .bar button {
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    padding: 0.25rem 0.6rem;
    background: var(--pv-field);
    color: var(--pv-text);
  }

  .bar button:hover {
    background: var(--pv-selected);
  }

  .bar button:active {
    background: var(--pv-pressed);
  }

  .spread {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1rem;
    padding: 0 1rem 2rem;
    justify-items: center;
  }

  /* A sheet of paper: light in every theme, with a shadow rather than an outline. */
  .page {
    background: var(--pv-paper);
    color: var(--pv-ink);
    color-scheme: light;
    width: min(100%, 148mm);
    min-height: 210mm;
    padding: 18mm 16mm;
    box-shadow: var(--pv-shadow-sheet);
  }

  .pocket .page {
    width: min(100%, 5in);
    min-height: 8in;
  }

  .page :global(p),
  .page :global(blockquote),
  .page :global(li) {
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    line-height: 1.6;
  }

  .page :global(blockquote) {
    margin: 0.6em 0;
    padding-left: 1rem;
    border-left: 2px solid var(--pv-ink-rule-accent);
    color: var(--pv-ink-2);
  }

  .page :global(a) {
    color: var(--pv-ink-accent);
    text-decoration-color: var(--pv-ink-link-underline);
  }

  .page :global(mark) {
    background: var(--pv-highlight);
    color: inherit;
  }

  .page :global(hr) {
    border: 0;
    border-top: 1px solid var(--pv-ink-rule);
    margin: 1.4em 0;
  }

  .page :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0.8em auto;
    break-inside: avoid;
  }

  .page :global(sup.footnote) {
    font-size: 0.7em;
    line-height: 0;
  }

  /* A chapter's footnotes close it, under a short rule, as in a printed book. */
  .page :global(ol.footnotes) {
    margin-top: 1.8em;
    padding-left: 1.4em;
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    font-size: 0.82em;
    line-height: 1.5;
  }

  .page :global(ol.footnotes)::before {
    content: "";
    display: block;
    width: 30%;
    margin: 0 0 0.7em -1.4em;
    border-top: 1px solid var(--pv-ink-rule);
  }

  h2 {
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    font-weight: 400;
    margin-top: 0;
  }

  @media print {
    .book {
      height: auto;
      overflow: visible;
    }

    .bar {
      display: none;
    }

    .spread {
      display: block;
    }

    .page {
      box-shadow: none;
      break-after: page;
    }
  }
</style>
