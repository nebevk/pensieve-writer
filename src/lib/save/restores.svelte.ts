import type { Shelf, Writing } from "$lib/model";
import { chooseBackupFile, readBackupFile } from "$lib/storage/backup";
import type { BackupContent } from "$lib/storage/backupFile";
import { locale, t } from "$lib/ui.svelte";
import { errorMessage } from "./autosave";
import { keptCopiesFolder, listKeptCopies, removeKeptCopy } from "./kept";

/** What Settings says of a backup picked to restore, before it is: its name, when it was made, and whether it comes in beside. */
export type BackupOffer = { title: string; savedAt: string; otherBook: boolean };

/** What Settings' backups and kept copies need from the page around them (+page.svelte), IMP-28. */
export type RestoresHost = {
  shelf: () => Shelf | null;
  writing: () => Writing | null;
  /** Puts a backup, or a kept copy, back into the open project and opens what came back. */
  restore: (backup: BackupContent) => Promise<void>;
  /** A restore done: Settings closes, and the page shows what came back. */
  restored: () => void;
  /** Said in Settings, under its rows. */
  say: (message: string) => void;
};

/**
 * Settings' backups and kept copies: a backup or a kept copy (ARCH-5) picked, asked about, then put back into the
 * open project; and the copies of writings deleted for good, counted and removed.
 */
export class Restores {
  /** A backup picked to restore, asked about before it is. */
  pending = $state.raw<BackupContent | null>(null);
  /** How many copies of writings deleted for good Pensieve keeps in its own folder. */
  keptCount = $state(0);
  // Where the one asked about was picked, for a rescue copy restored that way.
  #pendingPath = "";
  #host: RestoresHost;

  constructor(host: RestoresHost) {
    this.#host = host;
  }

  async #pickWith(choose: () => Promise<string | null>) {
    try {
      const path = await choose();
      if (path) this.pending = await readBackupFile(path);
      this.#pendingPath = path ?? "";
    } catch (error) {
      this.#host.say(errorMessage(error));
    }
  }

  /** Settings' Restore from a backup: one picked anywhere, to ask about. */
  pick(): Promise<void> {
    return this.#pickWith(() => chooseBackupFile());
  }

  /** Settings' Bring one back: a kept copy, picked in their folder, asked about as a backup is. */
  bringBackKept(): Promise<void> {
    return this.#pickWith(async () => chooseBackupFile(await keptCopiesFolder("deleted"), t("dialogKeptCopy")));
  }

  cancel() {
    this.pending = null;
  }

  /** The one asked about, put back. A rescue copy from Pensieve's own folder isn't offered again after. */
  async restore() {
    const backup = this.pending;
    const path = this.#pendingPath;
    if (!backup) return;
    this.pending = null;
    try {
      await this.#host.restore(backup);
      if (backup.rescue && path) {
        const folder = (await keptCopiesFolder("rescue").catch(() => "")).toLowerCase();
        const name = path.split(/[\\/]/).pop() ?? "";
        if (folder && path.toLowerCase().startsWith(folder)) await removeKeptCopy("rescue", name).catch(() => undefined);
      }
      this.#host.restored();
    } catch (error) {
      this.#host.say(errorMessage(error));
    }
  }

  /** What Settings asks of the one picked, or null when none is, or no writing is open. */
  offer(): BackupOffer | null {
    const backup = this.pending;
    if (!backup || !this.#host.writing()) return null;
    const shelf = this.#host.shelf();
    const saved = new Date(backup.savedAt);
    const ids = new Set(shelf?.writings.map((item) => item.id) ?? []);
    return {
      // One writing (a copy of a writing deleted for good, say) is named as itself; a whole project by its name.
      title: (backup.format === 2 && backup.writings.length > 1 ? backup.title : backup.writings[0]?.title) || t("untitled"),
      savedAt: Number.isNaN(saved.getTime()) ? t("unknownDate") : saved.toLocaleString(locale()),
      // A backup of this project, or of a writing it has, puts things back; any other comes in beside them.
      otherBook: backup.format === 2 ? backup.projectId !== (shelf?.projectId ?? "") : !backup.writings.some((item) => ids.has(item.id)),
    };
  }

  /** Counts the copies of writings deleted for good; rescue copies go only once brought back. */
  async refreshKept() {
    try {
      this.keptCount = (await listKeptCopies("deleted")).length;
    } catch {
      this.keptCount = 0;
    }
  }

  /** Settings' Remove them: the copies of writings deleted for good go. */
  async removeKept() {
    try {
      for (const copy of await listKeptCopies("deleted")) await removeKeptCopy("deleted", copy.name);
      this.#host.say(t("keptRemoved"));
    } catch (error) {
      this.#host.say(errorMessage(error));
    }
    await this.refreshKept();
  }
}
