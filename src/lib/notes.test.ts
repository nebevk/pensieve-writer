import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, Task } from "$lib/storage/organize";

// The file, and what was saved to it, in order.
let file: { notes: Note[]; tasks: Task[] } = { notes: [], tasks: [] };
const saved: string[] = [];
let saveFails = false;
vi.mock("$lib/storage/organize", () => ({
  listNotes: async () => file.notes,
  listTasks: async () => file.tasks,
  saveNote: async (note: Note) => {
    if (saveFails) throw new Error("unable to open database file");
    // Its title too, when it isn't the id the notes here start with.
    const title = note.title === note.id ? "" : ` ${note.title}:`;
    saved.push(`note ${note.id}${title} ${note.plainText} [${note.chapterIds.join(",")}]`);
  },
  saveTask: async (task: Task) => void saved.push(`task ${task.id} ${task.chapterId}`),
  scheduleNoteSave: (note: Note) => void saved.push(`later ${note.id} ${note.plainText} [${note.chapterIds.join(",")}]`),
  deleteTask: async (id: string) => void saved.push(`deleted ${id}`),
  deleteNote: async (id: string) => void saved.push(`deleted note ${id}`),
  flushNoteSave: async () => void saved.push("flushed"),
}));
vi.mock("$lib/storage/sqlite", () => ({
  snapshotSavedWriting: async (id: string) => void saved.push(`earlier version of ${id}`),
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

  let writing: string;

  beforeEach(async () => {
    project = "projekt";
    writing = "pisanje";
    saved.length = 0;
    saveFails = false;
    file = { notes: [note("ana", "Hči mlinarja.", ["drugo"]), note("bor", "Brod.")], tasks: [task("t1", "drugo"), task("t2", "prvo")] };
    store = new NotesStore({ projectId: () => project, writingId: () => writing });
    await store.reload();
  });

  it("from a tree: a new note, saved and first in the list, named or not (IMP-28)", async () => {
    const named = await store.create("places", "Mlin", "prvo");
    const unnamed = await store.create("ideas", "  ");
    expect([named?.title, named?.category, named?.chapterIds, named?.projectId]).toEqual(["Mlin", "places", ["prvo"], "projekt"]);
    expect(unnamed?.title).toBe("New note");
    expect(store.notes.map((item) => item.title)).toEqual(["New note", "Mlin", "ana", "bor"]);
    expect(saved).toEqual(["note " + named?.id + " Mlin:  [prvo]", "note " + unnamed?.id + " New note:  []"]);
    project = "";
    expect(await store.create("ideas", "Brez projekta")).toBeNull();
  });

  it("from a tree: renamed from the note as it is now, the draft too, so her next word keeps the name", async () => {
    store.open(store.notes[0]);
    store.edit("ana", { plainText: "V osnutku, čšž." });
    await store.change("ana", { title: "Ana Novak" });
    expect(saved.at(-1)).toBe("note ana Ana Novak: V osnutku, čšž. [drugo]");
    expect([store.draft?.note.title, store.notes[0].title]).toEqual(["Ana Novak", "Ana Novak"]);
    store.edit("ana", { plainText: "Še ena beseda." });
    expect(store.draft?.note.title).toBe("Ana Novak");
  });

  it("from a tree: a change that can't be saved reads the lists again and says why", async () => {
    saveFails = true;
    file.notes = [note("ana", "Iz datoteke."), note("bor", "Brod.")];
    await expect(store.change("bor", { category: "places" })).rejects.toThrow("unable to open database file");
    await vi.waitFor(() => expect(store.notes[0].plainText).toBe("Iz datoteke."));
  });

  it("from a tree: a copy with text of its own, first in the list", async () => {
    await store.duplicate("ana");
    const copy = store.notes[0];
    expect([copy.title, copy.plainText, copy.id === "ana"]).toEqual(["ana (copy)", "Hči mlinarja.", false]);
    copy.chapterIds.push("tretje");
    expect(store.notes.find((item) => item.id === "ana")?.chapterIds).toEqual(["drugo"]);
  });

  it("from a tree: deleted after what waits is saved and an earlier version of the writing is kept; the draft goes first", async () => {
    store.open(store.notes[0]);
    await store.delete("ana");
    expect(saved).toEqual(["flushed", "earlier version of pisanje", "deleted note ana"]);
    expect([store.draft, store.notes.map((item) => item.id), store.tasks.map((item) => item.id)]).toEqual([null, ["bor"], ["t1", "t2"]]);
    // With no writing open, there is no earlier version to keep.
    writing = "";
    saved.length = 0;
    await store.delete("bor");
    expect(saved).toEqual(["flushed", "deleted note bor"]);
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

  it("a view's change is in the lists at once, then saved", async () => {
    await store.setTask({ ...store.tasks[0], todoState: "done" });
    await store.addTask(task("t3", ""), true);
    await store.deleteTask("t2");
    await store.setNote({ ...store.notes[1], todoState: "todo" });
    expect(store.tasks.map((item) => `${item.id} ${item.todoState}`)).toEqual(["t3 todo", "t1 done"]);
    expect(store.notes[1].todoState).toBe("todo");
    expect(saved).toEqual(["task t1 drugo", "task t3 ", "deleted t2", "note bor Brod. []"]);
  });

  it("renamed from a tree: the list's copy and the draft's", () => {
    store.open(store.notes[0]);
    store.replaced({ ...store.notes[0], title: "Ana Novak" });
    expect([store.notes[0].title, store.draft?.note.title]).toEqual(["Ana Novak", "Ana Novak"]);
  });
});
