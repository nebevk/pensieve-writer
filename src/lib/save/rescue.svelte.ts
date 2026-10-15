import { readBackupFile } from "$lib/storage/backup";
import { backupFile, type BackupContent, type BackupWriting } from "$lib/storage/backupFile";
import { unsavedNotesAndTasks } from "$lib/storage/organize";
import { listKeptCopies, removeKeptCopy, rescueName, writeKeptCopy } from "./kept";

/** What the rescue copy needs from the page around it (+page.svelte). */
export type RescueHost = {
  /** The open project, or null while none is. */
  project: () => { id: string; title: string; folders: string[] } | null;
  /** The open writing as it is on the page, with its place in the project. */
  writing: () => BackupWriting | null;
  /** Whether the open writing has words not saved yet. */
  unsaved: () => boolean;
};

/** A rescue copy from an earlier time, offered back when its project opens. */
export type RescueOffer = { backup: BackupContent; name: string };

/** How often the copy is written again while saving keeps failing. */
const AGAIN_MS = 60_000;

/**
 * The rescue copy (ARCH-1). When a save to the project fails, the open writing as it is on the page, with the
 * notes and to-dos not saved yet, goes into a backup file in Pensieve's own folder at once, and again each
 * minute while saving keeps failing, so a forced quit or a flat battery can't take her words. A save that
 * works takes the copy away again, as the project then has it all. A copy left from an earlier time is
 * offered back when its project opens, once each time Pensieve starts.
 */
export class Rescue {
  offer = $state<RescueOffer | null>(null);
  #host: RescueHost;
  // Projects whose copy this time wrote: only these are taken away by a save that works.
  #written = new Set<string>();
  // Projects whose copy was offered this time, brought back or put off.
  #asked = new Set<string>();
  #lastTry = -Infinity;
  // Copies are written and removed one after another, never two at once.
  #queue: Promise<unknown> = Promise.resolve();

  constructor(host: RescueHost) {
    this.#host = host;
  }

  /** A save failed: a copy now, unless one was tried in the last minute. */
  failed(): void {
    if (Date.now() - this.#lastTry < AGAIN_MS) return;
    void this.keep();
  }

  /** Writes the copy now, from what is on the page; true once it is on the disk. */
  keep(): Promise<boolean> {
    const run = this.#queue.then(() => this.#write());
    this.#queue = run.catch(() => undefined);
    return run;
  }

  async #write(): Promise<boolean> {
    const project = this.#host.project();
    const writing = this.#host.writing();
    if (!project || !writing) return false;
    this.#lastTry = Date.now();
    try {
      const unsaved = unsavedNotesAndTasks();
      const notes = unsaved.notes.filter((note) => note.projectId === project.id);
      const tasks = unsaved.tasks.filter((task) => task.projectId === project.id);
      const file = { ...backupFile(project, [writing], notes, tasks, new Date().toISOString()), rescue: true };
      await writeKeptCopy("rescue", rescueName(project.id), JSON.stringify(file));
      this.#written.add(project.id);
      return true;
    } catch {
      return false;
    }
  }

  /** A save worked: a copy this time wrote goes, once neither the page nor any note or to-do waits to be saved. */
  saved(): void {
    const project = this.#host.project();
    if (!project || !this.#written.has(project.id) || this.#host.unsaved()) return;
    const unsaved = unsavedNotesAndTasks();
    if (unsaved.notes.length > 0 || unsaved.tasks.length > 0) return;
    this.#written.delete(project.id);
    this.#lastTry = -Infinity;
    const run = this.#queue.then(() => removeKeptCopy("rescue", rescueName(project.id)));
    this.#queue = run.catch(() => undefined);
  }

  /** A project opened: its rescue copy from an earlier time, if there is one, is offered back. */
  async check(projectId: string): Promise<void> {
    if (!projectId || this.#asked.has(projectId) || this.#written.has(projectId)) return;
    this.#asked.add(projectId);
    try {
      const name = rescueName(projectId);
      const copy = (await listKeptCopies("rescue")).find((item) => item.name === name);
      if (!copy) return;
      const backup = await readBackupFile(copy.path);
      if (backup.projectId === projectId && this.#host.project()?.id === projectId) this.offer = { backup, name };
    } catch {
      // A copy that can't be read stays where it is, for Settings' Bring one back.
    }
  }

  /** Brought back: the copy goes. */
  async done(offer: RescueOffer): Promise<void> {
    if (this.offer === offer) this.offer = null;
    const run = this.#queue.then(() => removeKeptCopy("rescue", offer.name));
    this.#queue = run.catch(() => undefined);
    await run.catch(() => undefined);
  }

  /** Not now: offered again the next time Pensieve starts. */
  later(): void {
    this.offer = null;
  }
}
