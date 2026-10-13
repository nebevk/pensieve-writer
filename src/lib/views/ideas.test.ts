import { describe, expect, it } from "vitest";
import type { DocumentJson } from "$lib/model";
import { CARD, edgeOf, ideaLinks, ideaMatches, linkNames, newestFirst, placed, readable, withLink, withoutLinks } from "./ideas";

const idea = (id: string, title: string, text = "", aliases = "", createdAt = "2026-10-13T10:00:00.000Z") => ({ id, title, text, aliases, createdAt });

describe("Ideas", () => {
  it("puts the newest first", () => {
    const list = newestFirst([idea("a", "Prva", "", "", "2026-10-01T10:00:00Z"), idea("b", "Tretja", "", "", "2026-10-13T10:00:00Z"), idea("c", "Druga", "", "", "2026-10-05T10:00:00Z")]);
    expect(list.map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("finds an idea by its name, other names or text, in any case, with č apart from c", () => {
    const witch = idea("w", "Čarovnica", "Živi pri mlinu.", "Mlinarica");
    expect(ideaMatches(witch, "čarov")).toBe(true);
    expect(ideaMatches(witch, "MLIN")).toBe(true);
    expect(ideaMatches(witch, "mlinarica")).toBe(true);
    expect(ideaMatches(witch, "carovnica")).toBe(false);
    expect(ideaMatches(witch, "  ")).toBe(true);
  });

  it("reads the names an idea's [[links]] point to, each once", () => {
    expect(linkNames("Glej [[Stara hiša]] in [[Most čez Savo|most]], spet [[Stara hiša]].")).toEqual(["Stara hiša", "Most čez Savo"]);
    expect(linkNames("Brez povezav.")).toEqual([]);
  });

  it("reads a card's text with each link as its words, and no gaps between lines", () => {
    expect(readable("\n\nOb reki stoji. Zgradila jo je [[Čarovnica]].\n\n[[Most čez Savo|Most]] je blizu.\n")).toBe("Ob reki stoji. Zgradila jo je Čarovnica.\nMost je blizu.");
  });

  it("links ideas by name or other name, in any case, never to themselves, once each", () => {
    const ideas = [
      idea("house", "Stara hiša", "Ob reki. [[čarovnica]] jo je zgradila. [[Most]] in spet [[Most]]."),
      idea("witch", "Čarovnica", "Živi v [[Stara hiša]]. Sama sebi: [[Čarovnica]]."),
      idea("bridge", "Most čez Savo", "", "Most"),
      idea("lone", "Kaj če", "[[Ni takšne ideje]]"),
    ];
    expect(ideaLinks(ideas)).toEqual([
      { from: "house", to: "witch" },
      { from: "house", to: "bridge" },
      { from: "witch", to: "house" },
    ]);
  });
});

const para = (...texts: string[]) => ({ type: "paragraph", ...(texts.length ? { content: texts.map((text) => ({ type: "text", text })) } : {}) });
const doc = (...content: object[]) => ({ type: "doc", content }) as DocumentJson;

describe("The ideas map", () => {
  it("links an idea as she would type it: in its empty last line, else on a line of its own", () => {
    expect(withLink(doc(para()), "Čarovnica")).toEqual({ contentJson: doc(para("[[Čarovnica]]")), plainText: "[[Čarovnica]]" });
    const linked = withLink(doc(para("Ob reki stoji.")), "Most čez Savo");
    expect(linked.contentJson).toEqual(doc(para("Ob reki stoji."), para("[[Most čez Savo]]")));
    expect(linked.plainText).toBe("Ob reki stoji.\n\n[[Most čez Savo]]");
  });

  it("takes a link away by any of the idea's names, in any case, and a line left empty with it", () => {
    const before = doc(para("Ob reki stoji. Zgradila jo je [[čarovnica|ona]]."), para("[[Mlinarica]]"), para("[[Most]]"));
    const after = withoutLinks(before, ["Čarovnica", "Mlinarica"]);
    expect(after.contentJson).toEqual(doc(para("Ob reki stoji. Zgradila jo je."), para("[[Most]]")));
    expect(after.plainText).toBe("Ob reki stoji. Zgradila jo je.\n\n[[Most]]");
    expect(withoutLinks(doc(para("[[Most]]")), ["Most"]).contentJson).toEqual(doc(para()));
  });

  it("keeps where she put an idea, and puts the rest in rows under them, oldest first", () => {
    const ideas = [
      { id: "a", createdAt: "2026-10-13T10:00:00Z" },
      { id: "b", createdAt: "2026-10-01T10:00:00Z" },
      { id: "c", createdAt: "2026-10-05T10:00:00Z" },
    ];
    const places = placed(ideas, new Map([["a", { x: 400, y: 100 }]]), 2);
    expect(places.get("a")).toEqual({ x: 400, y: 100 });
    const top = 100 + CARD.height;
    expect(places.get("b")!.y).toBeGreaterThan(top);
    expect(places.get("c")!.y).toBe(places.get("b")!.y);
    expect(places.get("c")!.x).toBeGreaterThan(places.get("b")!.x);
  });

  it("meets a card's edge on the way to another", () => {
    expect(edgeOf({ x: 0, y: 0 }, { x: 1000, y: CARD.height / 2 })).toEqual({ x: CARD.width, y: CARD.height / 2 });
    expect(edgeOf({ x: 0, y: 0 }, { x: CARD.width / 2, y: -500 })).toEqual({ x: CARD.width / 2, y: 0 });
  });
});
