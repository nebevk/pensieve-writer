import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { LONG, NEAR, findRepetitions, sameWord } from "./repetitions";

const schema = getSchema([StarterKit]);
const block = (type: "paragraph" | "heading", text: string) => ({
  type,
  ...(type === "heading" ? { attrs: { level: 2 } } : {}),
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
const page = (...blocks: (string | { heading: string })[]) =>
  schema.nodeFromJSON({ type: "doc", content: blocks.map((item) => (typeof item === "string" ? block("paragraph", item) : block("heading", item.heading))) });
const echoed = (doc: ReturnType<typeof page>) => findRepetitions(doc).echoes.map((echo) => doc.textBetween(echo.from, echo.to));
// Short words count towards how near, and are never echoes themselves.
const filler = (count: number) => Array.from({ length: count }, () => "pes").join(" ");

describe("Repetitions", () => {
  it("marks a word said again close by, both times, wherever it is on the page", () => {
    expect(echoed(page("Stara hiša stoji ob reki.", "Ob reki raste vrba."))).toEqual(["reki", "reki"]);
    expect(echoed(page("Hiša je bila stara. Nihče ni vedel, čigava je hiša."))).toEqual(["Hiša", "hiša"]);
  });

  it("knows a long word in another form, and leaves short ones that only look alike", () => {
    expect(echoed(page("Pogledala je skozi okno. Potem je pogledal še on."))).toEqual(["Pogledala", "pogledal"]);
    expect(sameWord("zelena", "zeleni")).toBe(true);
    expect(sameWord("stran", "strah")).toBe(false);
    expect(sameWord("hiša", "hiše")).toBe(false);
  });

  it("leaves the small words every sentence needs, and the verbs of dialogue", () => {
    expect(echoed(page("Rekel je, da bo prišel. Rekel je še, da bo tudi on. She said that it was that kind of day, she said."))).toEqual([]);
  });

  it("only near: a word said again further on is no echo", () => {
    expect(echoed(page(`Reka teče. ${filler(NEAR - 3)} Reka.`))).toEqual(["Reka", "Reka"]);
    expect(echoed(page(`Reka teče. ${filler(NEAR + 2)} Reka.`))).toEqual([]);
  });

  it("leaves headings out, and starts afresh under one", () => {
    expect(echoed(page({ heading: "Reka" }, "Reka teče mimo."))).toEqual([]);
    expect(echoed(page("Most je star.", { heading: "Drugič" }, "Most je nov."))).toEqual([]);
  });

  it("looks at only the part of the page it is given", () => {
    const doc = page("Reka teče, reka šumi.", "Most je star, most je lep.");
    const second = { from: doc.child(0).nodeSize, to: doc.content.size };
    const found = findRepetitions(doc, second).echoes.map((echo) => doc.textBetween(echo.from, echo.to));
    expect(found).toEqual(["Most", "most"]);
  });

  it("marks a sentence of more than the long one's words, from its first word to its last", () => {
    const doc = page(`Kratek stavek. ${filler(LONG + 5)} konec.`, `Tudi ta ${filler(LONG - 2)}.`);
    const long = findRepetitions(doc).long;
    expect(long).toHaveLength(1);
    expect(long[0].words).toBe(LONG + 6);
    expect(doc.textBetween(long[0].from, long[0].to).startsWith("pes")).toBe(true);
    expect(doc.textBetween(long[0].from, long[0].to).endsWith("konec")).toBe(true);
  });
});
