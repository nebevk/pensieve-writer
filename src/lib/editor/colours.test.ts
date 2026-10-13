import { describe, expect, it } from "vitest";
import { HIGHLIGHTS, TEXT_COLOURS, highlightColour, highlightFromWord, textColour } from "./colours";

describe("the toolbar's colours", () => {
  it("start with the colours Pensieve had alone: the look's accent and yellow", () => {
    expect(TEXT_COLOURS[0].name).toBe("accent");
    expect(HIGHLIGHTS[0].name).toBe("yellow");
    expect(textColour(undefined).name).toBe("accent");
    expect(highlightColour("no such colour").name).toBe("yellow");
  });

  it("keep the Word styles of files written before: Pensieve Accent and Pensieve Highlight", () => {
    expect(textColour("accent").style).toBe("PensieveAccent");
    expect(highlightColour("yellow").style).toBe("PensieveHighlight");
    expect(new Set([...TEXT_COLOURS, ...HIGHLIGHTS].map((colour) => colour.style)).size).toBe(TEXT_COLOURS.length + HIGHLIGHTS.length);
  });

  it("read Word's own highlights as the nearest of Pensieve's", () => {
    expect(highlightFromWord("yellow")).toBe("yellow");
    expect(highlightFromWord("brightGreen")).toBe("green");
    expect(highlightFromWord("cyan")).toBe("blue");
    expect(highlightFromWord("magenta")).toBe("pink");
    expect(highlightFromWord("darkGray")).toBe("yellow");
  });
});
