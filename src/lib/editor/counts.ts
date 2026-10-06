import { num } from "$lib/ui.svelte";

/**
 * Words are runs of anything but white space, the ones `text.trim().split(/\s+/)` would list. They are
 * counted in one pass without making that list, which for a whole book is a hundred thousand strings.
 */
export function countWords(text: string): number {
  let words = 0;
  let inWord = false;
  for (let index = 0; index < text.length; index += 1) {
    const space = isSpace(text.charCodeAt(index));
    if (!space && !inWord) words += 1;
    inWord = !space;
  }
  return words;
}

/** The characters `\s` matches. */
function isSpace(code: number): boolean {
  return (
    code === 32 ||
    (code >= 9 && code <= 13) ||
    (code > 127 &&
      (code === 0xa0 ||
        code === 0x1680 ||
        (code >= 0x2000 && code <= 0x200a) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x202f ||
        code === 0x205f ||
        code === 0x3000 ||
        code === 0xfeff))
  );
}

const wordMemory = new Map<string, { text: string; words: number }>();

/** Recount a chapter only when its text has actually changed. */
export function wordsFor(id: string, text: string): number {
  const remembered = wordMemory.get(id);
  if (remembered && remembered.text === text) return remembered.words;
  const words = countWords(text);
  wordMemory.set(id, { text, words });
  return words;
}

export function compactWords(words: number): string {
  if (words < 1000) return String(words);
  const thousands = words / 1000;
  const rounded = thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
  return `${num(rounded)}k`;
}

export function formatCount(words: number, characters: number): string {
  const wordLabel = words === 1 ? "word" : "words";
  return `${words} ${wordLabel} · ${characters} characters`;
}
