<script lang="ts">
  import { countWords } from "$lib/editor/counts";
  import type { Chapter, ChapterStatus } from "$lib/model";

  let {
    chapters,
    onUpdate,
  }: {
    chapters: Chapter[];
    onUpdate: (id: string, patch: Partial<Chapter>) => void;
  } = $props();
</script>

<section class="outline">
  {#each chapters as chapter (chapter.id)}
    <article>
      <h2>{chapter.title}</h2>
      <p>{countWords(chapter.plainText)} words</p>
      <label>
        Status
        <select
          value={chapter.status}
          onchange={(event) =>
            onUpdate(chapter.id, {
              status: (event.currentTarget as HTMLSelectElement).value as ChapterStatus,
            })}
        >
          <option value="draft">Draft</option>
          <option value="revised">Revised</option>
          <option value="final">Final</option>
        </select>
      </label>
      <label>
        Synopsis
        <textarea
          rows="3"
          value={chapter.synopsis}
          onchange={(event) =>
            onUpdate(chapter.id, { synopsis: (event.currentTarget as HTMLTextAreaElement).value })}
        ></textarea>
      </label>
    </article>
  {/each}
</section>

<style>
  .outline {
    height: 100%;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0.8rem;
    padding: 1rem 1.25rem 2rem;
    align-content: start;
  }

  article {
    background: var(--paper);
    border-radius: 10px;
    padding: 0.8rem 0.9rem 1rem;
  }

  h2 {
    font-family: var(--font-writing);
    font-weight: 500;
    font-size: 1.25rem;
    margin: 0;
  }

  p {
    margin: 0.2rem 0 0.6rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--muted);
    font-size: 0.8rem;
    margin-top: 0.45rem;
  }

  textarea,
  select {
    font: inherit;
    color: var(--ink);
    background: var(--desk);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.35rem 0.45rem;
  }
</style>
