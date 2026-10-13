import type { SnapshotInfo, Writing } from "$lib/model";
import { errorMessage } from "$lib/save/autosave";
import { readSnapshotChapters, restoreChapter, sqliteStorage } from "$lib/storage/sqlite";

/** What the Earlier versions window needs from the page around it (+page.svelte). */
export type VersionsHost = {
  writing: () => Writing | null;
  /** The chapter on the page, whose earlier text is shown. */
  activeChapter: () => string | null;
  /**
   * Puts a writing back: the editor closes and everything is saved first, `restore` gives the writing as it
   * is to be, and `open` the chapter to show in it.
   */
  putBack: (restore: () => Promise<Writing>, open: (restored: Writing) => string | null) => Promise<void>;
  fail: (message: string) => void;
};

/**
 * Earlier versions (SV-3): the open writing's snapshots, the chapter on the page as it was in the one picked,
 * and putting back that chapter or the whole writing.
 */
export class EarlierVersions {
  open = $state(false);
  list = $state<SnapshotInfo[]>([]);
  /** The chapter on the page as it was in the snapshot picked; "missing" when the snapshot hasn't it. */
  preview = $state<{ title: string; text: string } | "missing" | null>(null);
  snapshotId = $state("");
  chapterId = $state("");
  #host: VersionsHost;

  constructor(host: VersionsHost) {
    this.#host = host;
  }

  /** Nothing picked or open: the writing it belonged to has gone. */
  reset() {
    this.open = false;
    this.list = [];
    this.snapshotId = "";
    this.chapterId = "";
    this.preview = null;
  }

  async show() {
    const writing = this.#host.writing();
    if (!writing) return;
    this.open = true;
    this.preview = null;
    this.chapterId = "";
    this.snapshotId = "";
    try {
      this.list = await sqliteStorage.listSnapshots(writing.id);
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  async pick(id: string) {
    this.snapshotId = id;
    this.preview = null;
    this.chapterId = "";
    try {
      const older = await readSnapshotChapters(id);
      // A quicker click on another snapshot wins.
      if (this.snapshotId !== id) return;
      const match = older.find((chapter) => chapter.id === this.#host.activeChapter());
      if (!match) {
        this.preview = "missing";
        return;
      }
      this.chapterId = match.id;
      this.preview = { title: match.title, text: match.plainText };
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  async restoreChapter() {
    if (!this.snapshotId || !this.chapterId) return;
    const snapshotId = this.snapshotId;
    const chapterId = this.chapterId;
    try {
      await this.#host.putBack(
        () => restoreChapter(snapshotId, chapterId),
        () => chapterId,
      );
      this.open = false;
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }

  /**
   * Puts the whole book back as it was in the chosen snapshot (SV-3). The book as it is now is kept first as a
   * "Before restore" snapshot, and the open chapter stays open if the snapshot has it.
   */
  async restoreBook() {
    const snapshotId = this.snapshotId;
    if (!snapshotId) return;
    const active = this.#host.activeChapter();
    try {
      await this.#host.putBack(
        () => sqliteStorage.restore(snapshotId),
        (restored) => restored.chapters.find((chapter) => chapter.id === active)?.id ?? restored.chapters[0]?.id ?? null,
      );
      this.open = false;
    } catch (error) {
      this.#host.fail(errorMessage(error));
    }
  }
}
