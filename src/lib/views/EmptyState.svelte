<script lang="ts">
  let {
    kind,
    text,
    action = "",
    onAction,
    size = "large",
  }: {
    /** Which of the owner's pictures (13 October): a note by the basin, a page, a to-do. */
    kind: "notes" | "projects" | "tasks";
    /** A kind line about what will be here. */
    text: string;
    /** The button's words, such as New note; none without. */
    action?: string;
    onAction?: () => void;
    /** large in a view of its own; small beside the page; row on Home, the picture beside the words. */
    size?: "large" | "small" | "row";
  } = $props();
</script>

<!-- Nothing here yet (owner, 13 October): the picture for the look on now, a kind line, what to do. -->
<div class="empty-state {size}">
  <div class="art {kind}" aria-hidden="true"></div>
  <div class="words">
    <p>{text}</p>
    {#if action && onAction}
      <button type="button" onclick={onAction}>{action}</button>
    {/if}
  </div>
</div>

<style>
  /* Each look's pictures, drawn by the owner for it; the design's Sunset is the app's dusk. */
  :global(:root[data-theme="daylight"]) {
    --pv-empty-notes: url("/art/empty/empty-notes-daylight.svg");
    --pv-empty-projects: url("/art/empty/empty-projects-daylight.svg");
    --pv-empty-tasks: url("/art/empty/empty-tasks-daylight.svg");
  }

  :global(:root[data-theme="dusk"]) {
    --pv-empty-notes: url("/art/empty/empty-notes-sunset.svg");
    --pv-empty-projects: url("/art/empty/empty-projects-sunset.svg");
    --pv-empty-tasks: url("/art/empty/empty-tasks-sunset.svg");
  }

  :global(:root[data-theme="candlelit"]) {
    --pv-empty-notes: url("/art/empty/empty-notes-candlelit.svg");
    --pv-empty-projects: url("/art/empty/empty-projects-candlelit.svg");
    --pv-empty-tasks: url("/art/empty/empty-tasks-candlelit.svg");
  }

  :global(:root[data-theme="moonlit"]) {
    --pv-empty-notes: url("/art/empty/empty-notes-moonlit.svg");
    --pv-empty-projects: url("/art/empty/empty-projects-moonlit.svg");
    --pv-empty-tasks: url("/art/empty/empty-tasks-moonlit.svg");
  }

  :global(:root[data-theme="forest"]) {
    --pv-empty-notes: url("/art/empty/empty-notes-forest.svg");
    --pv-empty-projects: url("/art/empty/empty-projects-forest.svg");
    --pv-empty-tasks: url("/art/empty/empty-tasks-forest.svg");
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 28px 16px;
    text-align: center;
    color: var(--pv-text-muted);
  }

  .art {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 3 / 2;
    background: center / contain no-repeat;
    /* The picture's own ground fades into whatever it lies on, the window's or the page's colour. */
    -webkit-mask-image: radial-gradient(closest-side, #000 70%, transparent);
    mask-image: radial-gradient(closest-side, #000 70%, transparent);
  }

  .art.notes {
    background-image: var(--pv-empty-notes);
  }

  .art.projects {
    background-image: var(--pv-empty-projects);
  }

  .art.tasks {
    background-image: var(--pv-empty-tasks);
  }

  .words {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  p {
    max-width: 34ch;
    margin: 0;
    font-size: var(--pv-text-base);
    line-height: 1.5;
  }

  button {
    height: 32px;
    padding: 0 14px;
    border: 1px solid transparent;
    border-radius: var(--pv-radius-sm);
    background: var(--pv-accent-solid);
    color: var(--pv-on-accent);
  }

  button:hover {
    filter: brightness(1.08);
  }

  .small {
    gap: 8px;
    padding: 16px 12px;
  }

  .small .art {
    max-width: 160px;
  }

  .small p {
    font-size: var(--pv-text-sm);
  }

  /*
   * On Home, under its list's heading: the words where they always were, and the picture beside them
   * reaching down into Home's margin, so Home keeps its height and fits the laptop's screen.
   */
  .row {
    position: relative;
    display: block;
    padding: 0 0 0 92px;
    text-align: left;
  }

  .row .art {
    position: absolute;
    top: -6px;
    left: 0;
    width: 78px;
  }

  .row .words {
    align-items: flex-start;
  }

  .row p {
    font-size: var(--pv-text-md);
  }
</style>
