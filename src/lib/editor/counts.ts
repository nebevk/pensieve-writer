export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
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
  return `${rounded}k`;
}

export function formatCount(words: number, characters: number): string {
  const wordLabel = words === 1 ? "word" : "words";
  return `${words} ${wordLabel} · ${characters} characters`;
}
