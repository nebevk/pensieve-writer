<script lang="ts">
  import { blocksToHtml, documentToBlocks } from "$lib/export/document";
  import type { Chapter } from "$lib/model";
  import { onDestroy } from "svelte";
  import { t } from "$lib/ui.svelte";
  import { BOOK_SIZES, PX_PER_MM, layOutChapter } from "./bookPages";

  let {
    chapters,
    title = "",
    onLaidOut,
    onOpenLink,
  }: {
    chapters: Chapter[];
    /** The book's title, in the running head over the left-hand pages. */
    title?: string;
    /** Every page is laid out (Print waits for this). */
    onLaidOut?: () => void;
    /** A link in the book, clicked: opened outside, as the window has no way back from a web page. */
    onOpenLink?: (href: string) => void;
  } = $props();

  let size = $state<keyof typeof BOOK_SIZES>("a5");
  const book = $derived(BOOK_SIZES[size]);
  const px = (mm: number) => mm * PX_PER_MM;
  // The text's height on one page.
  const room = $derived(px(book.height - book.top - book.bottom));

  const sources = $derived(
    [...chapters]
      .sort((a, b) => a.position - b.position)
      .map((chapter) => ({ title: chapter.title, html: blocksToHtml(documentToBlocks(chapter.contentJson)) })),
  );

  type Page = { chapterTitle: string; opening: boolean; nodes: Node[] };
  let pages = $state.raw<Page[]>([]);
  let laidOut = $state(false);
  let column: HTMLDivElement | undefined = $state();
  let generation = 0;
  // What was laid out last, so the same chapters at the same size aren't laid out again.
  let laidFor = "";

  // A printed book's openings: page 1 on the right alone, then each left page with the right one after it.
  const spreads = $derived.by(() => {
    const list: (Page | null)[][] = [[null, pages[0] ?? null]];
    for (let index = 1; index < pages.length; index += 2) list.push([pages[index], pages[index + 1] ?? null]);
    return pages.length ? list : [];
  });

  $effect(() => {
    const target = column;
    const list = sources;
    const height = room;
    const key = `${size}|${JSON.stringify(list)}`;
    if (!target || key === laidFor) return;
    laidFor = key;
    const run = ++generation;
    void layOutBook(target, list, height, run);
  });

  // Leaving the Book view stops a layout still under way.
  onDestroy(() => {
    generation += 1;
  });

  /** Lays the chapters out one at a time, each from a new page, letting the window breathe between them. */
  async function layOutBook(target: HTMLDivElement, list: typeof sources, height: number, run: number) {
    laidOut = false;
    await document.fonts.ready;
    const laid: Page[] = [];
    for (const chapter of list) {
      if (run !== generation) return;
      const heading = document.createElement("h2");
      heading.className = "chapter-title";
      heading.textContent = chapter.title;
      target.replaceChildren(heading);
      target.insertAdjacentHTML("beforeend", chapter.html);
      await Promise.all([...target.querySelectorAll("img")].map((image) => image.decode().catch(() => undefined)));
      // A face the chapter uses for the first time (its italics, say) loads once the text is laid out;
      // measured before that, its lines would break elsewhere.
      void target.offsetHeight;
      await document.fonts.ready;
      if (run !== generation) return;
      layOutChapter(target, height).forEach((nodes, index) => laid.push({ chapterTitle: chapter.title, opening: index === 0, nodes }));
      pages = laid.slice();
      await new Promise((resolve) => setTimeout(resolve));
    }
    if (run !== generation) return;
    target.replaceChildren();
    laidOut = true;
    onLaidOut?.();
  }

  /** Puts a page's blocks into its text area. */
  function fill(element: HTMLElement, nodes: Node[]) {
    let shown = nodes;
    element.replaceChildren(...nodes);
    return {
      update(next: Node[]) {
        if (next === shown) return;
        shown = next;
        element.replaceChildren(...next);
      },
    };
  }

  /** A link on the pages opens outside, never in the window (the book's links have no target of their own). */
  function links(element: HTMLElement) {
    const open = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) return;
      event.preventDefault();
      onOpenLink?.(link.getAttribute("href") ?? "");
    };
    element.addEventListener("click", open);
    return { destroy: () => element.removeEventListener("click", open) };
  }
</script>

<svelte:head>
  <!-- A printer's sheet is the book's page. -->
  {@html `<style>@page { size: ${book.width}mm ${book.height}mm; margin: 0; }</style>`}
</svelte:head>

<section
  class="book"
  data-laid-out={laidOut ? "" : undefined}
  style:--page-w="{px(book.width)}px"
  style:--page-h="{px(book.height)}px"
  style:--inner="{px(book.inner)}px"
  style:--outer="{px(book.outer)}px"
  style:--top="{px(book.top)}px"
  style:--bottom="{px(book.bottom)}px"
  style:--room="{room}px"
  style:--book-pt="{book.pt}pt"
>
  <div class="bar">
    <label>
      {t("page")}
      <select bind:value={size}>
        <option value="a5">A5</option>
        <option value="pocket">{t("pocketSize")}</option>
      </select>
    </label>
    <button type="button" disabled={!laidOut} onclick={() => window.print()}>{t("printOrPdf")}</button>
  </div>
  <!-- Where a chapter is measured as one long column before it is cut into pages. -->
  <div class="copy column" bind:this={column} aria-hidden="true"></div>
  <div class="spreads" use:links>
    {#each spreads as spread, index (index)}
      <div class="spread">
        {#each spread as page, side (side)}
          {#if page}
            {@const number = index * 2 + side}
            <article class="page" class:verso={side === 0} class:recto={side === 1}>
              {#if !page.opening}
                <p class="head">{side === 0 ? title : page.chapterTitle}</p>
              {/if}
              <div class="copy text" class:opening={page.opening} use:fill={page.nodes}></div>
              <p class="folio">{number}</p>
            </article>
          {:else}
            <div class="page blank" aria-hidden="true"></div>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
</section>

<style>
  .book {
    position: relative;
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

  .bar button:hover:not(:disabled) {
    background: var(--pv-selected);
  }

  .bar button:active:not(:disabled) {
    background: var(--pv-pressed);
  }

  .bar button:disabled {
    opacity: 0.5;
  }

  .spreads {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    padding: 4px 16px 48px;
  }

  /* Two facing pages meet at the spine; in a narrow window they stand one under the other. */
  .spread {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }

  /* A sheet of paper: light in every theme, with a shadow rather than an outline. */
  .page {
    position: relative;
    flex: none;
    width: var(--page-w);
    height: var(--page-h);
    background-color: var(--pv-paper);
    color: var(--pv-ink);
    color-scheme: light;
    box-shadow: var(--pv-shadow-sheet);
  }

  /* The paper curves into the spine: a soft shade along each page's inner edge. */
  .verso {
    background-image: linear-gradient(to left, color-mix(in srgb, var(--pv-ink) 7%, transparent), transparent 28px);
  }

  .recto {
    background-image: linear-gradient(to right, color-mix(in srgb, var(--pv-ink) 7%, transparent), transparent 28px);
  }

  .blank {
    visibility: hidden;
  }

  /* The text block: the narrower margin at the spine, the wider one outside, the deeper one at the foot. */
  .text,
  .head,
  .folio {
    position: absolute;
  }

  .text {
    top: var(--top);
    height: var(--room);
  }

  .verso .text,
  .verso .head,
  .verso .folio {
    left: var(--outer);
    right: var(--inner);
  }

  .recto .text,
  .recto .head,
  .recto .folio {
    left: var(--inner);
    right: var(--outer);
  }

  .head,
  .folio {
    margin: 0;
    text-align: center;
    color: var(--pv-ink-muted);
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    font-size: calc(var(--book-pt) * 0.8);
    line-height: 1;
  }

  /* The running head: the book's title over the left page, the chapter's over the right. */
  .head {
    top: calc(var(--top) / 2 - 0.5em);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folio {
    bottom: calc(var(--bottom) / 2 - 0.5em);
  }

  /* Measured off screen, as wide as a page's text. */
  .column {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(var(--page-w) - var(--inner) - var(--outer));
    visibility: hidden;
    pointer-events: none;
    contain: layout style;
  }

  /*
   * Set as a printed book is: justified, each paragraph's first line indented and no space between,
   * except after a heading, a quotation or a break, and where a page goes on with a paragraph.
   */
  .copy {
    display: flow-root;
    color: var(--pv-ink);
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    font-size: var(--book-pt);
    line-height: 1.45;
  }

  .copy > :global(:first-child:not(.chapter-title)) {
    margin-top: 0;
  }

  .copy :global(p) {
    margin: 0;
    text-indent: 1.3em;
    text-align: justify;
  }

  .copy :global(p.continued),
  .copy :global(p.flush),
  .copy :global(:is(h1, h2, h3, blockquote, hr, ol, ul, img) + p),
  .copy :global(p[style]) {
    text-indent: 0;
  }

  /* The first half of a paragraph a page ends inside fills its last line, as the lines above it do
     (not in verse, whose lines end where she ended them). */
  .copy :global(p.split:not(:has(br))) {
    text-align-last: justify;
  }

  /* A chapter opens a third of the way down its first page. */
  .copy :global(.chapter-title) {
    margin: calc(var(--room) * 0.18) 0 2em;
    font-family: inherit;
    font-size: 1.6em;
    font-weight: 400;
    line-height: 1.25;
    text-align: center;
  }

  .copy :global(:is(h1, h2, h3):not(.chapter-title)) {
    margin: 1.2em 0 0.6em;
    font-family: inherit;
    font-weight: 400;
    font-size: 1.15em;
    line-height: 1.3;
    text-align: center;
  }

  .copy :global(blockquote) {
    margin: 0.7em 1.4em;
    color: var(--pv-ink-2);
  }

  .copy :global(ul),
  .copy :global(ol) {
    margin: 0.6em 0;
    padding-left: 1.4em;
  }

  .copy :global(li p) {
    text-indent: 0;
  }

  .copy :global(a) {
    color: inherit;
    text-decoration: none;
  }

  .copy :global(mark) {
    background: var(--pv-highlight);
    color: inherit;
  }

  /* A break in the text, as a printed book marks one: a short rule in the middle. */
  .copy :global(hr) {
    width: 30%;
    border: 0;
    border-top: 1px solid var(--pv-ink-rule);
    margin: 1.2em auto;
  }

  .copy :global(img) {
    display: block;
    max-width: 100%;
    max-height: var(--room);
    height: auto;
    margin: 0.8em auto;
    object-fit: contain;
  }

  .copy :global(sup.footnote) {
    font-size: 0.7em;
    line-height: 0;
  }

  /* A chapter's footnotes close it, under a short rule. */
  .copy :global(ol.footnotes) {
    margin-top: 1.6em;
    padding-left: 1.4em;
    font-size: 0.82em;
    line-height: 1.45;
  }

  .copy :global(ol.footnotes)::before {
    content: "";
    display: block;
    width: 30%;
    margin: 0 0 0.6em -1.4em;
    border-top: 1px solid var(--pv-ink-rule);
  }

  @media print {
    .book {
      height: auto;
      overflow: visible;
      background: none;
    }

    .bar,
    .blank {
      display: none;
    }

    .spreads {
      display: block;
      padding: 0;
    }

    .spread {
      display: block;
    }

    .page {
      box-shadow: none;
      background-image: none;
      break-after: page;
    }
  }
</style>
