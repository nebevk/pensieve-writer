import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalWord } from "./personalWords.svelte";

// The open project's words, what Windows' spell checker was told, and whether it says no.
let kept: PersonalWord[] = [];
const told: string[] = [];
let windowsRefuses = false;
let fileFails = false;
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (command: string, args: PersonalWord) => {
    told.push(`${command} ${args.language}:${args.word}`);
    if (windowsRefuses) throw "Windows has no spell checker for that language";
  },
}));
vi.mock("$lib/storage/sqlite", () => ({
  listPersonalWords: async () => {
    if (fileFails) throw new Error("unable to open database file");
    return [...kept];
  },
  rememberPersonalWord: async (language: PersonalWord["language"], word: string) => void kept.push({ language, word }),
  forgetPersonalWord: async (language: PersonalWord["language"], word: string) => void (kept = kept.filter((item) => item.language !== language || item.word !== word)),
}));

const { PersonalWords } = await import("./personalWords.svelte");

describe("her own words for the spell checker (IMP-28)", () => {
  let said: string[];
  let words: InstanceType<typeof PersonalWords>;

  beforeEach(() => {
    kept = [{ language: "sl", word: "Mlinarjevka" }];
    told.length = 0;
    windowsRefuses = false;
    fileFails = false;
    said = [];
    words = new PersonalWords({ oneAtATime: (work) => work(), say: (message) => said.push(message) });
  });

  it("reads the project's words, and teaches each to Windows again, even one it refuses", async () => {
    kept.push({ language: "en", word: "Pensieve" });
    windowsRefuses = true;
    await words.refresh();
    expect(words.list).toEqual(kept);
    expect(told).toEqual(["add_personal_word sl:Mlinarjevka", "add_personal_word en:Pensieve"]);
    expect(said).toEqual([]);
  });

  it("adds a word, trimmed, to Windows and the project; an empty one is no word", async () => {
    await words.add("sl", "  Žerjavček ");
    await words.add("en", "   ");
    expect(told).toEqual(["add_personal_word sl:Žerjavček"]);
    expect(words.list.map((item) => item.word)).toEqual(["Mlinarjevka", "Žerjavček"]);
  });

  it("a word Windows won't take isn't kept, and she is told why", async () => {
    windowsRefuses = true;
    await words.add("sl", "Čarovnica");
    expect(kept.map((item) => item.word)).toEqual(["Mlinarjevka"]);
    expect(said).toEqual(["Windows has no spell checker for that language"]);
  });

  it("takes a word out of the project even when Windows keeps its copy", async () => {
    windowsRefuses = true;
    await words.remove("sl", "Mlinarjevka");
    expect([kept, words.list, said]).toEqual([[], [], []]);
    expect(told).toEqual(["remove_personal_word sl:Mlinarjevka"]);
  });

  it("a project file it can't read keeps the list it had", async () => {
    await words.refresh();
    fileFails = true;
    await words.refresh();
    expect(words.list.map((item) => item.word)).toEqual(["Mlinarjevka"]);
  });
});
