import { describe, expect, it } from "vitest";
import { PAGE_CHARACTERS, pageAt } from "./pageOf";

describe("the page a place is on", () => {
  it("counts a sheet of A4 at a time, from page 1", () => {
    expect(pageAt(0)).toBe(1);
    expect(pageAt(-3)).toBe(1);
    expect(pageAt(PAGE_CHARACTERS - 1)).toBe(1);
    expect(pageAt(PAGE_CHARACTERS)).toBe(2);
    expect(pageAt(PAGE_CHARACTERS * 46 + 10)).toBe(47);
  });
});
