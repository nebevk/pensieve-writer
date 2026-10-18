import { deleteTask, listNotes, listTasks, saveNote, saveTask, scheduleNoteSave, type Note, type Task } from "$lib/storage/organize";

/** What the open project's notes need from the page around it (+page.svelte). */
export type NotesHost = {
  /** The open project's id, the key its notes and to-dos are saved under. */
  projectId: () => string;
};

/**
 * The open project's notes and to-dos, one copy for the page, the panel beside it and the library's trees
 * (ARCH-13). Their changes come through here, so whatever shows them shows the change at once; the save
 * queue (organize.ts) writes them. The note open beside the page is a draft while she types it, newer than
 * its copy in the list, so the lists and what reads every note aren't worked out again at each key: they
 * have it when she leaves the note.
 */
export class NotesStore {
  notes = $state.raw<Note[]>([]);
  tasks = $state.raw<Task[]>([]);
  /** The note open beside the page, as she types it; `fresh` for one just made, to be named. */
  draft = $state.raw<{ note: Note; fresh: boolean } | null>(null);
  /** Why they couldn't be read the last time, for Home to say; empty once they were. */
  error = $state("");
  #host: NotesHost;

  constructor(host: NotesHost) {
    this.#host = host;
  }

  /** The newest copy of a note: the draft while she types it, else the list's. */
  find(id: string): Note | undefined {
    return this.draft?.note.id === id ? this.draft.note : this.notes.find((note) => note.id === id);
  }

  /** Reads them again (after any change still waiting), as the views of their own may have changed them. */
  async reload() {
    const project = this.#host.projectId();
    if (!project) return;
    try {
      const [notes, tasks] = await Promise.all([listNotes(), listTasks()]);
      if (project !== this.#host.projectId()) return;
      this.notes = notes;
      this.tasks = tasks;
      this.error = "";
    } catch (error) {
      // The lists keep what they had, and say why.
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * A note as it is now: the draft while she writes it, else read again from the file (after any save still
   * waiting), as the Notes, Ideas and To-dos views keep copies of their own and may have changed it since the
   * list was read. Acting on an older copy would save it over her newer words.
   */
  async current(id: string): Promise<Note | null> {
    if (this.draft?.note.id === id) return this.draft.note;
    const project = this.#host.projectId();
    const notes = await listNotes();
    if (project !== this.#host.projectId()) return null;
    this.notes = notes;
    return notes.find((note) => note.id === id) ?? null;
  }

  /** A note made and saved, first in the list. */
  added(note: Note) {
    this.notes = [note, ...this.notes];
  }

  /** A note changed and saved elsewhere than in its draft (renamed or moved from a tree): the list's and the draft's. */
  replaced(note: Note) {
    this.notes = this.notes.map((item) => (item.id === note.id ? note : item));
    if (this.draft?.note.id === note.id) this.draft = { ...this.draft, note };
  }

  /** A note deleted, with its to-dos. */
  removed(id: string) {
    if (this.draft?.note.id === id) this.draft = null;
    this.notes = this.notes.filter((note) => note.id !== id);
    this.tasks = this.tasks.filter((task) => task.noteId !== id);
  }

  /** A to-do made, last in the list (`first` for the top). */
  addedTask(task: Task, first = false) {
    this.tasks = first ? [task, ...this.tasks] : [...this.tasks, task];
  }

  /** A to-do changed. */
  replacedTask(task: Task) {
    this.tasks = this.tasks.map((item) => (item.id === task.id ? task : item));
  }

  /** A note changed, in the lists at once and saved now (a click: a to-do's state, a new name). */
  async setNote(note: Note) {
    this.replaced(note);
    await saveNote(note);
  }

  /** A to-do changed, in the lists at once and saved now. */
  async setTask(task: Task) {
    this.replacedTask(task);
    await saveTask(task);
  }

  /** A to-do made, in the lists at once (`first` for the top) and saved now. */
  async addTask(task: Task, first = false) {
    this.addedTask(task, first);
    await saveTask(task);
  }

  /** A to-do deleted. */
  async deleteTask(id: string) {
    this.tasks = this.tasks.filter((task) => task.id !== id);
    await deleteTask(id);
  }

  /** Opens a note beside the page to write in; one open before goes back into the list. */
  open(note: Note, fresh = false) {
    this.leave();
    this.draft = { note, fresh };
  }

  /** The draft goes back into the list, and `then` opens beside the page, or nothing. */
  leave(then: Note | null = null) {
    const left = this.draft?.note;
    if (left) this.notes = this.notes.map((note) => (note.id === left.id ? left : note));
    this.draft = then ? { note: then, fresh: false } : null;
  }

  /** The draft let go without going back (its project is closing; its saves are queued). */
  drop() {
    this.draft = null;
  }

  /** A change she types to a note: the draft's while it is open beside the page, else the list's; saved after a moment. */
  edit(id: string, patch: Partial<Note>) {
    const current = this.find(id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    // Typed into once, it is no longer new.
    if (this.draft?.note.id === id) this.draft = { note: next, fresh: false };
    else this.notes = this.notes.map((note) => (note.id === id ? next : note));
    scheduleNoteSave(next);
  }

  /**
   * To-dos and note links on chapters joined into one page now point at that page. The draft's first, so a key
   * she types meanwhile saves the new chapters; then each from the file, after any change still waiting, except
   * the draft, which is newer. The lists are for the caller to read again (reload).
   */
  async moveChapterLinks(removed: string[], kept: string) {
    if (removed.length === 0 || !kept) return;
    const gone = new Set(removed);
    const moved = (ids: string[]) => [...new Set(ids.map((id) => (gone.has(id) ? kept : id)))];
    const draft = this.draft;
    if (draft && draft.note.chapterIds.some((id) => gone.has(id))) {
      this.draft = { ...draft, note: { ...draft.note, chapterIds: moved(draft.note.chapterIds), updatedAt: new Date().toISOString() } };
    }
    const [notes, tasks] = await Promise.all([listNotes(), listTasks()]);
    for (const task of tasks) {
      if (gone.has(task.chapterId)) await saveTask({ ...task, chapterId: kept });
    }
    for (const note of notes) {
      if (!note.chapterIds.some((id) => gone.has(id))) continue;
      const open = this.draft?.note.id === note.id ? this.draft.note : null;
      await saveNote(open ?? { ...note, chapterIds: moved(note.chapterIds) });
    }
  }
}
