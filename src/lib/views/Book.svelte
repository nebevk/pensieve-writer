<script lang="ts">
  import { blocksToHtml, documentToBlocks } from "$lib/export/document";
  import type { Chapter } from "$lib/model";

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
      Page
      <select bind:value={size}>
        <option value="a5">A5</option>
        <option value="pocket">5 × 8 in</option>
      </select>
    </label>
    <button type="button" onclick={() => window.print()}>Print or save as PDF</button>
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
    background: var(--desk);
  }

  .bar {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    padding: 0.7rem 1rem;
    color: var(--muted);
  }

  .spread {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1rem;
    padding: 0 1rem 2rem;
    justify-items: center;
  }

  .page {
    background: #fffef8;
    color: #241c14;
    width: min(100%, 148mm);
    min-height: 210mm;
    padding: 18mm 16mm;
    border: 1px solid rgba(60, 40, 20, 0.12);
  }

  .pocket .page {
    width: min(100%, 5in);
    min-height: 8in;
  }

  .page :global(p),
  .page :global(blockquote),
  .page :global(li) {
    font-family: var(--font-writing);
    line-height: 1.6;
  }

  h2 {
    font-family: var(--font-writing);
    font-weight: 500;
    margin-top: 0;
  }

  @media print {
    .bar {
      display: none;
    }

    .spread {
      display: block;
    }

      .page {
      border: 0;
      break-after: page;
    }
  }
</style>
