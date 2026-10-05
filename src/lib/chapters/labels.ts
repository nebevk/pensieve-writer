import type { ProjectKind, WritingLanguage } from "$lib/model";

const NAMES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
// Slovenian ordinals agree with the noun: "prvo poglavje" (neuter), "prva zgodba" (feminine).
const SL_NEUTER = ["Prvo", "Drugo", "Tretje", "Četrto", "Peto", "Šesto", "Sedmo", "Osmo", "Deveto", "Deseto", "Enajsto", "Dvanajsto"];
const SL_FEMININE = ["Prva", "Druga", "Tretja", "Četrta", "Peta", "Šesta", "Sedma", "Osma", "Deveta", "Deseta", "Enajsta", "Dvanajsta"];

/**
 * The label above a chapter's title, as on the page, in the book's language: "Chapter Three",
 * "Tretje poglavje". A story collection labels stories: "Story Three", "Tretja zgodba".
 */
export function chapterName(index: number, language: WritingLanguage = "en", kind: ProjectKind = "novel"): string {
  const story = kind === "stories";
  if (language === "sl") {
    const noun = story ? "zgodba" : "poglavje";
    const ordinal = (story ? SL_FEMININE : SL_NEUTER)[index];
    return ordinal ? `${ordinal} ${noun}` : `${index + 1}. ${noun}`;
  }
  const noun = story ? "Story" : "Chapter";
  return NAMES[index] ? `${noun} ${NAMES[index]}` : `${noun} ${index + 1}`;
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
