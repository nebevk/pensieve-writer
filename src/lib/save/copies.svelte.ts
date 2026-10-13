import { ALREADY_EXISTS, CHANGED_ELSEWHERE, MUST_BE_NEW, inFolder, writeFileTo } from "$lib/export/files";
import { wordFileFor, wordLook } from "$lib/export/wordAssets";
import { isInside } from "$lib/chapters/library";
import type { Shelf, Writing } from "$lib/model";
import type { Prefs } from "$lib/prefs";
import { errorMessage } from "$lib/save/autosave";
import { chooseBackupFolder, writeBackup } from "$lib/storage/backup";
import { backupSignature } from "$lib/storage/backupFile";
import { t } from "$lib/ui.svelte";

/** What her copies outside Pensieve need from the page around it (+page.svelte). */
export type CopiesHost = {
  writing: () => Writing | null;
  shelf: () => Shelf | null;
  prefs: () => Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  /** Whether a project is opening, when nothing is written. */
  switching: () => boolean;
  /** Saves what she has written, the notes too. */
  flush: () => Promise<void>;
  libraryRoot: () => string;
  /** Says something in Settings, under the copies. */
  say: (message: string) => void;
  /** A problem shown in the window bar. */
  fail: (message: string) => void;
};

/** A name Windows takes for a file: the title without the characters it refuses. */
export function safeName(title: string): string {
  return title.trim().replace(/[<>:"/\\|?*]/g, "") || "pensieve";
}

/**
 * The backup in a folder of her choosing, such as one Google Drive keeps (SV-1): every hour while she
 * writes, when Pensieve closes, and when she asks. Never the live project in that folder.
 */
export class DriveBackup {
  #host: CopiesHost;
  #running: Promise<void> | null = null;

  constructor(host: CopiesHost) {
    this.#host = host;
  }

  /** A backup now, unless one is under way; `announce` says so in Settings, else only a failure shows. */
  run(announce: boolean): Promise<void> {
    const host = this.#host;
    if (!host.writing() || !host.prefs().backupFolder || host.switching()) return Promise.resolve();
    if (this.#running) return this.#running;
    const folder = host.prefs().backupFolder;
    this.#running = (async () => {
      try {
        await host.flush();
        if (!host.writing()) return;
        // Automatic backups skip identical copies, so idle hours don't push older versions out of the folder.
        const result = await writeBackup(folder, announce ? "" : host.prefs().lastBackupSignature);
        host.setPrefs({ lastBackupAt: new Date().toISOString(), lastBackupError: "", lastBackupSignature: result.signature });
        if (announce) host.say(result.path ? t("savedTo", { path: result.path }) : t("saved"));
      } catch (error) {
        const message = errorMessage(error);
        host.setPrefs({ lastBackupError: message });
        if (announce) host.say(message);
        else host.fail(t("backupFailedMessage", { message }));
        throw error;
      } finally {
        this.#running = null;
      }
    })();
    return this.#running;
  }

  /** Settings' Back up now. */
  async now() {
    try {
      await this.run(true);
    } catch {
      // The message is already on screen.
    }
  }

  /** Every minute, a backup once the last is an hour old. Gives how to stop. */
  start(): () => void {
    const timer = window.setInterval(() => {
      const prefs = this.#host.prefs();
      if (!prefs.backupFolder || !this.#host.writing()) return;
      const last = Date.parse(prefs.lastBackupAt);
      if (!Number.isNaN(last) && Date.now() - last < 60 * 60 * 1000) return;
      void this.run(false);
    }, 60_000);
    return () => window.clearInterval(timer);
  }

  async pickFolder() {
    const host = this.#host;
    try {
      const folder = await chooseBackupFolder(t("dialogBackupFolder"));
      if (!folder) return;
      const root = host.libraryRoot();
      if (root && (isInside(folder, root) || isInside(root, folder))) {
        host.say(t("libraryBackupApart"));
        return;
      }
      host.setPrefs({ backupFolder: folder });
    } catch (error) {
      host.say(errorMessage(error));
    }
  }
}

/**
 * The Word copy (SV-9): "<title>.docx" in a folder of her choosing, kept up to date. It is written only when
 * the writing or its look changed, and never over a copy changed in Word or a file Pensieve didn't make.
 */
export class WordCopy {
  /** A copy changed in Word, or a file that isn't Pensieve's, left alone until she says to write it again. */
  held = "";
  #host: CopiesHost;
  // Copies are written one after another: a request is never lost to one for another writing.
  #queue: Promise<void> = Promise.resolve();

  constructor(host: CopiesHost) {
    this.#host = host;
  }

  /** The copy's name: the writing's title, after its project's when they differ, as writings of different projects may share a title. */
  name(book: Pick<Writing, "title">): string {
    const projectTitle = this.#host.shelf()?.title.trim() ?? "";
    return projectTitle && projectTitle !== book.title.trim() ? `${projectTitle} - ${book.title}` : book.title;
  }

  /** Writes the open writing's copy, or `of`'s, a writing just left, as it was then; `force` writes over what is held. */
  update(force = false, of: Writing | null = null): Promise<void> {
    const host = this.#host;
    if (!(of ?? host.writing()) || !host.prefs().wordCopyFolder || host.switching()) return Promise.resolve();
    const folder = host.prefs().wordCopyFolder;
    // A writing just left keeps the name it had then, in the project it was in.
    const leftName = of ? this.name(of) : "";
    const run = this.#queue.then(async () => {
      let path = "";
      try {
        // Stopped, moved to another folder, or another project opening since it was asked for: nothing to write.
        if (host.switching() || host.prefs().wordCopyFolder !== folder) return;
        // A writing just left is written as it was when it closed; the open one after its last words are saved.
        if (!of) await host.flush();
        const book = of ?? host.writing();
        if (!book) return;
        path = inFolder(folder, `${safeName(leftName || this.name(book))}.docx`);
        if (!force && path === this.held) return;
        const prefs = host.prefs();
        const signature = `${backupSignature(book.id, book)}|${JSON.stringify(wordLook(prefs))}`;
        const known = prefs.wordCopies[path];
        if (!force && known?.signature === signature && !prefs.wordCopyError) return;
        const written = await writeFileTo(path, await wordFileFor(book, prefs), force ? "" : (known?.stamp ?? MUST_BE_NEW));
        this.held = "";
        host.setPrefs({
          wordCopies: { ...host.prefs().wordCopies, [path]: { stamp: written.stamp, signature } },
          wordCopyAt: new Date().toISOString(),
          wordCopyError: "",
        });
      } catch (error) {
        const message = errorMessage(error);
        const name = path.split(/[\\/]/).pop() || t("theWordCopy");
        if (message === CHANGED_ELSEWHERE || message === ALREADY_EXISTS) this.held = path;
        const wordCopyError =
          message === CHANGED_ELSEWHERE ? t("wordCopyChanged", { name }) : message === ALREADY_EXISTS ? t("wordCopyForeign", { name }) : message;
        host.setPrefs({ wordCopyError });
      }
    });
    this.#queue = run.catch(() => undefined);
    return run;
  }

  async pickFolder() {
    try {
      const folder = await chooseBackupFolder(t("dialogWordCopyFolder"));
      if (!folder) return;
      this.held = "";
      this.#host.setPrefs({ wordCopyFolder: folder, wordCopyError: "" });
      await this.update();
    } catch (error) {
      this.#host.say(errorMessage(error));
    }
  }
}
