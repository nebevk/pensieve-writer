<script lang="ts">
  import { wordsFor } from "$lib/editor/counts";
  import type { Chapter, ChapterStatus } from "$lib/model";
  import { num, plural, t } from "$lib/ui.svelte";

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
      <p>{plural("words", wordsFor(chapter.id, chapter.plainText))}{chapter.wordGoal > 0 ? ` / ${num(chapter.wordGoal)}` : ""}</p>
      <label>
        {t("part")}
        <input
          value={chapter.part}
          onchange={(event) => onUpdate(chapter.id, { part: (event.currentTarget as HTMLInputElement).value })}
        />
      </label>
      <label>
        {t("wordGoal")}
        <input
          type="number"
          min="0"
          value={chapter.wordGoal}
          onchange={(event) =>
            onUpdate(chapter.id, { wordGoal: Number((event.currentTarget as HTMLInputElement).value) || 0 })}
        />
      </label>
      <label>
        {t("status")}
        <select
          value={chapter.status}
          onchange={(event) =>
            onUpdate(chapter.id, {
              status: (event.currentTarget as HTMLSelectElement).value as ChapterStatus,
            })}
        >
          <option value="draft">{t("statusDraft")}</option>
          <option value="revised">{t("statusRevised")}</option>
          <option value="final">{t("statusFinal")}</option>
        </select>
      </label>
      <label>
        {t("synopsis")}
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

  /* Each chapter is a card of paper: ink colours, and native fields that stay light in every theme. */
  article {
    background: var(--pv-paper);
    color: var(--pv-ink);
    color-scheme: light;
    border-radius: var(--pv-radius-0);
    box-shadow: var(--pv-shadow-card);
    padding: 0.8rem 0.9rem 1rem;
  }

  h2 {
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    font-weight: 400;
    font-size: 1.25rem;
    margin: 0;
  }

  p {
    margin: 0.2rem 0 0.6rem;
    color: var(--pv-ink-muted);
    font-size: var(--pv-text-md);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--pv-ink-muted);
    font-size: var(--pv-text-sm);
    margin-top: 0.45rem;
  }

  input,
  textarea,
  select {
    font: inherit;
    font-size: var(--pv-text-base);
    color: var(--pv-ink);
    background: var(--pv-ink-chip);
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0.35rem 0.45rem;
  }
</style>
