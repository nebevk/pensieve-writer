import { describe, expect, it } from "vitest";
import { deletedName, rescueName, rescueTail } from "./kept";

const at = new Date(2026, 9, 15, 14, 32, 5);
const bytes = (text: string) => new TextEncoder().encode(text).length;
// kept.rs's own rule for a copy's name.
const rustTakes = (name: string) =>
  bytes(name) <= 200 && name.endsWith(".json") && !/^[. ]/.test(name) && !name.includes("..") && !/[\p{Cc}<>:"/\\|?*]/u.test(name);

describe("kept copies' names", () => {
  it("a rescue copy has its writing, when Pensieve started, and its project, by which it is found", () => {
    const name = rescueName("0f6c2a8e-1b2c-4d5e-9f00-aa11bb22cc33", "Zgodba ob reki", at);
    expect(name).toBe("Zgodba ob reki 2026-10-15 14-32-05 0f6c2a8e-1b2c-4d5e-9f00-aa11bb22cc33.json");
    expect(name.endsWith(rescueTail("0f6c2a8e-1b2c-4d5e-9f00-aa11bb22cc33"))).toBe(true);
    expect(rescueTail("../x")).toBe(" x.json");
  });

  it("a deleted writing's copy has its title and when, with č, š and ž", () => {
    expect(deletedName("Čaša, šola, žaba", at)).toBe("Čaša, šola, žaba 2026-10-15 14-32-05.json");
  });

  it("leaves out what Windows refuses in a name, and what would lead elsewhere", () => {
    expect(deletedName("Moj roman: prvi del? <osnutek>", at)).toBe("Moj roman prvi del osnutek 2026-10-15 14-32-05.json");
    expect(deletedName("..\\..\\prefs", at)).toBe("prefs 2026-10-15 14-32-05.json");
    expect(deletedName("Konec...", at)).toBe("Konec 2026-10-15 14-32-05.json");
    expect(deletedName(" . ", at)).toBe("Untitled 2026-10-15 14-32-05.json");
  });

  it("is always one kept.rs takes: long titles, emoji, every control character", () => {
    const titles = ["x".repeat(300), "😀".repeat(79), "a" + "😀".repeat(100), "Črka\u007fš\u0085ž\u009f\t", "–".repeat(90), "🌲 Gozd – " + "č".repeat(70)];
    for (const title of titles) {
      for (const name of [deletedName(title, at), rescueName("0f6c2a8e-1b2c-4d5e-9f00-aa11bb22cc33", title, at)]) {
        expect(rustTakes(name), name).toBe(true);
        // Never half a letter: an emoji cut in two can't cross to Rust.
        expect(name.isWellFormed(), name).toBe(true);
      }
    }
    expect(deletedName("Črka\u007fš\u0085ž\u009f", at)).toBe("Črkašž 2026-10-15 14-32-05.json");
  });
});
