import { APP_NAME } from "$lib/edition";
import { chaptersToHtml, chaptersToMarkdown, chaptersToPlain } from "$lib/export/document";
import { chooseSavePath, writeFileTo, type ExportKind } from "$lib/export/files";
import { wordFileFor } from "$lib/export/wordAssets";
import type { Writing } from "$lib/model";
import type { Prefs } from "$lib/prefs";
import { safeName } from "$lib/save/copies.svelte";
import { errorMessage } from "$lib/save/autosave";
import { t } from "$lib/ui.svelte";

/** What Settings' exports need from the page around them (+page.svelte), IMP-28. */
export type ExportsHost = {
  /** The open writing, as the page has it now. */
  writing: () => Writing | null;
  prefs: () => Prefs;
  /** Saves what she has typed, so an export has it. */
  saveFirst: () => Promise<void>;
  /** Said in Settings, under its rows. */
  say: (message: string) => void;
  /** Said where a failed save is. */
  fail: (message: string) => void;
};

/** The open writing out of Pensieve, from Settings: as a Word file, Markdown or plain text where she chooses, or as clean HTML on the clipboard. */
export class Exports {
  #host: ExportsHost;

  constructor(host: ExportsHost) {
    this.#host = host;
  }

  /** Saves what she typed, asks where to put the file, then writes it there; gives where it went, or "". */
  async #save(kind: ExportKind, contents: (book: Writing) => Promise<Uint8Array>): Promise<string> {
    const host = this.#host;
    if (!host.writing()) return "";
    try {
      await host.saveFirst();
      const book = host.writing();
      if (!book) return "";
      const path = await chooseSavePath(`${safeName(book.title)}.${kind}`, kind);
      if (!path) return "";
      const written = await writeFileTo(path, await contents(book));
      host.say(t("savedTo", { path: written.path }));
      return written.path;
    } catch (error) {
      host.say(errorMessage(error));
      return "";
    }
  }

  word(): Promise<string> {
    return this.#save("docx", (book) => wordFileFor(book, this.#host.prefs()));
  }

  text(kind: "markdown" | "plain"): Promise<string> {
    return this.#save(kind === "markdown" ? "md" : "txt", async (book) => {
      const title = book.title || APP_NAME;
      return new TextEncoder().encode(kind === "markdown" ? chaptersToMarkdown(title, book.chapters) : chaptersToPlain(title, book.chapters));
    });
  }

  /** The writing as clean HTML on the clipboard, for a blog (SV-11). */
  async copyHtml(): Promise<void> {
    const host = this.#host;
    if (!host.writing()) return;
    try {
      await host.saveFirst();
      const book = host.writing();
      if (!book) return;
      await navigator.clipboard.writeText(chaptersToHtml(book.title || APP_NAME, book.chapters));
      host.say(t("copiedHtml"));
    } catch (error) {
      host.fail(errorMessage(error));
    }
  }
}
