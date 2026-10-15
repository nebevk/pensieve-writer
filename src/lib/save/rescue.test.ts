import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWriting } from "$lib/model";
import { readBackupFile } from "$lib/storage/backup";
import type { BackupContent, BackupWriting } from "$lib/storage/backupFile";
import { unsavedNotesAndTasks, type Note } from "$lib/storage/organize";
import { listKeptCopies, removeKeptCopy, rescueTail, writeKeptCopy, type KeptCopy } from "./kept";
import { Rescue, besideItsWriting } from "./rescue.svelte";

vi.mock("./kept", async (original) => ({
  ...(await original<typeof import("./kept")>()),
  writeKeptCopy: vi.fn(),
  listKeptCopies: vi.fn(),
  removeKeptCopy: vi.fn(),
}));
vi.mock("$lib/storage/organize", () => ({ unsavedNotesAndTasks: vi.fn() }));
vi.mock("$lib/storage/backup", () => ({ readBackupFile: vi.fn() }));

let writing = { ...createWriting("Zgodba ob reki", "Prvo poglavje"), folder: "", position: 0 } as BackupWriting;
let unsaved = false;
let savedAt = "";
const host = (id = "p1") => ({
  project: () => ({ id, title: "Moj projekt", folders: [] }),
  writing: () => writing,
  unsaved: () => unsaved,
  savedAt: () => savedAt,
});
const note = (id: string, projectId: string) => ({ id, projectId, plainText: "Anine besede, čšž", updatedAt: "2026-10-15T09:00:00.000Z" }) as Note;
const written = () => vi.mocked(writeKeptCopy).mock.calls.map(([kind, name, contents]) => ({ kind, name, file: JSON.parse(contents) }));
const removed = () => vi.mocked(removeKeptCopy).mock.calls.map(([, name]) => name);
const settle = () => vi.advanceTimersByTimeAsync(0);
const earlier = (name: string, modified: number, at: string): [KeptCopy, BackupContent] => [
  { name, path: `C:\\Kept copies\\Rescue\\${name}`, bytes: 100, modified },
  { projectId: "p1", savedAt: at, writings: [writing] } as unknown as BackupContent,
];
/** Earlier copies on the disk, as kept.rs lists them and reads them back. */
function onDisk(...copies: [KeptCopy, BackupContent][]) {
  vi.mocked(listKeptCopies).mockResolvedValue(copies.map(([copy]) => copy));
  vi.mocked(readBackupFile).mockImplementation(async (path) => copies.find(([copy]) => copy.path === path)![1]);
}

describe("the rescue copy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(writeKeptCopy).mockReset().mockResolvedValue("C:\\Kept copies\\Rescue\\x.json");
    vi.mocked(removeKeptCopy).mockReset().mockResolvedValue();
    vi.mocked(listKeptCopies).mockReset().mockResolvedValue([]);
    vi.mocked(readBackupFile).mockReset();
    vi.mocked(unsavedNotesAndTasks).mockReset().mockReturnValue({ notes: [], tasks: [] });
    writing = { ...createWriting("Zgodba ob reki", "Prvo poglavje"), folder: "", position: 0 } as BackupWriting;
    unsaved = false;
    savedAt = "";
  });
  afterEach(() => vi.useRealTimers());

  it("is written when a save fails, named by its writing, the time and its project, with that project's unsaved notes", async () => {
    vi.mocked(unsavedNotesAndTasks).mockReturnValue({ notes: [note("ana", "p1"), note("bor", "p2")], tasks: [] });
    new Rescue(host()).failed();
    await settle();
    const [copy] = written();
    expect(copy.kind).toBe("rescue");
    expect(copy.name.startsWith("Zgodba ob reki ")).toBe(true);
    expect(copy.name.endsWith(rescueTail("p1"))).toBe(true);
    expect(copy.file.rescue).toBe(true);
    expect(Number.isNaN(Date.parse(copy.file.savedAt))).toBe(false);
    expect(copy.file.writings.map((item: BackupWriting) => item.title)).toEqual(["Zgodba ob reki"]);
    expect(copy.file.notes.map((item: Note) => item.id)).toEqual(["ana"]);
  });

  it("is written again every ten seconds while saving fails, but only when the words changed", async () => {
    const rescue = new Rescue(host());
    for (let second = 0; second < 30; second += 2) {
      rescue.failed();
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(written()).toHaveLength(1);
    writing = { ...writing, title: "Zgodba ob reki, drugič" };
    for (let second = 0; second < 12; second += 2) {
      rescue.failed();
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(written()).toHaveLength(2);
    // Under the same name: this time's copy is written over, never a second one.
    expect(written()[1].name).toBe(written()[0].name);
  });

  it("goes once a save works, but not while notes or the page still wait to be saved", async () => {
    const rescue = new Rescue(host());
    rescue.failed();
    await settle();
    vi.mocked(unsavedNotesAndTasks).mockReturnValue({ notes: [note("ana", "p1")], tasks: [] });
    rescue.saved();
    await settle();
    vi.mocked(unsavedNotesAndTasks).mockReturnValue({ notes: [], tasks: [] });
    unsaved = true;
    rescue.saved();
    await settle();
    expect(removed()).toEqual([]);
    unsaved = false;
    rescue.saved();
    await settle();
    expect(removed()).toEqual([written()[0].name]);
  });

  it("isn't written when a save worked after it was asked for, and says her words are safe", async () => {
    const rescue = new Rescue(host());
    const kept = rescue.keep();
    rescue.saved();
    expect(await kept).toBe(true);
    expect(written()).toEqual([]);
  });

  it("says whether it is on the disk", async () => {
    const rescue = new Rescue(host());
    expect(await rescue.keep()).toBe(true);
    writing = { ...writing, title: "Drugo" };
    vi.mocked(writeKeptCopy).mockRejectedValue(new Error("There is not enough space on the disk. (os error 112)"));
    expect(await rescue.keep()).toBe(false);
  });

  it("never writes over or takes away a copy from an earlier time", async () => {
    const [copy, backup] = earlier(`Zgodba ob reki 2026-10-14 09-00-00${rescueTail("p1")}`, 1, "2026-10-14T09:30:00.000Z");
    onDisk([copy, backup]);
    const rescue = new Rescue(host());
    await rescue.check("p1");
    expect(rescue.offer?.name).toBe(copy.name);
    rescue.later();
    rescue.failed();
    await settle();
    rescue.saved();
    await settle();
    expect(written().map((item) => item.name)).not.toContain(copy.name);
    expect(removed()).not.toContain(copy.name);
  });

  it("from earlier times is offered oldest first, beside its writing when that was saved since, and goes once brought back", async () => {
    const older = earlier(`Zgodba ob reki 2026-10-13 09-00-00${rescueTail("p1")}`, 1, "2026-10-13T09:30:00.000Z");
    const newer = earlier(`Zgodba ob reki 2026-10-14 09-00-00${rescueTail("p1")}`, 2, "2026-10-14T09:30:00.000Z");
    onDisk(newer, older);
    savedAt = "2026-10-13T20:00:00.000Z";
    const rescue = new Rescue(host());
    await rescue.check("p1");
    expect(rescue.offer?.name).toBe(older[0].name);
    expect(rescue.offer?.beside).toBe(true);
    await rescue.done(rescue.offer!);
    expect(removed()).toEqual([older[0].name]);
    expect(rescue.offer?.name).toBe(newer[0].name);
    expect(rescue.offer?.beside).toBe(false);
    await rescue.done(rescue.offer!);
    expect(rescue.offer).toBeNull();
    // Asked once each time Pensieve starts.
    await rescue.check("p1");
    expect(listKeptCopies).toHaveBeenCalledTimes(1);
  });

  it("isn't offered for another project's copies, nor for this time's own", async () => {
    onDisk(earlier(`Zgodba ob reki 2026-10-14 09-00-00${rescueTail("p1")}`, 1, "2026-10-14T09:30:00.000Z"));
    const other = new Rescue(host("p2"));
    await other.check("p2");
    expect(other.offer).toBeNull();
    const rescue = new Rescue(host());
    rescue.failed();
    await settle();
    onDisk([{ name: written()[0].name, path: "C:\\mine.json", bytes: 1, modified: 3 }, { projectId: "p1", savedAt: "", writings: [writing] } as unknown as BackupContent]);
    await rescue.check("p1");
    expect(rescue.offer).toBeNull();
  });

  it("brought back beside its writing, comes as a writing of its own, named so", () => {
    const backup = { projectId: "p1", savedAt: "", writings: [writing] } as unknown as BackupContent;
    const [beside] = besideItsWriting(backup).writings;
    expect(beside.id).not.toBe(writing.id);
    expect(beside.title).toBe("Zgodba ob reki (rescue copy)");
    expect(beside.chapters).toEqual(writing.chapters);
  });
});
