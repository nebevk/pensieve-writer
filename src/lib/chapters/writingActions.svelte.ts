import { folderNameProblem } from "$lib/chapters/library";
import { joinWriting, splitWriting } from "$lib/chapters/page";
import { draftChapters, writingFromDocument, type WritingDraft } from "$lib/export/importWriting";
import { replaceBookChapters, type ImportedChapter, type WordImport } from "$lib/export/wordImport";
import { isUntitled } from "$lib/i18n";
import { createChapter, emptyDocument, type Shelf, type Writing } from "$lib/model";
import { errorMessage } from "$lib/save/autosave";
import { deletedName, writeKeptCopy } from "$lib/save/kept";
import { backupFile } from "$lib/storage/backupFile";
import { flushNoteSave } from "$lib/storage/organize";
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

/**
 * A writing about to be deleted for good, as it is, in Pensieve's own folder: a backup file of it alone, which
 * Settings' Bring one back puts back into the project (ARCH-5). Its earlier versions aren't in it.
 */
async function keepErasedCopy(shelf: Shelf | null, id: string): Promise<void> {
  if (!shelf) throw new Error(t("couldNotSave"));
  const writing = await loadWriting(id);
  const outline = shelf.writings.find((item) => item.id === id);
  const now = new Date();
  const file = backupFile(
    { id: shelf.projectId, title: shelf.title, folders: shelf.folders },
    [{ ...writing, folder: outline?.folder ?? "", position: outline?.position ?? 0, deletedAt: "" }],
    [],
    [],
    now.toISOString(),
  );
  await writeKeptCopy("deleted", deletedName(writing.title, now), JSON.stringify(file));
}

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
  /** To-dos and note links on chapters joined into one page now point at that page (notes.svelte.ts). */
  moveChapterLinks: (removed: string[], kept: string) => Promise<void>;
  notice: (message: string) => void;
  fail: (message: string) => void;
};

/**
 * A document as the one page of a writing that isn't split, under the writing's title. A document of one
 * page is that page; one of chapters has each title as a heading in it, as joining a writing makes them,
 * except a first one named like the writing, which is the page's title line.
 */
function onePage(writing: Writing, draft: WritingDraft, now: string): ImportedChapter {
  if (!draft.split) {
    const only = draft.chapters[0];
    return { title: writing.title, contentJson: only?.contentJson ?? emptyDocument(), plainText: only?.plainText ?? "" };
  }
  const same = (title: string) => title.trim().toLowerCase() === writing.title.trim().toLowerCase();
  const joined = joinWriting(
    {
      ...writing,
      split: true,
      chapters: draft.chapters.map((item, index) => ({
        ...createChapter(writing.id, index === 0 && same(item.title) ? "" : item.title, index, now),
        contentJson: item.contentJson,
        plainText: item.plainText,
        ...(item.part !== undefined ? { part: item.part } : {}),
      })),
    },
    now,
  ).writing.chapters[0];
  return { title: joined.title, contentJson: joined.contentJson, plainText: joined.plainText };
}

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
  // Documents being brought in: others wait until they are.
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
    const shelf = this.#host.shelf();
    try {
      // A copy of it first, in Pensieve's own folder: nothing goes if the copy can't be written (ARCH-5).
      try {
        await keepErasedCopy(shelf, id);
      } catch (error) {
        const title = shelf?.writings.find((item) => item.id === id)?.title || t("untitled");
        this.#host.fail(t("deleteNotKept", { title, message: errorMessage(error) }));
        return;
      }
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
      await host.moveChapterLinks(joined.removed, joined.kept);
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
   * Writings made from documents (New writing from Word, documents dropped in Write, a file in the library):
   * added to the open project, the first one opened. Only into the project they were read for: another may
   * open while they are read.
   */
  async addDrafts(drafts: WritingDraft[]) {
    const host = this.#host;
    const writing = host.writing();
    if (!writing || !host.shelf() || drafts.length === 0 || this.#importing) return;
    this.#importing = true;
    const project = host.projectId();
    const language = writing.language;
    try {
      // After any switch under way, and only into the project it was asked for.
      const made = await host.oneAtATime(async () => {
        if (host.projectId() !== project) return [];
        const ids: string[] = [];
        for (const draft of drafts) ids.push((await addWriting({ title: draft.title, folder: "", split: draft.split, language, chapters: draftChapters(draft) })).id);
        return ids;
      });
      if (made.length === 0) {
        host.notice(t("importOtherProject", { title: drafts[0].title }));
        return;
      }
      // Outside the queued change: openWriting queues its own.
      await host.openWriting(made[0]);
      if (host.projectId() !== project) return;
      host.notice(drafts.length === 1 ? t("importedAsWriting", { title: drafts[0].title }) : t("writingsAdded", { titles: drafts.map((draft) => draft.title).join(", ") }));
    } catch (error) {
      host.fail(errorMessage(error));
    } finally {
      this.#importing = false;
    }
  }

  /**
   * Bring back from Word: the open writing becomes the document's (its Word copy changed in Word, say), after
   * an earlier version of it is kept. A chapter with the same title, or in the same place, keeps its notes
   * and to-dos. A writing of one page stays one page, the document's chapters joined in it. The document's
   * own Title names a writing still untitled; `name` is its file's.
   */
  async bringBack(read: WordImport, name: string) {
    const host = this.#host;
    const project = host.projectId();
    try {
      await host.withEditorClosed(async () => {
        const writing = host.writing();
        if (!writing || host.projectId() !== project) return;
        await keepSnapshot(writing);
        const now = new Date().toISOString();
        const chapters = writing.split ? read.chapters : [onePage(writing, writingFromDocument(read, name, t("untitled")), now)];
        let next = replaceBookChapters(writing, chapters, now);
        if (read.title && isUntitled(writing.title)) next = { ...next, title: read.title };
        await sqliteStorage.save(next);
        host.putOpen(next);
        host.notice(t("broughtBack", { title: next.title }));
      });
    } catch (error) {
      host.fail(errorMessage(error));
    }
  }
}
