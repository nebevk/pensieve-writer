import { describe, expect, it } from "vitest";
import { deletedName, rescueName } from "./kept";

const at = new Date(2026, 9, 15, 14, 32, 5);

describe("kept copies' names", () => {
  it("a project's rescue copy is named by the project, so a new one writes over it", () => {
    expect(rescueName("0f6c2a8e-1b2c-4d5e-9f00-aa11bb22cc33")).toBe("0f6c2a8e-1b2c-4d5e-9f00-aa11bb22cc33.json");
    expect(rescueName("../x")).toBe("x.json");
  });

  it("a deleted writing's copy has its title and when, with č, š and ž", () => {
    expect(deletedName("Čaša, šola, žaba", at)).toBe("Čaša, šola, žaba 2026-10-15 14-32-05.json");
  });

  it("leaves out what Windows refuses in a name, and what would lead elsewhere", () => {
    expect(deletedName("Moj roman: prvi del? <osnutek>", at)).toBe("Moj roman prvi del osnutek 2026-10-15 14-32-05.json");
    expect(deletedName("..\\..\\prefs", at)).toBe("prefs 2026-10-15 14-32-05.json");
    expect(deletedName("Konec...", at)).toBe("Konec 2026-10-15 14-32-05.json");
    expect(deletedName(" . ", at)).toBe("Untitled 2026-10-15 14-32-05.json");
    expect(deletedName("x".repeat(300), at).length).toBeLessThanOrEqual(80 + " 2026-10-15 14-32-05.json".length);
  });
});
