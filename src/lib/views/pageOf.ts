/**
 * About how much of a writing a page holds, in characters, for "p. 4": what a sheet of A4 holds in Write at
 * the usual 12 points (measured 13 October), so the page given is about the sheet she sees there.
 */
export const PAGE_CHARACTERS = 2750;

/** The page a place in a chapter's text is on (its offset, from 0), as Write's sheets count them: about. */
export function pageAt(offset: number): number {
  return Math.floor(Math.max(0, offset) / PAGE_CHARACTERS) + 1;
}
