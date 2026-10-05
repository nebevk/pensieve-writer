import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "$lib/model";
import { createSaveQueue } from "$lib/save/queue";
import { missingItems, normalizeNote, normalizeTask, projectFromBackup, snapshotPayload } from "$lib/storage/restore";
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
});

describe("notes in snapshots", () => {
  it("keeps notes and to-dos with the chapters", () => {
    const project = createProject();
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
  it("names each backup after its book", () => {
    expect(backupBookKey("3f2a9c1b-1111-2222-3333-444455556666")).toBe("3f2a9c1b");
    expect(backupFileName("3f2a9c1b-1111", "2026-10-05T14:02:11.123Z")).toBe(
      "pensieve-3f2a9c1b-2026-10-05T14-02-11.123Z.json",
    );
  });

  it("sees an unchanged book as unchanged, even when edit times moved", () => {
    const project = createProject();
    project.chapters[0].plainText = "Ana took the keys.";
    const before = backupSignature(project, [note("n1", "x")], [task("t1")]);
    const later = "2030-01-01T00:00:00.000Z";
    const touched = {
      ...project,
      updatedAt: later,
      chapters: project.chapters.map((chapter) => ({ ...chapter, updatedAt: later })),
    };
    expect(backupSignature(touched, [{ ...note("n1", "x"), updatedAt: later }], [{ ...task("t1"), updatedAt: later }])).toBe(
      before,
    );
  });

  it("notices a one-letter change", () => {
    const project = createProject();
    project.chapters[0].plainText = "Ana took the keys.";
    const before = backupSignature(project, [], []);
    project.chapters[0].plainText = "Ana took the key.";
    expect(backupSignature(project, [], [])).not.toBe(before);
  });

  it("reads a backup file back, including č š ž", () => {
    const project = createProject();
    project.title = "Zgodbe ob reki";
    project.chapters[0].plainText = "Čaša, šal, žaba";
    const text = JSON.stringify(backupFile(project, [note("n1", "")], [task("t1")], when));
    const backup = parseBackup(text);
    expect(backup.savedAt).toBe(when);
    expect(backup.project.title).toBe("Zgodbe ob reki");
    expect(backup.project.chapters[0].plainText).toBe("Čaša, šal, žaba");
    expect(backup.notes).toHaveLength(1);
    expect(backup.tasks).toHaveLength(1);
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

  it("restores a backup from another computer into the open book", () => {
    const open = createProject();
    const saved = createProject();
    saved.title = "The Lantern House";
    saved.kind = "stories";
    saved.chapters[0].plainText = "The keys hung on a nail.";
    const restored = projectFromBackup(open, saved);
    expect(restored.id).toBe(open.id);
    expect(restored.title).toBe("The Lantern House");
    expect(restored.kind).toBe("stories");
    expect(restored.chapters[0].projectId).toBe(open.id);
    expect(restored.chapters[0].plainText).toBe("The keys hung on a nail.");
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
