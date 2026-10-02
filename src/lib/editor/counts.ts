export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
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
