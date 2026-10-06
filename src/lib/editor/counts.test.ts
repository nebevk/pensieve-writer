import { describe, expect, it } from "vitest";
import { countWords } from "./counts";

/** How words were counted before: what the counter must still agree with. */
const bySplitting = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

describe("word count", () => {
  it("counts runs of anything but white space", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(" \n\t ")).toBe(0);
    expect(countWords("one")).toBe(1);
    expect(countWords("  one two  ")).toBe(2);
    expect(countWords("Čaša, šola in žaba.")).toBe(4);
    expect(countWords("— she said — and left")).toBe(6);
    // A no-break space parts words; a zero-width space does not.
    expect(countWords("10 000 words")).toBe(3);
    expect(countWords("half​word")).toBe(1);
  });

  it("agrees with splitting on white space, for every kind of space", () => {
    const pieces = ["a", "Ž", "š", "word", "—", ".", " ", "  ", "\n", "\t", "\r\n", " ", " ", "　", " ", "﻿", "​", " "];
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let run = 0; run < 500; run += 1) {
      const text = Array.from({ length: Math.floor(next() * 30) }, () => pieces[Math.floor(next() * pieces.length)]).join("");
      expect(countWords(text), JSON.stringify(text)).toBe(bySplitting(text));
    }
  });
});
