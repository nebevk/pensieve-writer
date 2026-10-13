import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { findMatches } from "./findMarks";
import { findPattern } from "./findPattern";

const schema = getSchema([StarterKit]);
const ANY = { matchCase: false, wholeWord: false };
const page = (...lines: object[][]) => schema.nodeFromJSON({ type: "doc", content: lines.map((content) => ({ type: "paragraph", ...(content.length ? { content } : {}) })) });
const text = (value: string, bold = false) => ({ type: "text", text: value, ...(bold ? { marks: [{ type: "bold" }] } : {}) });
const found = (doc: ReturnType<typeof page>, query: string, options = ANY) => findMatches(doc, query, options).map((match) => doc.textBetween(match.from, match.to));

describe("Find on the page", () => {
  it("finds the words in any case, with č apart from c", () => {
    const doc = page([text("Reka je narasla. Ob reki je mlin.")], [text("REKA in čolni, ne colni.")]);
    expect(found(doc, "reka")).toEqual(["Reka", "REKA"]);
    expect(found(doc, "čoln")).toEqual(["čoln"]);
    expect(found(doc, "  reki ")).toEqual(["reki"]);
    expect(found(doc, "  ")).toEqual([]);
  });

  it("matches the capitals as typed with Aa, and whole words only with ab", () => {
    const doc = page([text("Reka, reka, rekač in Rekarjevi.")]);
    expect(found(doc, "Reka", { matchCase: true, wholeWord: false })).toEqual(["Reka", "Reka"]);
    expect(found(doc, "reka", { matchCase: false, wholeWord: true })).toEqual(["Reka", "reka"]);
    expect(found(doc, "Reka", { matchCase: true, wholeWord: true })).toEqual(["Reka"]);
  });

  it("finds words partly in bold, and treats marks in the words as letters", () => {
    const doc = page([text("Stara "), text("hi", true), text("ša ob reki.")]);
    expect(found(doc, "hiša")).toEqual(["hiša"]);
    expect(found(doc, "a ob r")).toEqual(["a ob r"]);
  });

  it("takes the words as they are, signs and all", () => {
    const doc = page([text("Je to (res) 1+1? Da. [[Mlin]]")]);
    expect(found(doc, "(res)")).toEqual(["(res)"]);
    expect(found(doc, "1+1?")).toEqual(["1+1?"]);
    expect(found(doc, "[[mlin]]")).toEqual(["[[Mlin]]"]);
    expect(findPattern("a.b", ANY)?.test("axb")).toBe(false);
  });
});
