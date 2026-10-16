import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Writing } from "$lib/model";
import type { Prefs } from "$lib/prefs";
import { writeBackup } from "$lib/storage/backup";
import { DriveBackup, copyPathFor } from "./copies.svelte";

vi.mock("$lib/storage/backup", () => ({ writeBackup: vi.fn(), chooseBackupFolder: vi.fn() }));

const FOLDER = "C:\\Users\\Eva\\Documents\\Word";
const at = (name: string) => `${FOLDER}\\${name}`;

describe("each writing's own Word copy", () => {
  it("is the writing's name in the folder", () => {
    expect(copyPathFor(FOLDER, "Moj prvi projekt - Brez naslova", "a", {})).toBe(at("Moj prvi projekt - Brez naslova.docx"));
  });

  it("stays the writing's own once it has it", () => {
    const copies = { [at("Zgodbe ob reki.docx")]: { writing: "a" } };
    expect(copyPathFor(FOLDER, "Zgodbe ob reki", "a", copies)).toBe(at("Zgodbe ob reki.docx"));
  });

  it("gets a number when another writing's copy has the name, two projects of the same name say", () => {
    const copies = {
      [at("Moj prvi projekt - Brez naslova.docx")]: { writing: "a" },
      [at("Moj prvi projekt - Brez naslova (2).docx")]: { writing: "b" },
    };
    expect(copyPathFor(FOLDER, "Moj prvi projekt - Brez naslova", "b", copies)).toBe(at("Moj prvi projekt - Brez naslova (2).docx"));
    expect(copyPathFor(FOLDER, "Moj prvi projekt - Brez naslova", "c", copies)).toBe(at("Moj prvi projekt - Brez naslova (3).docx"));
  });

  it("tells names apart as Windows does, without regard to capitals, č, š and ž included", () => {
    const copies = { [at("čaša in ŠKAF.docx")]: { writing: "a" } };
    expect(copyPathFor(FOLDER, "Čaša in škaf", "b", copies)).toBe(at("Čaša in škaf (2).docx"));
  });

  it("lets the first writing that writes a copy from before copies knew their writing take it", () => {
    const copies = { [at("Brez naslova.docx")]: {} };
    expect(copyPathFor(FOLDER, "Brez naslova", "a", copies)).toBe(at("Brez naslova.docx"));
  });
});

describe("the automatic backup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("after a failure, tries again in a quarter of an hour, not every minute, then hourly", async () => {
    const tries = vi.mocked(writeBackup);
    tries.mockRejectedValue(new Error("Choose a folder that exists. Put it inside Google Drive if you want it synced."));
    let prefs = { backupFolder: "G:\\Moj Drive\\Pensieve", lastBackupAt: "", lastBackupError: "", backupSignatures: {} } as unknown as Prefs;
    const failures: string[] = [];
    const backup = new DriveBackup({
      writing: () => ({ id: "w" }) as Writing,
      shelf: () => null,
      prefs: () => prefs,
      setPrefs: (patch) => {
        prefs = { ...prefs, ...patch };
      },
      switching: () => false,
      flush: async () => undefined,
      libraryRoot: () => "",
      say: () => undefined,
      fail: (message) => failures.push(message),
    });
    const stop = backup.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tries).toHaveBeenCalledTimes(1);
    expect(failures).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(14 * 60_000);
    expect(tries).toHaveBeenCalledTimes(1);
    tries.mockResolvedValue({ path: "G:\\Moj Drive\\Pensieve\\pensieve-w.json", signature: "s", projectId: "p" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tries).toHaveBeenCalledTimes(2);
    expect(prefs.lastBackupError).toBe("");
    await vi.advanceTimersByTimeAsync(59 * 60_000);
    expect(tries).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tries).toHaveBeenCalledTimes(3);
    stop();
  });

  it("remembers each project's last backup on its own, so going back and forth writes no copy of the same (ARCH-18)", async () => {
    const tries = vi.mocked(writeBackup);
    tries.mockReset();
    let prefs = { backupFolder: "G:\\Drive", lastBackupAt: "", lastBackupError: "", backupSignatures: { ana: "ana:1:x" } } as unknown as Prefs;
    const asked: string[] = [];
    let open = "bor";
    tries.mockImplementation(async (_folder, lastOf = () => "") => {
      const signature = `${open}:2:y`;
      asked.push(`${open}=${lastOf(open)}`);
      return { path: lastOf(open) === signature ? null : `G:\\Drive\\${open}.json`, signature, projectId: open };
    });
    const backup = new DriveBackup({
      writing: () => ({ id: "w" }) as Writing,
      shelf: () => null,
      prefs: () => prefs,
      setPrefs: (patch) => {
        prefs = { ...prefs, ...patch };
      },
      switching: () => false,
      flush: async () => undefined,
      libraryRoot: () => "",
      say: () => undefined,
      fail: () => undefined,
    });
    await backup.run(false);
    open = "ana";
    await backup.run(false);
    open = "bor";
    await backup.run(false);
    expect(asked).toEqual(["bor=", "ana=ana:1:x", "bor=bor:2:y"]);
    expect(prefs.backupSignatures).toEqual({ ana: "ana:2:y", bor: "bor:2:y" });
    // Back up now always writes one.
    asked.length = 0;
    await backup.run(true);
    expect(asked).toEqual(["bor="]);
  });
});
