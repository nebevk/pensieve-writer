export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function formatCount(words: number, characters: number): string {
  const wordLabel = words === 1 ? "word" : "words";
  return `${words} ${wordLabel} · ${characters} characters`;
}
