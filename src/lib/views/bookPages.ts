/** A printed book's page in millimetres: its size, the margins (the inner one at the spine), and the text size. */
export type BookSize = { width: number; height: number; inner: number; outer: number; top: number; bottom: number; pt: number };

/**
 * The classic proportions: the two inner margins together make the gutter, so each is narrower than the
 * outer one, and the foot is deeper than the head. A5 (148 × 210 mm) and the 5 × 8 in paperback.
 */
export const BOOK_SIZES = {
  a5: { width: 148, height: 210, inner: 15, outer: 22, top: 18, bottom: 26, pt: 11 },
  pocket: { width: 127, height: 203.2, inner: 13, outer: 19, top: 16, bottom: 24, pt: 10.5 },
} satisfies Record<string, BookSize>;

export const PX_PER_MM = 96 / 25.4;

type Break = { before: Element } | { inside: HTMLElement; node: Text; offset: number };

const SLACK = 1;
const HEADING = /^H[1-6]$/;

/** The non-blank characters of a paragraph, in reading order: where a line may begin. */
function letters(block: HTMLElement): { node: Text; offset: number }[] {
  const found: { node: Text; offset: number }[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const text = node.data;
    for (let offset = 0; offset < text.length; offset += 1) if (text[offset].trim()) found.push({ node, offset });
  }
  return found;
}

function boxOf(letter: { node: Text; offset: number }): DOMRect {
  const range = document.createRange();
  range.setStart(letter.node, letter.offset);
  range.setEnd(letter.node, letter.offset + 1);
  return range.getBoundingClientRect();
}

/**
 * Where each page ends, measured down the chapter as one column: before a block that doesn't fit, or
 * inside a paragraph at the start of the first line that doesn't. As in a printed book, a paragraph
 * leaves no single line alone at the foot of a page or the head of the next, and a heading goes over
 * with the text it heads.
 */
function findBreaks(column: HTMLElement, room: number): Break[] {
  const origin = column.getBoundingClientRect().top;
  const breaks: Break[] = [];
  // Where the open page's text begins.
  let start = 0;
  let previous: { block: Element; top: number } | null = null;

  const breakBefore = (block: Element, top: number) => {
    // A heading at the foot of the page goes over with what it heads; a chapter's title stays on its
    // opening page, whatever follows it.
    const heading =
      previous && HEADING.test(previous.block.tagName) && !previous.block.classList.contains("chapter-title") && previous.top - start > SLACK
        ? previous
        : null;
    breaks.push({ before: heading ? heading.block : block });
    start = heading ? heading.top : top;
  };

  function paragraph(block: HTMLElement, top: number, bottom: number) {
    const all = letters(block);
    const lineHeight = parseFloat(getComputedStyle(block).lineHeight) || 20;
    let partTop = top;
    for (let guard = 0; guard < 200 && bottom - start > room + SLACK; guard += 1) {
      // The first letter whose line ends past the page, then back to where that line begins.
      const lineAt = (past: (box: DOMRect) => boolean) => {
        let low = 0;
        let high = all.length;
        while (low < high) {
          const middle = (low + high) >> 1;
          if (past(boxOf(all[middle]))) high = middle;
          else low = middle + 1;
        }
        if (low >= all.length) return null;
        const here = boxOf(all[low]);
        while (low > 0 && Math.abs(boxOf(all[low - 1]).top - here.top) < (here.bottom - here.top) / 2) low -= 1;
        const box = boxOf(all[low]);
        // The line's own top, half its leading above the letters.
        return { index: low, top: box.top - origin - (lineHeight - (box.bottom - box.top)) / 2 };
      };
      let line = lineAt((box) => box.bottom - origin > start + room + SLACK);
      if (!line) return;
      const before = Math.round((line.top - partTop) / lineHeight);
      const after = Math.round((bottom - line.top) / lineHeight);
      if (before < 2 && partTop === top && top - start > SLACK) {
        // Its first line alone at the foot: the paragraph starts on the next page.
        breakBefore(block, top);
        continue;
      }
      if (after < 2 && before > 2) {
        // Its last line alone at the head of the next page: the line before goes with it.
        const lineTop = line.top;
        line = lineAt((box) => box.top - origin > lineTop - 1.5 * lineHeight) ?? line;
      }
      if (line.top - start < SLACK) return;
      breaks.push({ inside: block, ...all[line.index] });
      start = line.top;
      partTop = line.top;
    }
  }

  function visit(block: Element) {
    const box = block.getBoundingClientRect();
    const top = box.top - origin;
    const bottom = box.bottom - origin;
    if (bottom - start > room + SLACK) {
      if (block.tagName === "BLOCKQUOTE" || block.tagName === "UL" || block.tagName === "OL") {
        // A quotation or a list goes on between the paragraphs or items it holds.
        for (const child of block.children) visit(child);
        return;
      }
      if (block.tagName === "P" && block instanceof HTMLElement && block.textContent?.trim()) paragraph(block, top, bottom);
      else if (top - start > SLACK) breakBefore(block, top);
    }
    previous = { block, top };
  }

  for (const block of column.children) visit(block);
  return breaks;
}

/** The first element down a fragment's first children with the given tag. */
function firstDown(parent: ParentNode, tag: string): Element | null {
  for (let at = parent.firstElementChild; at; at = at.firstElementChild) if (at.tagName === tag) return at;
  return null;
}

/**
 * Lays one chapter out on pages `room` pixels tall. `column` holds the chapter as one column as wide
 * as a page's text and styled like it; it is measured as it lies, then taken apart page by page, from
 * the last page back. A paragraph split by a page end becomes two, the second without its indent, and
 * a numbered list goes on numbering on the next page. Returns each page's blocks, in order.
 */
export function layOutChapter(column: HTMLElement, room: number): Node[][] {
  const breaks = findBreaks(column, room);
  const pages: Node[][] = [];
  for (let index = breaks.length - 1; index >= 0; index -= 1) {
    const cut = breaks[index];
    const range = document.createRange();
    let numbered: { start: number } | null = null;
    if ("inside" in cut) {
      range.setStart(cut.node, cut.offset);
      cut.inside.dataset.split = "";
    } else {
      // A paragraph that follows a heading, a quotation or a break has no indent, and keeps none on its new page.
      if (cut.before.matches(":is(h1, h2, h3, blockquote, hr, ol, ul, img) + p")) cut.before.classList.add("flush");
      range.setStartBefore(cut.before);
      const list = cut.before.parentElement;
      if (cut.before.tagName === "LI" && list instanceof HTMLOListElement) {
        numbered = { start: list.start + [...list.children].indexOf(cut.before) };
      }
    }
    range.setEnd(column, column.childNodes.length);
    const rest = range.extractContents();
    // The paragraph split here: its first half ends the page, its second goes on without an indent.
    const continued = rest.querySelector<HTMLElement>("[data-split]");
    if (continued) {
      delete continued.dataset.split;
      continued.classList.add("continued");
    }
    const ended = column.querySelector<HTMLElement>("[data-split]");
    if (ended) {
      delete ended.dataset.split;
      ended.classList.add("split");
    }
    if (numbered) (firstDown(rest, "OL") as HTMLOListElement | null)?.setAttribute("start", String(numbered.start));
    pages.unshift([...rest.childNodes]);
  }
  pages.unshift([...column.childNodes]);
  return pages;
}
