<script lang="ts">
  import Icon from "$lib/editor/Icon.svelte";
  import type { Note } from "$lib/storage/organize";
  import { t } from "$lib/ui.svelte";
  import { CARD, edgeOf, placed, readable, type IdeaLink, type Place } from "./ideas";

  let {
    ideas,
    links,
    places,
    matches = null,
    openId = "",
    onOpen,
    onMove,
    onLink,
    onUnlink,
    onCreateAt,
  }: {
    /** The project's ideas, and the links between them. */
    ideas: Note[];
    links: IdeaLink[];
    /** Where she put each idea; one she hasn't placed sits in rows under the rest. */
    places: Map<string, Place>;
    /** The ideas with the words searched for; the others fade. Null with nothing searched. */
    matches?: Set<string> | null;
    openId?: string;
    onOpen: (id: string) => void;
    onMove: (id: string, place: Place) => void;
    onLink: (from: string, to: string) => void;
    onUnlink: (from: string, to: string) => void;
    onCreateAt: (place: Place) => void;
  } = $props();

  let plane = $state<HTMLElement | undefined>(undefined);
  // An idea being dragged, where it is now; a link being drawn from an idea's dot; a line picked to take away.
  let moving = $state<{ id: string; place: Place } | null>(null);
  let drawing = $state<{ from: string; to: Place } | null>(null);
  let picked = $state<IdeaLink | null>(null);

  const at = $derived(placed(ideas, places));
  const where = (id: string): Place | undefined => (moving?.id === id ? moving.place : at.get(id));
  const middle = (place: Place): Place => ({ x: place.x + CARD.width / 2, y: place.y + CARD.height / 2 });
  // The sheet reaches past the furthest idea, so there is always room to put one further out.
  const size = $derived.by(() => {
    let width = 1400;
    let height = 900;
    for (const place of at.values()) {
      width = Math.max(width, place.x + CARD.width + 400);
      height = Math.max(height, place.y + CARD.height + 300);
    }
    return { width, height };
  });
  const lines = $derived(
    links.flatMap((link) => {
      const from = where(link.from);
      const to = where(link.to);
      if (!from || !to) return [];
      const start = edgeOf(from, middle(to));
      const end = edgeOf(to, middle(from));
      return [{ link, start, end }];
    }),
  );

  function onSheet(event: { clientX: number; clientY: number }): Place {
    const box = plane?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  }

  /** An idea picked up: dragged, it moves; let go where it was, it opens. */
  function grab(event: PointerEvent, id: string) {
    if (event.button !== 0) return;
    const origin = at.get(id);
    if (!origin) return;
    picked = null;
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x;
      const dy = next.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      moving = { id, place: { x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) } };
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const done = moving;
      moving = null;
      if (moved && done) onMove(id, done.place);
      else onOpen(id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** A line drawn from an idea's dot: let go on another idea, the two are linked. */
  function draw(event: PointerEvent, from: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    picked = null;
    drawing = { from, to: onSheet(event) };
    const move = (next: PointerEvent) => {
      if (drawing) drawing = { from, to: onSheet(next) };
    };
    const up = (last: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      drawing = null;
      const target = document.elementFromPoint(last.clientX, last.clientY)?.closest<HTMLElement>(".map-card")?.dataset.id;
      if (target && target !== from) onLink(from, target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** A double click where there is no idea: a new one there. */
  function createHere(event: MouseEvent) {
    if ((event.target as Element).closest(".map-card, .unlink")) return;
    const place = onSheet(event);
    onCreateAt({ x: Math.max(0, place.x - CARD.width / 2), y: Math.max(0, place.y - CARD.height / 2) });
  }
</script>

<!-- The ideas map (owner, 13 October): her ideas where she puts them, a line for each [[link]] between them. -->
<div class="map">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="plane"
    bind:this={plane}
    style:width="{size.width}px"
    style:height="{size.height}px"
    ondblclick={createHere}
    onpointerdown={(event) => {
      if (!(event.target as Element).closest(".link-hit, .unlink")) picked = null;
    }}
  >
    <svg class="lines" width={size.width} height={size.height} aria-hidden="true">
      <defs>
        <marker id="idea-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" class="head" />
        </marker>
      </defs>
      {#each lines as line (`${line.link.from}>${line.link.to}`)}
        {@const chosen = picked?.from === line.link.from && picked?.to === line.link.to}
        <line class="link" class:chosen x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} marker-end="url(#idea-arrow)" />
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <line class="link-hit" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} onclick={() => (picked = line.link)} />
      {/each}
      {#if drawing}
        {@const from = where(drawing.from)}
        {#if from}
          <line class="draft" x1={middle(from).x} y1={middle(from).y} x2={drawing.to.x} y2={drawing.to.y} />
        {/if}
      {/if}
    </svg>
    {#each ideas as idea (idea.id)}
      {@const place = where(idea.id)}
      {#if place}
        <div
          class="map-card"
          class:open={idea.id === openId}
          class:dim={matches !== null && !matches.has(idea.id)}
          class:moving={moving?.id === idea.id}
          data-id={idea.id}
          style:left="{place.x}px"
          style:top="{place.y}px"
          role="button"
          tabindex="0"
          aria-label={idea.title}
          onpointerdown={(event) => grab(event, idea.id)}
          onkeydown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen(idea.id);
            }
          }}
        >
          <span class="title">{idea.title || t("untitled")}</span>
          {#if idea.plainText.trim()}<span class="text">{readable(idea.plainText)}</span>{/if}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span class="dot" title={t("ideasMapHint")} onpointerdown={(event) => draw(event, idea.id)}></span>
        </div>
      {/if}
    {/each}
    {#if picked}
      {@const chosen = lines.find((line) => line.link.from === picked?.from && line.link.to === picked?.to)}
      {#if chosen}
        <button
          type="button"
          class="unlink"
          style:left="{(chosen.start.x + chosen.end.x) / 2}px"
          style:top="{(chosen.start.y + chosen.end.y) / 2}px"
          onclick={() => {
            if (picked) onUnlink(picked.from, picked.to);
            picked = null;
          }}
        >
          <Icon name="x" />{t("ideaUnlink")}
        </button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .map {
    flex: 1;
    min-width: 0;
    overflow: auto;
    background-image: radial-gradient(var(--pv-line-strong) 1px, transparent 1px);
    background-size: 22px 22px;
  }

  .plane {
    position: relative;
  }

  .lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .link {
    stroke: var(--pv-ink-rule-accent);
    stroke-width: 1.6;
  }

  .link.chosen {
    stroke: var(--pv-accent);
    stroke-width: 2.4;
  }

  .head {
    fill: var(--pv-ink-rule-accent);
  }

  /* A wide, unseen line over each link, so it is easy to pick. */
  .link-hit {
    stroke: transparent;
    stroke-width: 14;
    pointer-events: stroke;
    cursor: pointer;
  }

  .draft {
    stroke: var(--pv-accent);
    stroke-width: 1.6;
    stroke-dasharray: 5 4;
  }

  .map-card {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 184px;
    height: 84px;
    overflow: hidden;
    border: 1px solid var(--pv-line);
    border-radius: var(--pv-radius-sm);
    padding: 10px 14px 8px;
    background: var(--pv-paper);
    box-shadow: var(--pv-shadow-card);
    color: var(--pv-ink);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .map-card.moving {
    cursor: grabbing;
    box-shadow: var(--pv-shadow-sheet);
    z-index: 2;
  }

  .map-card.open {
    outline: 2px solid var(--pv-accent);
    outline-offset: -1px;
  }

  .map-card.dim {
    opacity: 0.35;
  }

  .map-card .title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: var(--pv-font-heading);
    font-size: 15px;
  }

  .map-card .text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-line;
    font-family: var(--pv-font-manuscript);
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--pv-ink-2);
  }

  /* The dot a link is drawn from. */
  .dot {
    position: absolute;
    right: -1px;
    top: 50%;
    width: 12px;
    height: 12px;
    margin-top: -6px;
    border: 2px solid var(--pv-paper);
    border-radius: 50%;
    background: var(--pv-accent);
    cursor: crosshair;
    opacity: 0.55;
  }

  .map-card:hover .dot,
  .map-card.open .dot {
    opacity: 1;
  }

  .unlink {
    position: absolute;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    transform: translate(-50%, -50%);
    border: 1px solid var(--pv-line-strong);
    border-radius: 13px;
    padding: 0 10px;
    background: var(--pv-chrome-raised);
    color: var(--pv-text);
    font-size: 12px;
    box-shadow: var(--pv-shadow-card);
  }

  .unlink :global(svg) {
    width: 12px;
    height: 12px;
  }
</style>
