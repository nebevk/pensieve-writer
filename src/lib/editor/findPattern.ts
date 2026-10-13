/**
 * What Find looks for (owner, 13 October), on the page and across projects alike: the words in any case, or
 * with Aa the capitals as typed; with ab whole words only. č, š and ž are never c, s and z.
 */

export type FindOptions = { matchCase: boolean; wholeWord: boolean };

const SPECIAL = /[.*+?^${}()|[\]\\]/g;
/** A letter, mark or digit: what a whole word may not run on into. */
const WORD = "[\\p{L}\\p{M}\\p{N}_]";

/** The words as a pattern, or null for none: in any case unless `matchCase`; with `wholeWord`, never part of a longer word. */
export function findPattern(query: string, options: FindOptions): RegExp | null {
  const words = query.trim();
  if (!words) return null;
  const body = words.replace(SPECIAL, "\\$&");
  return new RegExp(options.wholeWord ? `(?<!${WORD})${body}(?!${WORD})` : body, options.matchCase ? "gu" : "giu");
}
