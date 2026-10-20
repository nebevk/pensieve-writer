import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWriting } from "$lib/model";
import { createSaveQueue } from "$lib/save/queue";
import { missingItems, newerItems, normalizeNote, normalizeTask, snapshotPayload, writingFromBackup, writingFromSnapshot } from "$lib/storage/restore";
import { backupBookKey, backupFile, backupFileName, backupSignature, parseBackup } from "$lib/storage/backupFile";
import { hasTransparency, imageType } from "$lib/editor/imageSize";
import type { Note, Task } from "$lib/storage/organize";

const when = "2026-10-05T10:00:00.000Z";

function note(id: string, text: string): Note {
  return {
    id,
    projectId: "p",
    title: id,
    contentJson: { type: "doc", content: [] },
    plainText: text,
    category: "characters",
    tags: "",
    aliases: "",
    fields: [],
    todoState: null,
    chapterIds: [],
    createdAt: when,
    updatedAt: when,
  };
}

function task(id: string, noteId = ""): Task {
  return { id, projectId: "p", title: id, todoState: "todo", updatedAt: when, chapterId: "", noteId };
}

const byId = (item: Note) => item.id;

describe("note save queue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves both notes when you switch notes before the first one is saved", async () => {
    const saved: string[] = [];
    const queue = createSaveQueue<Note>({ delayMs: 800, key: byId, save: async (item) => void saved.push(`${item.id}:${item.plainText}`) });
    queue.schedule(note("a", "last words in A"));
    queue.schedule(note("b", "first words in B"));
    await queue.flush();
    expect(saved).toEqual(["a:last words in A", "b:first words in B"]);
  });

  it("keeps only the newest edit of the same note", async () => {
    const saved: string[] = [];
    const queue = createSaveQueue<Note>({ delayMs: 800, key: byId, save: async (item) => void saved.push(item.plainText) });
    queue.schedule(note("a", "one"));
    queue.schedule(note("a", "two"));
    await queue.flush();
    expect(saved).toEqual(["two"]);
  });

  it("saves on its own after the delay, including č š ž", async () => {
    const saved: string[] = [];
    const queue = createSaveQueue<Note>({ delayMs: 800, key: byId, save: async (item) => void saved.push(item.plainText) });
    queue.schedule(note("a", "č š ž"));
    await vi.advanceTimersByTimeAsync(800);
    expect(saved).toEqual(["č š ž"]);
  });

  it("keeps a failed save for the next try", async () => {
    let fail = true;
    const saved: string[] = [];
    const errors: unknown[] = [];
    const queue = createSaveQueue<Note>({
      delayMs: 800,
      key: byId,
      save: async (item) => {
        if (fail) throw new Error("disk full");
        saved.push(item.id);
      },
      onError: (error) => errors.push(error),
    });
    queue.schedule(note("a", "x"));
    await expect(queue.flush()).rejects.toThrow("disk full");
    expect(errors).toHaveLength(1);
    fail = false;
    await queue.flush();
    expect(saved).toEqual(["a"]);
  });

  it("tries a failed save again by itself, until it works", async () => {
    let fail = true;
    const saved: string[] = [];
    const events: string[] = [];
    const queue = createSaveQueue<Note>({
      delayMs: 800,
      retryMs: 2000,
      key: byId,
      save: async (item) => {
        if (fail) throw new Error("unable to open database file");
        saved.push(item.plainText);
      },
      onError: () => events.push("failed"),
      onSaved: () => events.push("saved"),
    });
    queue.schedule(note("a", "Ana, čšž"));
    await vi.advanceTimersByTimeAsync(800);
    expect(events).toEqual(["failed"]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(events).toEqual(["failed", "failed"]);
    // The folder is back: the next try saves it, with no change made meanwhile.
    fail = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual(["Ana, čšž"]);
    expect(events).toEqual(["failed", "failed", "saved"]);
    // Nothing waits, so nothing is tried again.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(events).toEqual(["failed", "failed", "saved"]);
  });

  it("without a retry, a failed save waits for the next change or flush", async () => {
    const events: string[] = [];
    const queue = createSaveQueue<Note>({
      delayMs: 800,
      key: byId,
      save: async () => {
        throw new Error("disk full");
      },
      onError: () => events.push("failed"),
    });
    queue.schedule(note("a", "x"));
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(events).toEqual(["failed"]);
  });

  it("makes a second flush wait for a save that is already running", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const saved: string[] = [];
    const queue = createSaveQueue<Note>({
      delayMs: 800,
      key: byId,
      save: async (item) => {
        if (item.id === "a") await gate;
        saved.push(item.id);
      },
    });
    queue.schedule(note("a", ""));
    const first = queue.flush();
    await Promise.resolve();
    queue.schedule(note("b", ""));
    let secondDone = false;
    const second = queue.flush().then(() => (secondDone = true));
    await Promise.resolve();
    await Promise.resolve();
    expect(secondDone).toBe(false);
    release();
    await Promise.all([first, second]);
    expect(saved).toEqual(["a", "b"]);
  });

  it("lets deleting a to-do replace its failed save, so the retry can't bring it back", async () => {
    type Change = { kind: "save" | "delete"; id: string };
    let fail = true;
    const done: string[] = [];
    const queue = createSaveQueue<Change>({
      delayMs: 800,
      key: (change) => change.id,
      save: async (change) => {
        if (fail) throw new Error("database is locked");
        done.push(`${change.kind}:${change.id}`);
      },
    });
    queue.schedule({ kind: "save", id: "task" });
    await expect(queue.flush()).rejects.toThrow("database is locked");
    fail = false;
    queue.schedule({ kind: "delete", id: "task" });
    await queue.flush();
    expect(done).toEqual(["delete:task"]);
  });

  it("tells what isn't saved yet, for a rescue copy: waiting, being written, or failed", async () => {
    let fail = true;
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const queue = createSaveQueue<Note>({
      delayMs: 800,
      key: byId,
      save: async (item) => {
        if (item.id === "slow") await gate;
        if (fail) throw new Error("unable to open database file");
      },
    });
    const text = () => queue.waiting().map((item) => `${item.id}:${item.plainText}`);
    queue.schedule(note("a", "Ana, čšž"));
    queue.schedule(note("a", "Ana Novak, čšž"));
    queue.schedule(note("b", "Bor"));
    expect(text()).toEqual(["a:Ana Novak, čšž", "b:Bor"]);
    await expect(queue.flush()).rejects.toThrow("unable to open database file");
    expect(text()).toEqual(["a:Ana Novak, čšž", "b:Bor"]);
    // Being written: still unsaved, and a newer edit waiting takes its place.
    fail = false;
    queue.schedule(note("slow", "first"));
    const flushing = queue.flush();
    await Promise.resolve();
    queue.schedule(note("slow", "second"));
    expect(text()).toContain("slow:second");
    expect(text()).not.toContain("slow:first");
    release();
    await flushing;
    await queue.flush();
    expect(queue.waiting()).toEqual([]);
  });
});

describe("a rescue copy's notes, brought back", () => {
  it("are the ones the project lacks, or has older", () => {
    const later = (item: Note) => ({ ...item, updatedAt: "2026-10-15T09:00:00.000Z" });
    const saved = new Map([
      ["same", when],
      ["older", when],
      ["newer", "2026-10-16T09:00:00.000Z"],
    ]);
    const back = newerItems([note("same", "x"), later(note("older", "Anine besede, čšž")), later(note("newer", "y")), note("gone", "z")], saved);
    expect(back.map((item) => item.id)).toEqual(["older", "gone"]);
    expect(back[0].plainText).toBe("Anine besede, čšž");
    expect(newerItems(undefined, saved)).toEqual([]);
  });
});

describe("notes in snapshots", () => {
  it("keeps notes and to-dos with the chapters", () => {
    const project = createWriting();
    const payload = snapshotPayload(project, [note("n1", "Ana")], [task("t1", "n1")]);
    expect(payload.chapters).toEqual(project.chapters);
    expect(payload.notes?.map((item) => item.id)).toEqual(["n1"]);
    expect(payload.tasks?.map((item) => item.id)).toEqual(["t1"]);
  });

  it("brings back only the notes the book no longer has", () => {
    const back = missingItems([note("kept", "changed since"), note("deleted", "Anine pisme, čšž")], ["kept"]);
    expect(back.map((item) => item.id)).toEqual(["deleted"]);
    expect(back[0].plainText).toBe("Anine pisme, čšž");
  });

  it("adds nothing from snapshots taken before notes were included", () => {
    expect(missingItems(undefined, ["kept"])).toEqual([]);
  });

  it("moves restored notes and to-dos into the open book and repairs missing parts", () => {
    const damaged = { ...note("n1", "x"), fields: undefined } as unknown as Note;
    const restored = normalizeNote(damaged, "book-2");
    expect(restored.projectId).toBe("book-2");
    expect(restored.fields).toEqual([]);
    expect(normalizeTask(task("t1"), "book-2").projectId).toBe("book-2");
  });
});

describe("Drive backups", () => {
  it("names each backup after its project", () => {
    expect(backupBookKey("3f2a9c1b-1111-2222-3333-444455556666")).toBe("3f2a9c1b");
    expect(backupFileName("3f2a9c1b-1111", "2026-10-05T14:02:11.123Z")).toBe(
      "pensieve-3f2a9c1b-2026-10-05T14-02-11.123Z.json",
    );
  });

  it("sees an unchanged project as unchanged, even when edit and open times moved", () => {
    const writing = createWriting();
    writing.chapters[0].plainText = "Ana took the keys.";
    const before = backupSignature("p", { writings: [writing], notes: [note("n1", "x")], tasks: [task("t1")] });
    const later = "2030-01-01T00:00:00.000Z";
    const touched = {
      ...writing,
      updatedAt: later,
      openedAt: later,
      chapters: writing.chapters.map((chapter) => ({ ...chapter, updatedAt: later })),
    };
    expect(
      backupSignature("p", { writings: [touched], notes: [{ ...note("n1", "x"), updatedAt: later }], tasks: [{ ...task("t1"), updatedAt: later }] }),
    ).toBe(backupSignature("p", { writings: [{ ...writing, openedAt: "" }], notes: [note("n1", "x")], tasks: [task("t1")] }));
    expect(before).toContain("p:");
  });

  it("notices a one-letter change, in any writing", () => {
    const first = createWriting();
    const second = createWriting();
    second.chapters[0].plainText = "Ana took the keys.";
    const before = backupSignature("p", { writings: [first, second] });
    second.chapters[0].plainText = "Ana took the key.";
    expect(backupSignature("p", { writings: [first, second] })).not.toBe(before);
  });

  it("reads a project's backup back, every writing in it, including č š ž", () => {
    const first = createWriting();
    first.title = "Zgodbe ob reki";
    first.chapters[0].plainText = "Čaša, šal, žaba";
    const second = { ...createWriting(), split: false };
    const text = JSON.stringify(
      backupFile(
        { id: "project-1", title: "Reka", folders: ["Osnutki"] },
        [
          { ...first, folder: "", position: 0 },
          { ...second, folder: "Osnutki", position: 1 },
        ],
        [note("n1", "")],
        [task("t1")],
        when,
      ),
    );
    const backup = parseBackup(text);
    expect(backup).toMatchObject({ format: 2, savedAt: when, projectId: "project-1", title: "Reka", folders: ["Osnutki"] });
    expect(backup.writings.map((item) => [item.title, item.split, item.folder])).toEqual([
      ["Zgodbe ob reki", true, ""],
      [second.title, false, "Osnutki"],
    ]);
    expect(backup.writings[0].chapters[0].plainText).toBe("Čaša, šal, žaba");
    expect(backup.notes).toHaveLength(1);
    expect(backup.tasks).toHaveLength(1);
  });

  it("still reads a backup of one book, from before projects held several writings", () => {
    const book = createWriting();
    const old = {
      kind: "pensieve-backup",
      savedAt: when,
      project: { id: book.id, title: "Why I write", kind: "article", language: "en", wordGoal: 400, chapters: book.chapters },
      notes: [note("n1", "")],
      tasks: [],
    };
    const backup = parseBackup(JSON.stringify(old));
    expect(backup.format).toBe(1);
    expect(backup.projectId).toBe(book.id);
    expect(backup.writings).toHaveLength(1);
    expect(backup.writings[0]).toMatchObject({ id: book.id, title: "Why I write", split: false, folder: "" });
    expect(backup.notes).toHaveLength(1);
  });

  it("leaves out a writing with no chapters (a save cut short) instead of refusing the whole backup", () => {
    const kept = createWriting();
    const empty = { ...createWriting(), chapters: [] };
    const file = backupFile({ id: "p1", title: "Projekt", folders: [] }, [
      { ...kept, folder: "", position: 0 },
      { ...empty, folder: "", position: 1, deletedAt: "2026-10-07T10:00:00.000Z" },
    ], [], [], new Date().toISOString());
    const backup = parseBackup(JSON.stringify(file));
    expect(backup.writings.map((item) => item.id)).toEqual([kept.id]);
    // Nothing with text in it at all: that isn't a backup to restore.
    const nothing = backupFile({ id: "p1", title: "Projekt", folders: [] }, [{ ...empty, folder: "", position: 0 }], [], [], new Date().toISOString());
    expect(() => parseBackup(JSON.stringify(nothing))).toThrow("isn't a Pensieve backup");
  });

  it("refuses files that aren't backups", () => {
    expect(() => parseBackup("not json")).toThrow("isn't a Pensieve backup");
    expect(() => parseBackup(JSON.stringify({ kind: "something-else" }))).toThrow("isn't a Pensieve backup");
    expect(() =>
      parseBackup(
        JSON.stringify({ kind: "pensieve-backup", project: { chapters: [{ contentJson: { type: "paragraph" } }] } }),
      ),
    ).toThrow("can't read");
  });

  it("restores a backup from another computer into a writing, which keeps its own id", () => {
    const open = createWriting();
    const saved = createWriting();
    saved.title = "The Lantern House";
    saved.chapters[0].plainText = "The keys hung on a nail.";
    const restored = writingFromBackup(open, saved);
    expect(restored.id).toBe(open.id);
    expect(restored.title).toBe("The Lantern House");
    expect(restored.split).toBe(true);
    expect(restored.chapters[0].writingId).toBe(open.id);
    expect(restored.chapters[0].plainText).toBe("The keys hung on a nail.");
  });

  it("reads an old book's kind as the switch: an article was one page, a novel or collection in chapters", () => {
    const open = createWriting();
    // An old backup's book has a kind and no switch.
    const old = (kind: string) => {
      const { split: _split, ...book } = createWriting();
      return { ...book, kind };
    };
    expect(writingFromBackup(open, old("article")).split).toBe(false);
    expect(writingFromBackup(open, old("stories")).split).toBe(true);
    // An article that somehow holds two chapters shows both, in chapters.
    const two = old("article");
    two.chapters.push({ ...two.chapters[0], id: "second", position: 1 });
    expect(writingFromBackup(open, two).split).toBe(true);
  });

  it("puts a writing back split into chapters when it was, before it was joined", () => {
    const joined = { ...createWriting(), split: false };
    const before = createWriting();
    before.chapters.push({ ...before.chapters[0], id: "second", position: 1 });
    expect(writingFromSnapshot(joined, { title: "T", split: true, chapters: before.chapters }).split).toBe(true);
    // A snapshot from before the switch, of one page, keeps the writing as it is.
    expect(writingFromSnapshot(joined, { title: "T", chapters: [joined.chapters[0]] }).split).toBe(false);
  });
});

describe("pictures", () => {
  it("gives the image type from the file name", () => {
    expect(imageType("C:/Photos/attic.PNG")).toBe("image/png");
    expect(imageType("keys.jpeg")).toBe("image/jpeg");
    expect(imageType("fog.webp")).toBe("image/webp");
    expect(imageType("lamp.gif")).toBe("image/gif");
  });

  it("notices see-through pixels, which JPEG would turn black", () => {
    expect(hasTransparency(new Uint8ClampedArray([0, 0, 0, 255, 9, 9, 9, 255]))).toBe(false);
    expect(hasTransparency(new Uint8ClampedArray([0, 0, 0, 255, 9, 9, 9, 0]))).toBe(true);
  });
});
