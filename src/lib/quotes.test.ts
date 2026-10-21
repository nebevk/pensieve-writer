import { describe, expect, it } from "vitest";
import { homeQuote as verse } from "./quotes";

describe("Home's verses", () => {
  it("has each verse in English and Slovenian, the Slovenian marked (SSP) as the Bible Society asks", () => {
    for (let index = 0; index < 40; index += 1) {
      const english = verse(index, "en");
      const slovenian = verse(index, "sl");
      expect(english.text.length > 0 && slovenian.text.length > 0).toBe(true);
      expect(english.reference).toMatch(/^[\p{L}\d ]+ \d+:\d+$/u);
      expect(slovenian.reference).toMatch(/^[\p{L}\d ]+ \d+,\d+ \(SSP\)$/u);
    }
  });

  it("numbers a psalm's verses as the Slovenian Bible does, its heading counted", () => {
    expect(verse(6, "en")).toEqual({ text: "Be still, and know that I am God.", reference: "Psalm 46:10" });
    expect(verse(6, "sl")).toEqual({ text: "Odnehajte in spoznajte, da sem jaz Bog.", reference: "Psalm 46,11 (SSP)" });
  });
});

describe("Hushed Tales' words about writing (IMP-29)", () => {
  it("has each in English and Slovenian, credited to its author, none from the Bible, each short enough for Home", async () => {
    const { WRITING } = await import("./quotes");
    expect(WRITING.length).toBeGreaterThanOrEqual(30);
    for (const quote of WRITING) {
      for (const language of ["en", "sl"] as const) {
        const { text, reference } = quote[language];
        expect(text.trim().length, reference).toBeGreaterThan(0);
        expect(text.length, reference).toBeLessThanOrEqual(240);
        expect(reference, text).toMatch(/^\p{Lu}[\p{L}.’ ]+/u);
        expect(reference, text).not.toMatch(/\(SSP\)|\d+[:,]\d+/);
      }
    }
  });
});
