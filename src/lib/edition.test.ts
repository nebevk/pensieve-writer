import { describe, expect, it } from "vitest";
import { named } from "./edition";
import { translate, uiKeys } from "./i18n";

describe("the app's name in each edition (IMP-29)", () => {
  it("Pensieve's texts are as written", () => {
    const text = "A copy is kept in Pensieve's own folder.";
    expect(named(text, "en", "pensieve")).toBe(text);
    expect(named("zunaj Pensieva", "sl", "pensieve")).toBe("zunaj Pensieva");
  });

  it("Hushed Tales takes its name, its possessive as it ends, and in Slovenian a phrase where Pensieve took an ending", () => {
    expect(named("A copy is kept in Pensieve's own folder, and Pensieve offers it back.", "en", "hushed")).toBe(
      "A copy is kept in Hushed Tales' own folder, and Hushed Tales offers it back.",
    );
    expect(named("»Roman.docx« je bila spremenjena zunaj Pensieva.", "sl", "hushed")).toBe("»Roman.docx« je bila spremenjena zunaj aplikacije Hushed Tales.");
    expect(named("Varne so v mapi Pensieva in Pensieve vam jih ponudi nazaj.", "sl", "hushed")).toBe(
      "Varne so v mapi aplikacije Hushed Tales in Hushed Tales vam jih ponudi nazaj.",
    );
    // The project file's own name, pensieve.db, stays: both apps read it.
    expect(named("That folder already contains a pensieve.db file", "en", "hushed")).toBe("That folder already contains a pensieve.db file");
  });

  it("no text of the interface says Pensieve in Hushed Tales, in either language", () => {
    for (const language of ["en", "sl"] as const) {
      const left = uiKeys.filter((key) => named(translate(language, key), language, "hushed").includes("Pensiev"));
      expect(left, language).toEqual([]);
    }
  });
});
