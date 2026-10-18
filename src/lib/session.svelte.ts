import { projectName, rebasePath } from "$lib/chapters/library";
import { openShelf, switchProjectFile, type OpenedProject } from "$lib/storage/sqlite";
import { t } from "$lib/ui.svelte";

/** What the open project needs from the page around it (+page.svelte). */
export type SessionHost = {
  /** Remembers the project that opens at the next start (the settings). */
  remember: (path: string) => void;
  /** The writing open now, which a project opened again after a failed switch opens on. */
  writingId: () => string;
};

/**
 * The open project (ARCH-12): the one file storage has open and the page shows, and every way of opening
 * another. A switch lets storage go of the open file only after every save queued for it, reads the next,
 * and makes that the open project, remembered for the next start, only once it has opened. When it won't
 * open, the project before opens again, its notes and to-dos saving again too, and the error goes on.
 * While storage has another file open, `switching` holds saves back: they wait, and go into the open
 * project's file.
 */
export class Session {
  /** The open project's file; empty until one has opened. */
  path = $state("");
  /** Storage has another file open than the open project's: saves wait. */
  switching = false;
  #host: SessionHost;

  constructor(host: SessionHost) {
    this.#host = host;
  }

  /** The first project of a start: there is none to go back to. */
  async start(path: string, open: () => Promise<OpenedProject>): Promise<OpenedProject> {
    await switchProjectFile(path);
    const opened = await open();
    this.#opened(path);
    return opened;
  }

  /** Another project, from the library or Home; `open` reads it once storage has its file. */
  switchTo(path: string, open: () => Promise<OpenedProject>): Promise<OpenedProject> {
    return this.#go(async () => path, open);
  }

  /**
   * The open project in a new place (moved into the library, ARCH-6): `copy` makes a whole copy of its file
   * there, inside the save queue, and returns where; it then opens there. A copy that won't open is
   * `discard`ed once storage has let go of it, and the project stays where it was.
   */
  moveTo(copy: () => Promise<string>, open: (path: string) => Promise<OpenedProject>, discard: () => Promise<unknown>): Promise<OpenedProject> {
    return this.#go(copy, open, discard);
  }

  /**
   * Other projects' files, each opened in turn by `work` with `visit` (the samples being written). Whatever
   * happens, the open project's file is open again after, and `back` reads it (its shelf at least, so storage
   * knows its notes and to-dos again); then the error, if there was one, goes on.
   */
  async elsewhere<T>(work: (visit: (path: string) => Promise<void>) => Promise<void>, back: () => Promise<T>): Promise<T> {
    const home = this.#open();
    let failure: { error: unknown } | null = null;
    this.switching = true;
    try {
      await work((path) => switchProjectFile(path));
    } catch (error) {
      failure = { error };
    }
    try {
      await switchProjectFile(home);
    } finally {
      this.switching = false;
    }
    const result = await back();
    if (failure) throw failure.error;
    return result;
  }

  /** A folder moved or renamed with the open project in it (storage moved its file with it): it is where it went. */
  followMove(from: string, to: string) {
    if (this.path) this.path = rebasePath(this.path, from, to);
  }

  async #go(next: () => Promise<string>, open: (path: string) => Promise<OpenedProject>, discard?: () => Promise<unknown>): Promise<OpenedProject> {
    const previous = this.path;
    let reached = "";
    this.switching = true;
    try {
      reached = await next();
      await switchProjectFile(reached);
      const opened = await open(reached);
      this.#opened(reached);
      return opened;
    } catch (error) {
      // Once storage was sent to the next file: back to the project that was open, or the next save would go
      // into the other file; then a copy that won't open goes, now that nothing holds it. A copy that failed
      // to be made never took storage anywhere.
      if (reached && previous) await this.#reopen(previous).catch(() => undefined);
      if (reached && discard) await discard().catch(() => undefined);
      throw error;
    } finally {
      this.switching = false;
    }
  }

  /** The open project's file opened again, and its shelf read, so its notes and to-dos are saved as its own. */
  async #reopen(path: string) {
    await switchProjectFile(path);
    await openShelf(this.#host.writingId(), { title: projectName(path), writingTitle: t("untitled"), welcome: false });
  }

  #open(): string {
    if (!this.path) throw new Error(t("errNoProject"));
    return this.path;
  }

  #opened(path: string) {
    this.path = path;
    this.#host.remember(path);
  }
}
