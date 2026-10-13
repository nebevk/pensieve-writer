import { describe, expect, it } from "vitest";
import { copyPathFor } from "./copies.svelte";

const FOLDER = "C:\\Users\\Eva\\Documents\\Word";
const at = (name: string) => `${FOLDER}\\${name}`;

describe("each writing's own Word copy", () => {
  it("is the writing's name in the folder", () => {
    expect(copyPathFor(FOLDER, "Moj prvi projekt - Brez naslova", "a", {})).toBe(at("Moj prvi projekt - Brez naslova.docx"));
  });

  it("stays the writing's own once it has it", () => {
    const copies = { [at("Zgodbe ob reki.docx")]: { writing: "a" } };
    expect(copyPathFor(FOLDER, "Zgodbe ob reki", "a", copies)).toBe(at("Zgodbe ob reki.docx"));
  });

  it("gets a number when another writing's copy has the name, two projects of the same name say", () => {
    const copies = {
      [at("Moj prvi projekt - Brez naslova.docx")]: { writing: "a" },
      [at("Moj prvi projekt - Brez naslova (2).docx")]: { writing: "b" },
    };
    expect(copyPathFor(FOLDER, "Moj prvi projekt - Brez naslova", "b", copies)).toBe(at("Moj prvi projekt - Brez naslova (2).docx"));
    expect(copyPathFor(FOLDER, "Moj prvi projekt - Brez naslova", "c", copies)).toBe(at("Moj prvi projekt - Brez naslova (3).docx"));
  });

  it("tells names apart as Windows does, without regard to capitals, č, š and ž included", () => {
    const copies = { [at("čaša in ŠKAF.docx")]: { writing: "a" } };
    expect(copyPathFor(FOLDER, "Čaša in škaf", "b", copies)).toBe(at("Čaša in škaf (2).docx"));
  });

  it("lets the first writing that writes a copy from before copies knew their writing take it", () => {
    const copies = { [at("Brez naslova.docx")]: {} };
    expect(copyPathFor(FOLDER, "Brez naslova", "a", copies)).toBe(at("Brez naslova.docx"));
  });
});
