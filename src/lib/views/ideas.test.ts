import { describe, expect, it } from "vitest";
import { ideaLinks, ideaMatches, linkNames, newestFirst, readable } from "./ideas";

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
