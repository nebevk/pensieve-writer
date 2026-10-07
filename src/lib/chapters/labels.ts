import type { WritingLanguage } from "$lib/model";

const NAMES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
// Slovenian ordinals agree with the noun: "prvo poglavje" (neuter).
const SL_NEUTER = ["Prvo", "Drugo", "Tretje", "Četrto", "Peto", "Šesto", "Sedmo", "Osmo", "Deveto", "Deseto", "Enajsto", "Dvanajsto"];

/** The label above a chapter's title, as on the page, in the writing's language: "Chapter Three", "Tretje poglavje". */
export function chapterName(index: number, language: WritingLanguage = "en"): string {
  if (language === "sl") {
    const ordinal = SL_NEUTER[index];
    return ordinal ? `${ordinal} poglavje` : `${index + 1}. poglavje`;
  }
  return NAMES[index] ? `Chapter ${NAMES[index]}` : `Chapter ${index + 1}`;
}

/** Roman numerals for the running head: 3 → "III". */
export function roman(value: number): string {
  const pairs: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = value;
  let text = "";
  for (const [amount, glyph] of pairs) {
    while (rest >= amount) {
      text += glyph;
      rest -= amount;
    }
  }
  return text || String(value);
}
