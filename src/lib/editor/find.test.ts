import { describe, expect, it } from "vitest";
import type { DocumentJson } from "$lib/model";
import { replaceInChapterText } from "./find";

const ANY = { matchCase: false, wholeWord: false };
const text = (value: string, bold = false) => ({ type: "text", text: value, ...(bold ? { marks: [{ type: "bold" }] } : {}) });
const doc = (...lines: object[][]) => ({ type: "doc", content: lines.map((content) => ({ type: "paragraph", ...(content.length ? { content } : {}) })) }) as DocumentJson;

describe("Replace in a saved chapter", () => {
  it("replaces in the text and its plain copy, in any case, č apart from c", () => {
    const next = replaceInChapterText({ contentJson: doc([text("Ana je šla. ANA in Cana.")], [text("Čas za Ano.")]), plainText: "Ana je šla. ANA in Cana.\n\nČas za Ano." }, "ana", "Hana", ANY);
    expect(next.count).toBe(3);
    expect(next.contentJson).toEqual(doc([text("Hana je šla. Hana in CHana.")], [text("Čas za Ano.")]));
    expect(next.plainText).toBe("Hana je šla. Hana in CHana.\n\nČas za Ano.");
  });

  it("finds a word partly in bold, and gives the new one the look of its first letter", () => {
    const next = replaceInChapterText({ contentJson: doc([text("Stara "), text("hi", true), text("ša ob reki.")]), plainText: "Stara hiša ob reki." }, "hiša", "koča", ANY);
    expect(next.contentJson).toEqual(doc([text("Stara "), text("koča", true), text(" ob reki.")]));
    expect(next.plainText).toBe("Stara koča ob reki.");
  });

  it("keeps Aa and ab, and takes the new words as they are, $ and all", () => {
    const chapter = { contentJson: doc([text("Reka, reka in rekač.")]), plainText: "Reka, reka in rekač." };
    expect(replaceInChapterText(chapter, "reka", "potok", { matchCase: true, wholeWord: true }).plainText).toBe("Reka, potok in rekač.");
    expect(replaceInChapterText(chapter, "reka", "$&$1", { matchCase: false, wholeWord: true }).plainText).toBe("$&$1, $&$1 in rekač.");
  });

  it("leaves a chapter without the words as it was, and a line emptied empty", () => {
    const chapter = { contentJson: doc([text("Brez.")]), plainText: "Brez." };
    expect(replaceInChapterText(chapter, "reka", "potok", ANY)).toEqual({ ...chapter, count: 0 });
    expect(replaceInChapterText({ contentJson: doc([text("reka")]), plainText: "reka" }, "reka", "", ANY).contentJson).toEqual({ type: "doc", content: [{ type: "paragraph", content: [] }] });
  });
});
