import { folderNameProblem } from "$lib/chapters/library";
import { joinWriting, splitWriting } from "$lib/chapters/page";
import { documentName, draftChapters, writingFromDocument } from "$lib/export/importWriting";
import type { WordImport } from "$lib/export/wordImport";
import type { Shelf, Writing } from "$lib/model";
import { errorMessage } from "$lib/save/autosave";
import { flushNoteSave, listNotes, listTasks, saveNote, saveTask } from "$lib/storage/organize";
import {
  addWriting,
  duplicateWriting,
  eraseWriting,
  keepSnapshot,
  loadWriting,
  readOpenShelf,
  renameWritingFolder,
  setShelf,
  setWritingFields,
  setWritingOrder,
  sqliteStorage,
} from "$lib/storage/sqlite";
import { t } from "$lib/ui.svelte";

/** What a project's writings need from the page around them (+page.svelte), IMP-28. */
export type WritingsHost = {
  shelf: () => Shelf | null;
  writing: () => Writing | null;
  /** The open writing's id, and its project's. */
  writingId: () => string;
  projectId: () => string;
  /** Runs one change after the ones before it. */
  oneAtATime: <T>(work: () => Promise<T>) => Promise<T>;
  /** Runs work with the page's editor closed, and opens it again after. */
  withEditorClosed: (work: () => Promise<void>) => Promise<void>;
  /** Saves the open writing's last words. */
  flush: () => Promise<void>;
  openWriting: (id: string) => Promise<void>;
  /** Shows another writing; gives back the one left, as it was. */
  showWriting: (id: string) => Promise<Writing | null>;
  /** The open writing, joined or split: the page shows it, on the chapter it was on where it can be. */
  putOpen: (next: Writing) => void;
  /** Renames the open writing through its page. */
  renameOpen: (title: string) => void;
  /** The Word copy of a writing just left, as it was. */
  copyLeft: (left: Writing) => void;
  refreshShelf: () => Promise<void>;
  rememberProject: () => void;
  /** Reads the project's notes and to-dos again. */
  loadOrganizer: () => Promise<void>;
  notice: (message: string) => void;
  fail: (message: string) => void;
  /** A Word, text or Markdown file, read into chapters, its pictures made small. */
  readDocument: (path: string) => Promise<WordImport>;
};

/** A folder name for writings: one Windows takes, and not one the project has already. */
export function nameCheck(name: string, taken: string[]): string | null {
  const problem = folderNameProblem(name);
  if (problem) return t(problem);
  const wanted = name.trim().toLowerCase();
  return taken.some((item) => item.trim().toLowerCase() === wanted) ? t("nameTaken") : null;
}

/**
 * A project's writings and writing folders, from the library: made, renamed, duplicated, put in Deleted and
 * back, erased, moved, split into chapters or joined into one page.
 */
export class WritingActions {
  #host: WritingsHost;
  // A file being brought in: another waits until it is.
  #importing = false;

  constructor(host: WritingsHost) {
    this.#host = host;
  }

  /** A new writing in the open project, in a folder or none, opened at once. */
  async make(folder: string, name: string): Promise<string | null> {
    const host = this.#host;
    const writing = host.writing();
    if (!host.shelf() || !writing) return null;
    const title = name.trim();
    if (!title) return t("nameEmpty");
    try {
      const made = await addWriting({ title, folder, split: true, language: writing.language });
      await host.refreshShelf();
      await host.openWriting(made.id);
      host.rememberProject();
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  /** A new writing folder in the open project; it stays while empty. */
  async makeFolder(name: string): Promise<string | null> {
    const shelf = this.#host.shelf();
    if (!shelf) return null;
    const problem = nameCheck(name, shelf.folders);
    if (problem) return problem;
    try {
      await setShelf({ folders: [...shelf.folders, name.trim()] });
      await this.#host.refreshShelf();
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  async renameFolder(from: string, to: string): Promise<string | null> {
    const shelf = this.#host.shelf();
    if (!shelf || from === to.trim()) return null;
    const problem = nameCheck(to, shelf.folders.filter((name) => name !== from));
    if (problem) return problem;
    try {
      await renameWritingFolder(from, to.trim(), shelf.folders.map((name) => (name === from ? to.trim() : name)));
      await this.#host.refreshShelf();
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  /** Deletes a writing folder; its writings stay, out of folders. */
  async deleteFolder(name: string) {
    const shelf = this.#host.shelf();
    if (!shelf) return;
    try {
      await renameWritingFolder(name, "", shelf.folders.filter((item) => item !== name));
      await this.#host.refreshShelf();
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  /** Renames a writing, the open one through its page, any other in its file. */
  async rename(id: string, title: string) {
    const host = this.#host;
    const next = title.trim() || t("untitled");
    if (id === host.writingId()) {
      host.renameOpen(next);
      return;
    }
    try {
      const outline = host.shelf()?.writings.find((item) => item.id === id);
      if (outline && !outline.split) {
        await host.oneAtATime(async () => {
          const one = await loadWriting(id);
          await sqliteStorage.save({ ...one, title: next, chapters: one.chapters.map((chapter, index) => (index === 0 ? { ...chapter, title: next } : chapter)) });
        });
      } else await setWritingFields(id, { title: next });
      await host.refreshShelf();
      host.rememberProject();
    } catch (error) {
      host.fail(errorMessage(error));
    }
  }

  async duplicate(id: string) {
    const host = this.#host;
    const shelf = host.shelf();
    if (!shelf) return;
    try {
      if (id === host.writingId()) await host.flush();
      const source = shelf.writings.find((item) => item.id === id);
      await duplicateWriting(id, t("copyOf", { title: source?.title ?? t("untitled") }));
      await host.refreshShelf();
      host.rememberProject();
    } catch (error) {
      host.fail(errorMessage(error));
    }
  }

  /**
   * Puts a writing in the Deleted folder at the end of the project; the open one gives way to another first.
   * It runs after the changes before it, deciding then whether the writing is the open one, so a writing
   * being opened, or one deleted just before, never ends up open in Deleted.
   */
  async delete(id: string) {
    const host = this.#host;
    const shelf = host.shelf();
    if (!shelf) return;
    const source = shelf.writings.find((item) => item.id === id);
    const project = host.projectId();
    const putInDeleted = () => setWritingFields(id, { deletedAt: new Date().toISOString() });
    try {
      // One that isn't open goes as it is, the page left alone, unless it was opened meanwhile.
      let done = false;
      if (id !== host.writingId()) {
        done = await host.oneAtATime(async () => {
          if (host.projectId() !== project) return true;
          if (id === host.writingId()) return false;
          await putInDeleted();
          return true;
        });
      }
      let left: Writing | null = null;
      if (!done) {
        await host.withEditorClosed(async () => {
          if (host.projectId() !== project) return;
          if (id !== host.writingId()) {
            await putInDeleted();
            return;
          }
          // The open one gives way first, to a writing that isn't in Deleted, or to a new, empty one, so there is
          // a page to write on. If that fails it stays open, never in Deleted while she writes in it.
          const other = (await readOpenShelf()).writings.find((item) => item.id !== id && !item.deletedAt);
          const next = other?.id ?? (await addWriting({ title: t("untitled"), folder: "", split: true, language: host.writing()?.language ?? "en" })).id;
          left = await host.showWriting(next);
          await putInDeleted();
        });
      }
      if (host.projectId() !== project) return;
      if (left) host.copyLeft(left);
      await host.refreshShelf();
      host.rememberProject();
      host.notice(t("writingDeleted", { title: source?.title ?? t("untitled") }));
    } catch (error) {
      host.fail(errorMessage(error));
    }
  }

  async putBack(id: string) {
    try {
      await setWritingFields(id, { deletedAt: "" });
      await this.#host.refreshShelf();
      this.#host.rememberProject();
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  async erase(id: string) {
    if (id === this.#host.writingId()) return;
    try {
      await eraseWriting(id);
      await this.#host.refreshShelf();
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  async move(id: string, folder: string) {
    try {
      await setWritingFields(id, { folder });
      await this.#host.refreshShelf();
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  /**
   * Turns "Split into chapters" on (`split`) or off for a writing. Off joins its chapters into one page
   * (each chapter's title becomes a heading) after keeping an earlier version; on splits the page at its
   * headings. To-dos and note links on the chapters that were joined move to the one page. Asked again
   * while the first change was still saving (the switch still showed the old state), it does nothing.
   */
  async setSplit(id: string, split: boolean) {
    const host = this.#host;
    if (!host.writing() || !host.shelf()) return;
    const project = host.projectId();
    // The writing joined or split, after an earlier version of it is kept; null when it is so already.
    const changed = async (target: Writing): Promise<Writing | null> => {
      if (target.split === split) return null;
      await keepSnapshot(target);
      const now = new Date().toISOString();
      if (split) return splitWriting(target, now, t("untitled"));
      const joined = joinWriting(target, now);
      await this.#movePageLinks(joined.removed, joined.kept);
      return joined.writing;
    };
    try {
      let done = false;
      if (id !== host.writingId()) {
        done = await host.oneAtATime(async () => {
          if (host.projectId() !== project) return true;
          // Opened meanwhile: done below, with the page closed.
          if (id === host.writingId()) return false;
          await flushNoteSave();
          const next = await changed(await loadWriting(id));
          if (!next) return true;
          await sqliteStorage.save(next);
          host.notice(t(next.split ? "splitDone" : "joined"));
          return true;
        });
      }
      if (!done) {
        await host.withEditorClosed(async () => {
          if (host.projectId() !== project) return;
          const writing = host.writing();
          const open = writing?.id === id;
          const target = open && writing ? writing : await loadWriting(id);
          const next = await changed(target);
          if (!next) return;
          await sqliteStorage.save(next);
          if (open) host.putOpen(next);
          host.notice(t(next.split ? "splitDone" : "joined"));
        });
      }
      await host.refreshShelf();
      // The to-dos and notes moved onto the joined page: the panel and the tree read them again.
      await host.loadOrganizer();
      host.rememberProject();
    } catch (error) {
      host.fail(errorMessage(error));
    }
  }

  /** Puts a writing just before another one of the open project, in that one's writing folder. */
  async place(id: string, beforeId: string) {
    const shelf = this.#host.shelf();
    if (!shelf || id === beforeId) return;
    const order = [...shelf.writings].sort((a, b) => a.position - b.position).map((item) => item.id).filter((item) => item !== id);
    const at = order.indexOf(beforeId);
    if (at < 0) return;
    order.splice(at, 0, id);
    const folder = shelf.writings.find((item) => item.id === beforeId)?.folder ?? "";
    try {
      await setWritingOrder(order);
      await setWritingFields(id, { folder });
      await this.#host.refreshShelf();
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  /**
   * A Word, text or Markdown file brought into the open project as a new writing, and opened: its chapters
   * begin at its top headings (or chapter lines), and a file without any is one page.
   */
  async importFile(path: string) {
    const host = this.#host;
    const writing = host.writing();
    if (!writing || !host.shelf() || this.#importing) return;
    this.#importing = true;
    // The project it was asked for, and its language: another project may open while the file is read.
    const project = host.projectId();
    const language = writing.language;
    try {
      const name = documentName(path);
      host.notice(t("importingWord", { name }));
      const draft = writingFromDocument(await host.readDocument(path), name, t("untitled"));
      // After any switch under way, and only into the project it was asked for.
      const made = await host.oneAtATime(async () =>
        host.projectId() === project ? addWriting({ title: draft.title, folder: "", split: draft.split, language, chapters: draftChapters(draft) }) : null,
      );
      if (!made) {
        host.notice(t("importOtherProject", { title: draft.title }));
        return;
      }
      // Outside the queued change: openWriting queues its own.
      await host.openWriting(made.id);
      if (host.projectId() === project) host.notice(t("importedAsWriting", { title: draft.title }));
    } catch (error) {
      host.notice(errorMessage(error));
    } finally {
      this.#importing = false;
    }
  }

  /** To-dos and note links on chapters that were joined into one page now point at that page. */
  async #movePageLinks(removed: string[], kept: string) {
    if (removed.length === 0 || !kept) return;
    const gone = new Set(removed);
    const [notes, tasks] = await Promise.all([listNotes(), listTasks()]);
    for (const task of tasks) {
      if (gone.has(task.chapterId)) await saveTask({ ...task, chapterId: kept });
    }
    for (const note of notes) {
      if (!note.chapterIds.some((id) => gone.has(id))) continue;
      const chapterIds = [...new Set(note.chapterIds.map((id) => (gone.has(id) ? kept : id)))];
      await saveNote({ ...note, chapterIds });
    }
  }
}
