import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, Task } from "$lib/storage/organize";

// The file, and what was saved to it, in order.
let file: { notes: Note[]; tasks: Task[] } = { notes: [], tasks: [] };
const saved: string[] = [];
vi.mock("$lib/storage/organize", () => ({
  listNotes: async () => file.notes,
  listTasks: async () => file.tasks,
  saveNote: async (note: Note) => void saved.push(`note ${note.id} ${note.plainText} [${note.chapterIds.join(",")}]`),
  saveTask: async (task: Task) => void saved.push(`task ${task.id} ${task.chapterId}`),
  scheduleNoteSave: (note: Note) => void saved.push(`later ${note.id} ${note.plainText} [${note.chapterIds.join(",")}]`),
}));

const { NotesStore } = await import("./notes.svelte");

const note = (id: string, text: string, chapterIds: string[] = []): Note => ({
  id,
  projectId: "projekt",
  title: id,
  contentJson: { type: "doc", content: [] },
  plainText: text,
  category: "characters",
  tags: "",
  aliases: "",
  fields: [],
  todoState: null,
  chapterIds,
  createdAt: "2026-10-18T10:00:00.000Z",
  updatedAt: "2026-10-18T10:00:00.000Z",
});
const task = (id: string, chapterId: string): Task => ({ id, projectId: "projekt", title: id, todoState: "todo", updatedAt: "", chapterId, noteId: "" });

describe("the open project's notes, one copy (ARCH-13)", () => {
  let project: string;
  let store: InstanceType<typeof NotesStore>;

  beforeEach(async () => {
    project = "projekt";
    saved.length = 0;
    file = { notes: [note("ana", "Hči mlinarja.", ["drugo"]), note("bor", "Brod.")], tasks: [task("t1", "drugo"), task("t2", "prvo")] };
    store = new NotesStore({ projectId: () => project });
    await store.reload();
  });

  it("a note typed beside the page changes its draft, not the lists, until she leaves it", () => {
    store.open(store.notes[0]);
    store.edit("ana", { plainText: "Hči mlinarja. Rada ima reko." });
    expect(store.draft?.note.plainText).toBe("Hči mlinarja. Rada ima reko.");
    expect(store.notes[0].plainText).toBe("Hči mlinarja.");
    expect(store.find("ana")?.plainText).toBe("Hči mlinarja. Rada ima reko.");
    expect(saved).toEqual(["later ana Hči mlinarja. Rada ima reko. [drugo]"]);
    store.leave();
    expect([store.draft, store.notes[0].plainText]).toEqual([null, "Hči mlinarja. Rada ima reko."]);
  });

  it("chapters joined: the note open beside the page takes the joined page at once, and is saved from its draft", async () => {
    store.open(store.notes[0]);
    store.edit("ana", { plainText: "Najnovejše besede." });
    saved.length = 0;
    const moving = store.moveChapterLinks(["drugo"], "prvo");
    // Before anything is read or saved: a key she types now saves the new chapter.
    expect(store.draft?.note.chapterIds).toEqual(["prvo"]);
    await moving;
    expect(saved).toEqual(["task t1 prvo", "note ana Najnovejše besede. [prvo]"]);
    store.edit("ana", { plainText: "Še ena beseda." });
    expect(saved.at(-1)).toBe("later ana Še ena beseda. [prvo]");
  });

  it("chapters joined with no note open: each linked note saved from the file, its chapter moved", async () => {
    await store.moveChapterLinks(["drugo"], "prvo");
    expect(saved).toEqual(["task t1 prvo", "note ana Hči mlinarja. [prvo]"]);
  });

  it("a note as it is now: the draft while it is open, else read again", async () => {
    store.open(store.notes[0]);
    store.edit("ana", { plainText: "V osnutku." });
    expect((await store.current("ana"))?.plainText).toBe("V osnutku.");
    file.notes = [note("bor", "Brod, prenovljen.")];
    expect((await store.current("bor"))?.plainText).toBe("Brod, prenovljen.");
    expect(store.notes.map((item) => item.id)).toEqual(["bor"]);
  });

  it("lists read for a project left meanwhile are let go", async () => {
    file.notes = [note("drug", "Iz drugega projekta.")];
    const reading = store.reload();
    project = "drugi";
    await reading;
    expect(store.notes.map((item) => item.id)).toEqual(["ana", "bor"]);
  });

  it("a note deleted takes its draft and its to-dos with it", () => {
    store.tasks = [...store.tasks, { ...task("t3", ""), noteId: "ana" }];
    store.open(store.notes[0]);
    store.removed("ana");
    expect([store.draft, store.notes.map((item) => item.id), store.tasks.map((item) => item.id)]).toEqual([null, ["bor"], ["t1", "t2"]]);
  });

  it("renamed from a tree: the list's copy and the draft's", () => {
    store.open(store.notes[0]);
    store.replaced({ ...store.notes[0], title: "Ana Novak" });
    expect([store.notes[0].title, store.draft?.note.title]).toEqual(["Ana Novak", "Ana Novak"]);
  });
});
