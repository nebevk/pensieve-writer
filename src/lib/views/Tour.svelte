<script module lang="ts">
  /** A tip: what it points at (a CSS selector; none for the middle of the window), and what it says. */
  export type TourStep = { target?: string; title: string; text: string };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import { t } from "$lib/ui.svelte";

  let { steps, onDone }: { steps: TourStep[]; onDone: (stopAll: boolean) => void } = $props();

  let index = $state(0);
  let stop = $state(false);
  let card: HTMLElement | undefined = $state();
  let ring = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let place = $state({ top: 0, left: 0 });

  const step = $derived(steps[Math.min(index, steps.length - 1)]);
  const last = $derived(index >= steps.length - 1);

  /** Beside what the tip is about: below it if there's room, else above, else in the middle; always in the window. */
  function position() {
    if (!card) return;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const gutter = 12;
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const box = target?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) {
      ring = null;
      place = { top: Math.max(gutter, (innerHeight - height) / 2), left: Math.max(gutter, (innerWidth - width) / 2) };
      return;
    }
    // Something taller than the window (the page) is pointed at along its top.
    const top = Math.max(box.top, 0);
    const bottom = Math.min(box.bottom, innerHeight);
    ring = { top: top - 4, left: box.left - 4, width: box.width + 8, height: bottom - top + 8 };
    const below = bottom + gutter;
    const above = top - gutter - height;
    const y = below + height <= innerHeight - gutter ? below : above >= gutter ? above : Math.max(gutter, Math.min(top + 40, innerHeight - height - gutter));
    const x = Math.min(Math.max(gutter, box.left + box.width / 2 - width / 2), innerWidth - width - gutter);
    place = { top: y, left: x };
  }

  $effect(() => {
    void index;
    // After the card has its new words, measured as it is.
    requestAnimationFrame(position);
  });

  onMount(() => {
    const again = () => requestAnimationFrame(position);
    addEventListener("resize", again);
    // Lists and the page scroll beneath; the ring follows what it points at.
    addEventListener("scroll", again, true);
    return () => {
      removeEventListener("resize", again);
      removeEventListener("scroll", again, true);
    };
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onDone(stop);
    }
  }
</script>

{#if ring}
  <div class="ring" aria-hidden="true" style:top="{ring.top}px" style:left="{ring.left}px" style:width="{ring.width}px" style:height="{ring.height}px"></div>
{/if}
<!-- A tutorial tip: it points at a part of the window and leaves the rest free to use. -->
<div
  class="tip"
  bind:this={card}
  role="dialog"
  tabindex="-1"
  aria-labelledby="tip-title"
  aria-describedby="tip-text"
  style:top="{place.top}px"
  style:left="{place.left}px"
  onkeydown={onKeydown}
>
  <button type="button" class="close" title={t("close")} aria-label={t("close")} onclick={() => onDone(stop)}><Icon name="x" /></button>
  {#if steps.length > 1}
    <p class="count">{t("tipCount", { n: index + 1, total: steps.length })}</p>
  {/if}
  <h2 id="tip-title">{step.title}</h2>
  <p id="tip-text">{step.text}</p>
  <div class="foot">
    <label class="stop">
      <input type="checkbox" bind:checked={stop} />
      {t("tipsStop")}
    </label>
    <div class="moves">
      {#if index > 0}
        <button type="button" class="back" onclick={() => (index -= 1)}>{t("tipBack")}</button>
      {/if}
      <button
        type="button"
        class="next"
        onclick={() => {
          if (last) onDone(stop);
          else index += 1;
        }}
      >
        {last ? t("tipDone") : t("tipNext")}
      </button>
    </div>
  </div>
</div>

<style>
  .ring {
    position: fixed;
    z-index: 40;
    border-radius: var(--pv-radius-sm);
    box-shadow:
      0 0 0 2px var(--pv-accent),
      0 0 0 6px color-mix(in srgb, var(--pv-accent) 18%, transparent);
    pointer-events: none;
    transition:
      top var(--pv-dur) var(--pv-ease),
      left var(--pv-dur) var(--pv-ease),
      width var(--pv-dur) var(--pv-ease),
      height var(--pv-dur) var(--pv-ease);
  }

  .tip {
    position: fixed;
    z-index: 41;
    width: min(320px, calc(100vw - 24px));
    padding: 14px 16px 12px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-md);
    background: var(--pv-chrome-raised);
    color: var(--pv-text);
    box-shadow: var(--pv-shadow-window);
    animation: rise var(--pv-dur) var(--pv-ease);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-text-subtle);
  }

  .close :global(svg) {
    width: 14px;
    height: 14px;
  }

  .close:hover {
    background: var(--pv-selected);
  }

  .count {
    margin: 0 0 2px;
    color: var(--pv-text-faint);
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-eyebrow);
    text-transform: uppercase;
  }

  h2 {
    margin: 0 24px 6px 0;
    font-family: var(--pv-font-ui);
    font-size: var(--pv-text-lg);
    font-weight: 600;
  }

  #tip-text {
    margin: 0 0 12px;
    color: var(--pv-text-muted);
    font-size: var(--pv-text-md);
    line-height: 1.45;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .stop {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-sm);
  }

  .stop input {
    accent-color: var(--pv-accent);
  }

  .moves {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .moves button {
    height: 28px;
    padding: 0 12px;
    border-radius: var(--pv-radius-xs);
    font-size: var(--pv-text-md);
  }

  .back {
    border: 1px solid var(--pv-line-strong);
    background: transparent;
    color: var(--pv-text);
  }

  .back:hover {
    background: var(--pv-selected);
  }

  .next {
    border: 0;
    background: var(--pv-accent-solid);
    color: var(--pv-on-accent);
    font-weight: 600;
  }

  .next:hover {
    filter: brightness(1.08);
  }
</style>
