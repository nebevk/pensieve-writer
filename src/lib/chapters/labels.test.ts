import { describe, expect, it } from "vitest";
import { chapterName, roman } from "./labels";

describe("chapter labels", () => {
  it("names chapters in the writing's language", () => {
    expect(chapterName(2)).toBe("Chapter Three");
    expect(chapterName(12)).toBe("Chapter 13");
    expect(chapterName(2, "sl")).toBe("Tretje poglavje");
    expect(chapterName(3, "sl")).toBe("Četrto poglavje");
    expect(chapterName(12, "sl")).toBe("13. poglavje");
  });

  it("writes Roman numerals for the running head", () => {
    expect(roman(4)).toBe("IV");
    expect(roman(1999)).toBe("MCMXCIX");
  });
});
