import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenedProject } from "$lib/storage/sqlite";

// What storage was asked to do, in order.
const calls: string[] = [];
const failSwitch = new Set<string>();
vi.mock("$lib/storage/sqlite", () => ({
  switchProjectFile: async (path: string) => {
    calls.push(`switch ${path}`);
    if (failSwitch.has(path)) throw new Error("unable to open database file");
  },
  openShelf: async (writingId: string) => {
    calls.push(`shelf ${writingId}`);
    return opened("izpred");
  },
}));

const { Session } = await import("./session.svelte");

const opened = (id: string) => ({ shelf: { projectId: id }, writing: { id } }) as unknown as OpenedProject;
const OLD = "C:\\Users\\Eva\\Documents\\Pensieve\\Stari\\pensieve.db";
const NEW = "C:\\Users\\Eva\\Documents\\Pensieve\\Novi\\pensieve.db";

describe("the open project (ARCH-12)", () => {
  let remembered: string[];
  let session: InstanceType<typeof Session>;

  beforeEach(async () => {
    calls.length = 0;
    failSwitch.clear();
    remembered = [];
    session = new Session({ remember: (path) => remembered.push(path), writingId: () => "pisanje" });
    await session.start(OLD, async () => opened("stari"));
    calls.length = 0;
    remembered.length = 0;
  });

  it("is the one that opened, remembered for the next start only once it has", async () => {
    let during = false;
    const result = await session.switchTo(NEW, async () => {
      during = session.switching;
      expect(session.path).toBe(OLD);
      expect(remembered).toEqual([]);
      return opened("novi");
    });
    expect(result.writing.id).toBe("novi");
    expect([session.path, remembered, during, session.switching]).toEqual([NEW, [NEW], true, false]);
    expect(calls).toEqual([`switch ${NEW}`]);
  });

  it("a project that won't open: the one before opens again, its shelf read so its notes save, and the error goes on", async () => {
    const opening = session.switchTo(NEW, async () => {
      throw new Error("The project file has no schema version");
    });
    await expect(opening).rejects.toThrow("no schema version");
    expect(calls).toEqual([`switch ${NEW}`, `switch ${OLD}`, "shelf pisanje"]);
    expect([session.path, remembered, session.switching]).toEqual([OLD, [], false]);
  });

  it("a file that won't even be opened: the same", async () => {
    failSwitch.add(NEW);
    await expect(session.switchTo(NEW, async () => opened("novi"))).rejects.toThrow("unable to open");
    expect(calls).toEqual([`switch ${NEW}`, `switch ${OLD}`, "shelf pisanje"]);
    expect(session.path).toBe(OLD);
  });

  describe("moved into the library", () => {
    it("opens where the copy is, and is remembered there", async () => {
      const result = await session.moveTo(async () => NEW, async (path) => opened(path === NEW ? "kopija" : "?"), async () => calls.push("discard"));
      expect(result.writing.id).toBe("kopija");
      expect([session.path, remembered]).toEqual([NEW, [NEW]]);
      expect(calls).toEqual([`switch ${NEW}`]);
    });

    it("a copy that failed to be made leaves storage where it was, and nothing to throw away", async () => {
      const moving = session.moveTo(
        async () => {
          throw new Error("database or disk is full");
        },
        async () => opened("kopija"),
        async () => calls.push("discard"),
      );
      await expect(moving).rejects.toThrow("disk is full");
      expect(calls).toEqual([]);
      expect([session.path, session.switching]).toEqual([OLD, false]);
    });

    it("a copy that won't open goes, once storage is back on the project, which stays where it was", async () => {
      const moving = session.moveTo(
        async () => NEW,
        async () => {
          throw new Error("unable to open database file");
        },
        async () => calls.push("discard"),
      );
      await expect(moving).rejects.toThrow("unable to open");
      expect(calls).toEqual([`switch ${NEW}`, `switch ${OLD}`, "shelf pisanje", "discard"]);
      expect([session.path, remembered]).toEqual([OLD, []]);
    });
  });

  describe("other projects' files (the samples)", () => {
    it("each is visited, saves wait meanwhile, and the open project is open again after", async () => {
      const seen: boolean[] = [];
      const back = await session.elsewhere(
        async (visit) => {
          for (const path of ["C:\\a\\pensieve.db", "C:\\b\\pensieve.db"]) {
            await visit(path);
            seen.push(session.switching);
          }
        },
        async () => {
          calls.push("back");
          return "nazaj";
        },
      );
      expect(back).toBe("nazaj");
      expect(calls).toEqual(["switch C:\\a\\pensieve.db", "switch C:\\b\\pensieve.db", `switch ${OLD}`, "back"]);
      expect([seen, session.switching, session.path, remembered]).toEqual([[true, true], false, OLD, []]);
    });

    it("one that fails: the open project is open again, read, and then the error goes on", async () => {
      const writing = session.elsewhere(
        async (visit) => {
          await visit("C:\\a\\pensieve.db");
          throw new Error("A chapter would have gone into another writing");
        },
        async () => calls.push("back"),
      );
      await expect(writing).rejects.toThrow("another writing");
      expect(calls).toEqual(["switch C:\\a\\pensieve.db", `switch ${OLD}`, "back"]);
      expect(session.switching).toBe(false);
    });
  });

  it("follows its folder when that is moved or renamed", () => {
    session.followMove("C:\\Users\\Eva\\Documents\\Pensieve\\Stari", "C:\\Users\\Eva\\Documents\\Pensieve\\Mapa\\Stari");
    expect(session.path).toBe("C:\\Users\\Eva\\Documents\\Pensieve\\Mapa\\Stari\\pensieve.db");
    session.followMove("C:\\Drugje", "C:\\Spet drugje");
    expect(session.path).toBe("C:\\Users\\Eva\\Documents\\Pensieve\\Mapa\\Stari\\pensieve.db");
  });

  it("with no project open, other projects' files aren't touched: there is nothing to come back to", async () => {
    const empty = new Session({ remember: () => undefined, writingId: () => "" });
    await expect(empty.elsewhere(async () => undefined, async () => undefined)).rejects.toThrow("No project is open yet");
    expect(calls).toEqual([]);
  });
});
