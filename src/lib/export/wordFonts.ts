import type { ManuscriptFont } from "$lib/prefs";

/**
 * The manuscript's fonts as Word knows them, and the files packed into a Word file so it looks the same on a
 * computer without them. Words set in a font of their own (TOOL-6) use the same names.
 */
export const WORD_FONTS: Record<ManuscriptFont, { name: string; file?: string }> = {
  literata: { name: "Literata", file: "Literata" },
  garamond: { name: "EB Garamond", file: "EBGaramond" },
  // Every Windows computer has Courier New, so nothing needs packing.
  typewriter: { name: "Courier New" },
};

/** One of the manuscript's fonts by its name in a Word file, or null for any other font. */
export function fontFromWord(name: string | null | undefined): ManuscriptFont | null {
  const wanted = (name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const found = (Object.entries(WORD_FONTS) as [ManuscriptFont, { name: string }][]).find(([, font]) => font.name.toLowerCase() === wanted);
  return found ? found[0] : null;
}
