import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrefs, resolvedTheme } from "./prefs";

/** Settings as a computer has them saved, read back the way the app starts. */
function loadSaved(saved: object | null) {
  vi.stubGlobal("localStorage", {
    getItem: () => (saved ? JSON.stringify(saved) : null),
    setItem: () => undefined,
  });
  return loadPrefs();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings", () => {
  it("start in Slovenian, with 12 pt text and a daily goal of 500 words", () => {
    const prefs = loadSaved(null);
    expect(prefs.uiLanguage).toBe("sl");
    expect(prefs.manuscriptPt).toBe(12);
    expect(prefs.dailyGoal).toBe(500);
    expect(prefs.panel).toBe("");
    expect(prefs.sidebarView).toBe("chapters");
  });

  it("remember whether the list beside the page shows chapters or the library", () => {
    expect(loadSaved({ sidebarView: "library" }).sidebarView).toBe("library");
    expect(loadSaved({ sidebarView: "tree" }).sidebarView).toBe("chapters");
  });

  it("remember the Sunset look, and Day and night switching from Daylight to Candlelit after dark", () => {
    expect(loadSaved({ theme: "dusk" }).theme).toBe("dusk");
    expect(loadSaved({ theme: "sunset" }).theme).toBe("sunset");
    expect(resolvedTheme("dusk", new Date(2026, 9, 7, 22))).toBe("dusk");
    expect(resolvedTheme("sunset", new Date(2026, 9, 7, 12))).toBe("daylight");
    expect(resolvedTheme("sunset", new Date(2026, 9, 7, 22))).toBe("candlelit");
  });

  it("keep English where it was chosen, and are Slovenian otherwise", () => {
    expect(loadSaved({ uiLanguage: "en" }).uiLanguage).toBe("en");
    expect(loadSaved({ uiLanguage: "sl" }).uiLanguage).toBe("sl");
    expect(loadSaved({ theme: "moonlit" }).uiLanguage).toBe("sl");
  });

  it("turn the old text size in pixels into points, the old default 17 px into 12 pt", () => {
    expect(loadSaved({ manuscriptSize: 17 }).manuscriptPt).toBe(12);
    expect(loadSaved({ manuscriptSize: 15 }).manuscriptPt).toBe(11.5);
    expect(loadSaved({ manuscriptSize: 24 }).manuscriptPt).toBe(18);
    expect(loadSaved({ manuscriptPt: 14, manuscriptSize: 24 }).manuscriptPt).toBe(14);
    expect("manuscriptSize" in loadSaved({ manuscriptSize: 15 })).toBe(false);
  });

  it("keep the list beside the page, the Goals list too, and read the old two switches", () => {
    expect(loadSaved({ panel: "goals" }).panel).toBe("goals");
    expect(loadSaved({ panelTodos: true }).panel).toBe("todos");
    expect(loadSaved({ panelTodos: true, panelNotes: true }).panel).toBe("notes");
    expect(loadSaved({ panel: "streak" }).panel).toBe("");
  });

  it("start quiet every time, keeping the volume, which begins at 10 of 100", () => {
    expect(loadSaved(null).ambience).toBe("off");
    expect(loadSaved(null).ambienceVolume).toBe(0.1);
    const saved = loadSaved({ ambience: "rain", ambienceVolume: 0.6 });
    expect(saved.ambience).toBe("off");
    expect(saved.ambienceVolume).toBe(0.6);
  });

  it("open the full toolbar until it is closed, and remember that", () => {
    expect(loadSaved(null).toolsExpanded).toBe(true);
    expect(loadSaved({ toolsExpanded: false }).toolsExpanded).toBe(false);
  });

  it("write on one continuous page until Pages is chosen, on A4 unless A5 is", () => {
    expect(loadSaved(null).paper).toBe("continuous");
    expect(loadSaved(null).paperSize).toBe("a4");
    expect(loadSaved({ paper: "pages", paperSize: "a5" })).toMatchObject({ paper: "pages", paperSize: "a5" });
    expect(loadSaved({ paper: "scroll", paperSize: "letter" })).toMatchObject({ paper: "continuous", paperSize: "a4" });
  });

  it("show the tutorial tips until she stops them, remembering where she has seen them", () => {
    expect(loadSaved(null)).toMatchObject({ tips: true, tipsSeen: [] });
    expect(loadSaved({ tips: false, tipsSeen: ["home", 3, "write"] })).toMatchObject({ tips: false, tipsSeen: ["home", "write"] });
  });

  it("keep a daily goal that was set, 0 for none", () => {
    expect(loadSaved({ dailyGoal: 1000 }).dailyGoal).toBe(1000);
    expect(loadSaved({ dailyGoal: 0 }).dailyGoal).toBe(0);
  });
});
