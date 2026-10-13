import { describe, expect, it } from "vitest";
import { encouragementFor, encouragementsAt } from "./encouragement";

describe("Home's encouragement", () => {
  it("has every line in both languages, each ending as a sentence", () => {
    for (const hour of [3, 8, 14, 20]) {
      for (const line of encouragementsAt(hour)) {
        expect(line.en.trim()).toMatch(/[.!]$/);
        expect(line.sl.trim()).toMatch(/[.!]$/);
      }
    }
  });

  it("adds the time of day's own lines, at the hours the greeting changes", () => {
    const at = (hour: number) => encouragementsAt(hour).map((line) => line.en);
    expect(at(8)).toContain("A morning is like a new page.");
    expect(at(14)).toContain("The afternoon is a good time for a few new lines.");
    expect(at(20)).toContain("A few more lines before the day ends.");
    expect(at(23)).toContain("One more page, then rest.");
    expect(at(4)).toContain("One more page, then rest.");
    expect(at(8)).not.toContain("One more page, then rest.");
  });

  it("picks one line for both languages, from the first to the last", () => {
    const lines = encouragementsAt(10);
    expect(encouragementFor(10, 0)).toBe(lines[0]);
    expect(encouragementFor(10, 0.999999)).toBe(lines[lines.length - 1]);
    expect(encouragementFor(10, 1)).toBe(lines[lines.length - 1]);
  });
});
