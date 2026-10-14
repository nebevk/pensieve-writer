import { errorMessage } from "$lib/save/autosave";
import { documentName, type DocumentSource } from "./importWriting";
import type { WordImport } from "./wordImport";

/**
 * Documents being read for a window that brings them in (New project, New writing from Word, Bring back
 * from Word): read one after another as soon as they are chosen, so the window can say what they hold
 * before anything is made. Those that can't be read are kept with why.
 */
export class DocumentsRead {
  sources = $state.raw<DocumentSource[]>([]);
  read = $state.raw<{ name: string; result: WordImport }[]>([]);
  failed = $state.raw<{ name: string; message: string }[]>([]);
  progress = $state<{ done: number; total: number } | null>(null);
  // Documents chosen again while others are read: only the last choice counts.
  #turn = 0;

  get reading(): boolean {
    return this.progress !== null;
  }

  async start(sources: DocumentSource[]) {
    const turn = ++this.#turn;
    this.sources = sources;
    this.read = [];
    this.failed = [];
    const read: { name: string; result: WordImport }[] = [];
    const failed: { name: string; message: string }[] = [];
    for (const [index, source] of sources.entries()) {
      this.progress = { done: index + 1, total: sources.length };
      try {
        const result = await source.read();
        if (turn !== this.#turn) return;
        read.push({ name: documentName(source.name), result });
      } catch (error) {
        if (turn !== this.#turn) return;
        failed.push({ name: source.name, message: errorMessage(error) });
      }
    }
    this.read = read;
    this.failed = failed;
    this.progress = null;
  }
}
