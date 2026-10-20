import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWriting, type Shelf, type Writing } from "$lib/model";
import type { BackupContent, BackupWriting } from "$lib/storage/backupFile";
import type { KeptCopy } from "./kept";

const RESCUE = "C:\\Users\\Eva\\AppData\\Roaming\\com.pensieve.app\\Rescue";
const DELETED = "C:\\Users\\Eva\\AppData\\Roaming\\com.pensieve.app\\Deleted writings";

// What the open dialog answers, the backup files by path, and the kept copies by kind.
let chosen: string | null = null;
const asked: string[] = [];
let files = new Map<string, BackupContent>();
let kept: Record<string, KeptCopy[]> = {};
let listFails = false;
vi.mock("$lib/storage/backup", () => ({
  chooseBackupFile: async (folder = "", title = "Restore from a backup") => {
    asked.push(`${title} in ${folder || "anywhere"}`);
    return chosen;
  },
  readBackupFile: async (path: string) => {
    const backup = files.get(path);
    if (!backup) throw "Choose a Pensieve backup (.json) file.";
    return backup;
  },
}));
vi.mock("./kept", () => ({
  keptCopiesFolder: async (kind: string) => (kind === "rescue" ? RESCUE : DELETED),
  listKeptCopies: async (kind: string) => {
    if (listFails) throw new Error("That folder isn't there any more");
    return kept[kind] ?? [];
  },
  removeKeptCopy: async (kind: string, name: string) => void (kept[kind] = (kept[kind] ?? []).filter((copy) => copy.name !== name)),
}));

const { Restores } = await import("./restores.svelte");

const writingOf = (title: string): BackupWriting => ({ ...createWriting(title, "Prvo"), folder: "", position: 0, deletedAt: "" });
const backup = (patch: Partial<BackupContent>): BackupContent => ({
  format: 2,
  savedAt: "2026-10-20T08:30:00.000Z",
  projectId: "moj-projekt",
  title: "Zgodbe ob reki",
  folders: [],
  writings: [writingOf("Čarovnica"), writingOf("Mlin")],
  notes: [],
  tasks: [],
  rescue: false,
  ...patch,
});
const copy = (name: string): KeptCopy => ({ name, path: `${DELETED}\\${name}`, bytes: 10, modified: 1 });

describe("Settings' backups and kept copies (IMP-28)", () => {
  let events: string[];
  let writing: Writing | null;
  let shelf: Shelf | null;
  let restoreFails: string | null;
  let restores: InstanceType<typeof Restores>;

  beforeEach(() => {
    chosen = null;
    asked.length = 0;
    files = new Map();
    kept = { deleted: [copy("Čarovnica 2026-10-15.json"), copy("Mlin 2026-10-16.json")], rescue: [{ ...copy("Reka.json"), path: `${RESCUE}\\Reka.json` }] };
    listFails = false;
    events = [];
    restoreFails = null;
    writing = createWriting("Odprto", "Prvo");
    shelf = { projectId: "moj-projekt", title: "Zgodbe ob reki", folders: [], writings: [] } as unknown as Shelf;
    restores = new Restores({
      shelf: () => shelf,
      writing: () => writing,
      restore: async (picked) => {
        if (restoreFails) throw new Error(restoreFails);
        events.push(`restore ${picked.title}`);
      },
      restored: () => events.push("restored"),
      say: (message) => events.push(`say: ${message}`),
    });
  });

  it("a backup picked is asked about first: its project's name, when, and whether it is this project's", async () => {
    chosen = "D:\\Drive\\pensieve-moj-2026.json";
    files.set(chosen, backup({}));
    await restores.pick();
    expect(asked).toEqual(["Restore from a backup in anywhere"]);
    expect(restores.offer()).toMatchObject({ title: "Zgodbe ob reki", otherBook: false });
    expect(restores.offer()?.savedAt).not.toBe("");
    // Another project's comes in beside; one writing is named as itself.
    files.set(chosen, backup({ projectId: "drug", writings: [writingOf("Žerjav")] }));
    await restores.pick();
    expect(restores.offer()).toMatchObject({ title: "Žerjav", otherBook: true });
    writing = null;
    expect(restores.offer()).toBeNull();
  });

  it("nothing is asked when the dialog closes, and a file that isn't a backup is said", async () => {
    await restores.pick();
    expect(restores.pending).toBeNull();
    chosen = "D:\\zapiski.json";
    await restores.pick();
    expect(events).toEqual(["say: Choose a Pensieve backup (.json) file."]);
  });

  it("put back, Settings closes; a rescue copy picked in its folder isn't offered again, one picked elsewhere stays", async () => {
    chosen = `${RESCUE}\\Reka.json`;
    files.set(chosen, backup({ rescue: true }));
    await restores.pick();
    await restores.restore();
    expect(events).toEqual(["restore Zgodbe ob reki", "restored"]);
    expect([restores.pending, kept.rescue]).toEqual([null, []]);
    kept.rescue = [{ ...copy("Reka.json"), path: `${RESCUE}\\Reka.json` }];
    chosen = "D:\\Drive\\Reka.json";
    files.set(chosen, backup({ rescue: true }));
    await restores.pick();
    await restores.restore();
    expect(kept.rescue).toHaveLength(1);
  });

  it("one that can't be put back is said, and Settings stays", async () => {
    chosen = "D:\\Drive\\pensieve-moj-2026.json";
    files.set(chosen, backup({}));
    await restores.pick();
    restoreFails = "The project file was not found";
    await restores.restore();
    expect(events).toEqual(["say: The project file was not found"]);
  });

  it("a kept copy is picked in its own folder and asked about as a backup is", async () => {
    chosen = `${DELETED}\\Mlin 2026-10-16.json`;
    files.set(chosen, backup({ writings: [writingOf("Mlin")] }));
    await restores.bringBackKept();
    expect(asked).toEqual([`Bring back a kept copy in ${DELETED}`]);
    expect(restores.offer()?.title).toBe("Mlin");
  });

  it("counts the kept copies, removes them all after asking, and says so", async () => {
    await restores.refreshKept();
    expect(restores.keptCount).toBe(2);
    await restores.removeKept();
    expect([restores.keptCount, kept.deleted, events]).toEqual([0, [], ["say: The kept copies are removed."]]);
    listFails = true;
    kept.deleted = [copy("Ena.json")];
    await restores.refreshKept();
    expect(restores.keptCount).toBe(0);
  });
});
