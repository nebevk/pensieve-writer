import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWriting } from "$lib/model";
import { readBackupFile } from "$lib/storage/backup";
import type { BackupContent, BackupWriting } from "$lib/storage/backupFile";
import { unsavedNotesAndTasks, type Note } from "$lib/storage/organize";
import { listKeptCopies, removeKeptCopy, writeKeptCopy } from "./kept";
import { Rescue } from "./rescue.svelte";

vi.mock("./kept", async (original) => ({
  ...(await original<typeof import("./kept")>()),
  writeKeptCopy: vi.fn(),
  listKeptCopies: vi.fn(),
  removeKeptCopy: vi.fn(),
}));
vi.mock("$lib/storage/organize", () => ({ unsavedNotesAndTasks: vi.fn() }));
vi.mock("$lib/storage/backup", () => ({ readBackupFile: vi.fn() }));

const writing = { ...createWriting("Zgodba ob reki", "Prvo poglavje"), folder: "", position: 0 } as BackupWriting;
let unsaved = false;
const host = (id = "p1") => ({ project: () => ({ id, title: "Moj projekt", folders: [] }), writing: () => writing, unsaved: () => unsaved });
const note = (id: string, projectId: string) => ({ id, projectId, plainText: "Anine besede, čšž", updatedAt: "2026-10-15T09:00:00.000Z" }) as Note;
const written = () => vi.mocked(writeKeptCopy).mock.calls.map(([kind, name, contents]) => ({ kind, name, file: JSON.parse(contents) }));
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("the rescue copy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(writeKeptCopy).mockReset().mockResolvedValue("C:\\Kept copies\\Rescue\\p1.json");
    vi.mocked(removeKeptCopy).mockReset().mockResolvedValue();
    vi.mocked(listKeptCopies).mockReset().mockResolvedValue([]);
    vi.mocked(readBackupFile).mockReset();
    vi.mocked(unsavedNotesAndTasks).mockReset().mockReturnValue({ notes: [], tasks: [] });
    unsaved = false;
  });
  afterEach(() => vi.useRealTimers());

  it("is written when a save fails, with the page's writing and the project's notes not saved yet", async () => {
    vi.mocked(unsavedNotesAndTasks).mockReturnValue({ notes: [note("ana", "p1"), note("bor", "p2")], tasks: [] });
    new Rescue(host()).failed();
    await settle();
    const [copy] = written();
    expect(copy.kind).toBe("rescue");
    expect(copy.name).toBe("p1.json");
    expect(copy.file.rescue).toBe(true);
    expect(copy.file.project.id).toBe("p1");
    expect(copy.file.writings.map((item: BackupWriting) => item.title)).toEqual(["Zgodba ob reki"]);
    expect(copy.file.notes.map((item: Note) => item.id)).toEqual(["ana"]);
  });

  it("is written again at most each minute while saving keeps failing", async () => {
    const rescue = new Rescue(host());
    rescue.failed();
    await settle();
    for (let second = 0; second < 50; second += 2) {
      rescue.failed();
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(written()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    rescue.failed();
    await settle();
    expect(written()).toHaveLength(2);
  });

  it("goes once a save works, but not while notes or the page are still waiting to be saved", async () => {
    const rescue = new Rescue(host());
    rescue.failed();
    await settle();
    vi.mocked(unsavedNotesAndTasks).mockReturnValue({ notes: [note("ana", "p1")], tasks: [] });
    rescue.saved();
    await settle();
    expect(removeKeptCopy).not.toHaveBeenCalled();
    // The notes saved, but the page's words still can't be.
    vi.mocked(unsavedNotesAndTasks).mockReturnValue({ notes: [], tasks: [] });
    unsaved = true;
    rescue.saved();
    await settle();
    expect(removeKeptCopy).not.toHaveBeenCalled();
    unsaved = false;
    vi.mocked(unsavedNotesAndTasks).mockReturnValue({ notes: [], tasks: [] });
    rescue.saved();
    await settle();
    expect(removeKeptCopy).toHaveBeenCalledWith("rescue", "p1.json");
  });

  it("says whether it is on the disk", async () => {
    const rescue = new Rescue(host());
    expect(await rescue.keep()).toBe(true);
    vi.mocked(writeKeptCopy).mockRejectedValue(new Error("There is not enough space on the disk. (os error 112)"));
    expect(await rescue.keep()).toBe(false);
  });

  it("from an earlier time is offered back when its project opens, once, and goes once brought back", async () => {
    vi.mocked(listKeptCopies).mockResolvedValue([{ name: "p1.json", path: "C:\\Kept copies\\Rescue\\p1.json", bytes: 100, modified: 0 }]);
    vi.mocked(readBackupFile).mockResolvedValue({ projectId: "p1", writings: [writing] } as unknown as BackupContent);
    const rescue = new Rescue(host());
    await rescue.check("p1");
    expect(rescue.offer?.name).toBe("p1.json");
    rescue.later();
    await rescue.check("p1");
    expect(rescue.offer).toBeNull();
    expect(listKeptCopies).toHaveBeenCalledTimes(1);
    const again = new Rescue(host());
    await again.check("p1");
    await again.done(again.offer!);
    expect(again.offer).toBeNull();
    expect(removeKeptCopy).toHaveBeenCalledWith("rescue", "p1.json");
  });

  it("isn't offered for a copy written this time, nor for another project's", async () => {
    vi.mocked(listKeptCopies).mockResolvedValue([{ name: "p1.json", path: "C:\\Kept copies\\Rescue\\p1.json", bytes: 100, modified: 0 }]);
    vi.mocked(readBackupFile).mockResolvedValue({ projectId: "p1", writings: [writing] } as unknown as BackupContent);
    const rescue = new Rescue(host());
    rescue.failed();
    await settle();
    await rescue.check("p1");
    expect(rescue.offer).toBeNull();
    const other = new Rescue(host("p2"));
    await other.check("p1");
    expect(other.offer).toBeNull();
  });
});
