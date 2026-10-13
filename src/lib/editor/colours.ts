import type { UiKey } from "$lib/i18n";

/**
 * The colours of the toolbar's text colour and highlight (TOOL-5), as Word offers them: the look's own accent
 * first (the colour Pensieve had alone before 14 October), then a few that read well on every look's paper.
 * In a Word file each is a character style of its own, so the colour comes back when the file is read in.
 */
export type TextColour = "accent" | "red" | "orange" | "green" | "blue" | "purple" | "gray";
export type HighlightColour = "yellow" | "green" | "blue" | "pink" | "orange";
export type Colour<Name extends string> = { name: Name; css: string; hex: string; key: UiKey; style: string; styleName: string };

export const TEXT_COLOURS: Colour<TextColour>[] = [
  { name: "accent", css: "var(--pv-ink-accent, #a94f2e)", hex: "A94F2E", key: "colourAccent", style: "PensieveAccent", styleName: "Pensieve Accent" },
  { name: "red", css: "#b3261e", hex: "B3261E", key: "colourRed", style: "PensieveRed", styleName: "Pensieve Red" },
  { name: "orange", css: "#a85512", hex: "A85512", key: "colourOrange", style: "PensieveOrange", styleName: "Pensieve Orange" },
  { name: "green", css: "#2e7d3c", hex: "2E7D3C", key: "colourGreen", style: "PensieveGreen", styleName: "Pensieve Green" },
  { name: "blue", css: "#1f5c99", hex: "1F5C99", key: "colourBlue", style: "PensieveBlue", styleName: "Pensieve Blue" },
  { name: "purple", css: "#6b3fa0", hex: "6B3FA0", key: "colourPurple", style: "PensievePurple", styleName: "Pensieve Purple" },
  { name: "gray", css: "#6e675e", hex: "6E675E", key: "colourGray", style: "PensieveGray", styleName: "Pensieve Gray" },
];

export const HIGHLIGHTS: Colour<HighlightColour>[] = [
  { name: "yellow", css: "#f2dc8f", hex: "F2DC8F", key: "highlightYellow", style: "PensieveHighlight", styleName: "Pensieve Highlight" },
  { name: "green", css: "#cfe8c4", hex: "CFE8C4", key: "highlightGreen", style: "PensieveHighlightGreen", styleName: "Pensieve Highlight Green" },
  { name: "blue", css: "#cde0f5", hex: "CDE0F5", key: "highlightBlue", style: "PensieveHighlightBlue", styleName: "Pensieve Highlight Blue" },
  { name: "pink", css: "#f5d0df", hex: "F5D0DF", key: "highlightPink", style: "PensieveHighlightPink", styleName: "Pensieve Highlight Pink" },
  { name: "orange", css: "#f7d6b0", hex: "F7D6B0", key: "highlightOrange", style: "PensieveHighlightOrange", styleName: "Pensieve Highlight Orange" },
];

/** A text colour by its name, the accent for one Pensieve doesn't know. */
export function textColour(name: unknown): Colour<TextColour> {
  return TEXT_COLOURS.find((colour) => colour.name === name) ?? TEXT_COLOURS[0];
}

/** A highlight by its name, yellow for one Pensieve doesn't know. */
export function highlightColour(name: unknown): Colour<HighlightColour> {
  return HIGHLIGHTS.find((colour) => colour.name === name) ?? HIGHLIGHTS[0];
}

/** Word's own highlight colours (another writer's file), as the nearest of Pensieve's. */
export function highlightFromWord(word: string): HighlightColour {
  const name = word.toLowerCase();
  if (/green/.test(name)) return "green";
  if (/blue|cyan|turquoise|teal/.test(name)) return "blue";
  if (/magenta|pink|red|violet/.test(name)) return "pink";
  return "yellow";
}
