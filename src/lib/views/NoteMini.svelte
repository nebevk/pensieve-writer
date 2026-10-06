<script lang="ts">
  let {
    kind,
    title,
    meta = "",
    variant = "row",
    onclick,
  }: {
    kind: string;
    title: string;
    meta?: string;
    /** "row": one line, beside the page. "card": kind over title, on Home. */
    variant?: "row" | "card";
    onclick?: () => void;
  } = $props();
</script>

<!-- A small note on paper, lifting a little under the pointer. -->
<button type="button" class="mini {variant}" {onclick}>
  {#if variant === "card"}
    <span class="top">
      <span class="kind">{kind}</span>
      <span class="meta">{meta}</span>
    </span>
    <span class="title">{title}</span>
  {:else}
    <span class="kind wide">{kind}</span>
    <span class="title">{title}</span>
    <span class="meta">{meta}</span>
  {/if}
</button>

<style>
  .mini {
    width: 100%;
    border: 0;
    text-align: left;
    background-color: var(--pv-paper);
    box-shadow: var(--pv-shadow-slip);
    color: var(--pv-ink);
    font-family: var(--pv-font-ui);
    transition: transform var(--pv-dur) var(--pv-ease);
  }

  :global(:root[data-grain="true"]) .mini {
    background-image: var(--pv-grain);
  }

  .mini:hover {
    transform: translateY(-2px);
  }

  :global(:root[data-gentle="true"]) .mini:hover {
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .mini:hover {
      transform: none;
    }
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 14px;
  }

  .kind {
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--pv-ink-accent);
  }

  .kind.wide {
    flex: none;
    width: 62px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row .title {
    flex: 1;
    min-width: 0;
    font-size: var(--pv-text-base);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .card .title {
    font-family: var(--pv-font-heading);
    font-size: 15px;
  }

  .meta {
    flex: none;
    font-size: var(--pv-text-sm);
    color: var(--pv-ink-muted);
  }

  .card .meta {
    font-size: 11px;
  }
</style>
