import { readBackupFile } from "$lib/storage/backup";
import { backupFile, type BackupContent, type BackupWriting } from "$lib/storage/backupFile";
import { unsavedNotesAndTasks } from "$lib/storage/organize";
import { t } from "$lib/ui.svelte";
import { listKeptCopies, removeKeptCopy, rescueName, rescueTail, writeKeptCopy, type KeptCopy } from "./kept";

/** What the rescue copy needs from the page around it (+page.svelte). */
export type RescueHost = {
  /** The open project, or null while none is. */
  project: () => { id: string; title: string; folders: string[] } | null;
  /** The open writing with the page's words as they are now, and its place in the project. */
  writing: () => BackupWriting | null;
  /** Whether the open writing has words not saved yet. */
  unsaved: () => boolean;
  /** When the project last saved a writing, from its file; "" for one it doesn't have. */
  savedAt: (writingId: string) => string;
};

/**
 * A rescue copy from an earlier time, offered back when its project opens. `beside`: the project has saved that
 * writing since the copy was made, so the copy comes back beside it, as a writing of its own, never over it.
 */
export type RescueOffer = { backup: BackupContent; name: string; beside: boolean };

/** How often the copy is written again while saving keeps failing: as often as autosave's longest wait. */
const AGAIN_MS = 10_000;

/**
 * The rescue copy (ARCH-1). When a save to the project fails, the open writing as it is on the page, with the
 * notes and to-dos not saved yet, goes into a backup file in Pensieve's own folder at once, and again every
 * ten seconds while saving keeps failing and the words change, so a forced quit or a flat battery can't take
 * them. A save that works takes the copy away again, as the project then has it all.
 *
 * Each time Pensieve starts, it writes copies of its own, under names of their own: a copy left from an
 * earlier time is never written over or taken away, only offered back when its project opens, oldest first.
 */
export class Rescue {
  offer = $state<RescueOffer | null>(null);
  #host: RescueHost;
  readonly #started = new Date();
  // This time's copy of each project, named when first written: the only ones written over or taken away.
  #mine = new Map<string, string>();
  // What each of them holds now, so one that hasn't changed isn't written again.
  #held = new Map<string, string>();
  // Saves that worked so far: a copy asked for before one of them isn't written, as the project has it all.
  #saves = 0;
  // Projects whose earlier copies were offered this time, and those of the open one still to offer.
  #asked = new Set<string>();
  #waiting: KeptCopy[] = [];
  #lastTry = -Infinity;
  // Copies are written and removed one after another, never two at once.
  #queue: Promise<unknown> = Promise.resolve();

  constructor(host: RescueHost) {
    this.#host = host;
  }

  #run<T>(work: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(work);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  /** A save failed: a copy now, unless one was tried in the last ten seconds. */
  failed(): void {
    if (Date.now() - this.#lastTry < AGAIN_MS) return;
    void this.keep();
  }

  /** Writes the copy now, from what is on the page; true once her words are on the disk, there or in the project. */
  keep(): Promise<boolean> {
    const asked = this.#saves;
    return this.#run(() => this.#write(asked));
  }

  async #write(asked: number): Promise<boolean> {
    // A save worked since this copy was asked for: the project has it all.
    if (asked !== this.#saves) return true;
    const project = this.#host.project();
    const writing = this.#host.writing();
    if (!project || !writing) return false;
    this.#lastTry = Date.now();
    const name = this.#mine.get(project.id) ?? rescueName(project.id, writing.title, this.#started);
    this.#mine.set(project.id, name);
    try {
      const unsaved = unsavedNotesAndTasks();
      const notes = unsaved.notes.filter((note) => note.projectId === project.id);
      const tasks = unsaved.tasks.filter((task) => task.projectId === project.id);
      // Without its time first, to tell whether anything changed since the last copy.
      const words = JSON.stringify({ ...backupFile(project, [writing], notes, tasks, ""), rescue: true });
      if (this.#held.get(name) === words) return true;
      await writeKeptCopy("rescue", name, words.replace('"savedAt":""', `"savedAt":"${new Date().toISOString()}"`));
      this.#held.set(name, words);
      return true;
    } catch {
      return false;
    }
  }

  /** A save worked: this time's copy goes, once neither the page nor any note or to-do waits to be saved. */
  saved(): void {
    const project = this.#host.project();
    if (!project || this.#host.unsaved()) return;
    const unsaved = unsavedNotesAndTasks();
    if (unsaved.notes.length > 0 || unsaved.tasks.length > 0) return;
    this.#saves += 1;
    this.#lastTry = -Infinity;
    const id = project.id;
    // After any copy being written now; one that can't be removed is tried again at the next save that works.
    void this.#run(async () => {
      const name = this.#mine.get(id);
      if (!name) return;
      await removeKeptCopy("rescue", name);
      this.#mine.delete(id);
      this.#held.delete(name);
    }).catch(() => undefined);
  }

  /** A project opened: its rescue copies from earlier times, if there are any, are offered back, oldest first. */
  async check(projectId: string): Promise<void> {
    if (!projectId || this.#asked.has(projectId)) return;
    this.#asked.add(projectId);
    try {
      const tail = rescueTail(projectId);
      const mine = this.#mine.get(projectId);
      this.#waiting = (await listKeptCopies("rescue")).filter((copy) => copy.name.endsWith(tail) && copy.name !== mine).sort((a, b) => a.modified - b.modified);
      await this.#offerNext(projectId);
    } catch {
      // The copies stay where they are; Settings' Bring one back reaches them too.
    }
  }

  async #offerNext(projectId: string): Promise<void> {
    while (this.#waiting.length > 0) {
      const copy = this.#waiting[0];
      try {
        const backup = await readBackupFile(copy.path);
        if (backup.projectId === projectId && this.#host.project()?.id === projectId) {
          const saved = backup.writings[0] ? this.#host.savedAt(backup.writings[0].id) : "";
          this.offer = { backup, name: copy.name, beside: saved > backup.savedAt };
          return;
        }
      } catch {
        // One that can't be read is left where it is.
      }
      this.#waiting.shift();
    }
    this.offer = null;
  }

  /** Brought back: the copy goes, and the next one, if any, is offered. */
  async done(offer: RescueOffer): Promise<void> {
    if (this.offer === offer) this.offer = null;
    await this.#run(() => removeKeptCopy("rescue", offer.name)).catch(() => undefined);
    this.#waiting = this.#waiting.filter((copy) => copy.name !== offer.name);
    await this.#offerNext(offer.backup.projectId);
  }

  /** Not now: offered again the next time Pensieve starts. */
  later(): void {
    this.offer = null;
    this.#waiting = [];
  }
}

/** A rescue copy brought back beside its writing, which has changed since: as a writing of its own, named so. */
export function besideItsWriting(backup: BackupContent): BackupContent {
  return {
    ...backup,
    writings: backup.writings.map((writing) => ({ ...writing, id: crypto.randomUUID(), title: t("rescuedTitle", { title: writing.title || t("untitled") }) })),
  };
}
