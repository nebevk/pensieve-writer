import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import type { UpdateOffer } from "$lib/editor/UpdatePill.svelte";
import { flushPrefs } from "$lib/prefs";
import { errorMessage } from "$lib/save/autosave";

/**
 * A newer Pensieve on GitHub Releases (ST-7): looked for quietly, offered in the window bar, installed with a
 * click; and what Settings' own check last found.
 */
export class Updates {
  found = $state.raw<Update | null>(null);
  /** How far the download has got (0 to 100), or null when none is under way. */
  progress = $state<number | null>(null);
  failed = $state("");
  /** Settings' check: under way, found nothing, or failed. */
  checking = $state<"" | "checking" | "none" | "failed">("");
  checkMessage = $state("");
  appVersion = $state("");
  /** What the window bar shows. */
  offer = $derived<UpdateOffer | null>(this.found ? { version: this.found.version, progress: this.progress, failed: this.failed } : null);
  #closeEditor: (work: () => Promise<void>) => Promise<void>;

  /** `closeEditor` runs work with the page closed and everything saved, as an install needs. */
  constructor(closeEditor: (work: () => Promise<void>) => Promise<void>) {
    this.#closeEditor = closeEditor;
  }

  /**
   * Looks a while after the start, then every six hours; not while developing, where there is no installed
   * Pensieve to replace. Gives the version running, and how to stop looking.
   */
  start(): () => void {
    let first = 0;
    let every = 0;
    if (!import.meta.env.DEV) {
      first = window.setTimeout(() => void this.check(), 20_000);
      every = window.setInterval(() => void this.check(), 6 * 60 * 60 * 1000);
    }
    void getVersion()
      .then((version) => (this.appVersion = version ?? ""))
      .catch(() => undefined);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }

  /** Asks GitHub Releases whether a newer Pensieve is out: quietly, unless she asked in Settings. */
  async check(asked = false) {
    if (asked) this.checking = "checking";
    try {
      const found = await check();
      if (found) {
        this.found = found;
        this.failed = "";
      }
      if (asked) this.checking = found ? "" : "none";
    } catch (error) {
      if (!asked) return;
      this.checking = "failed";
      this.checkMessage = errorMessage(error);
    }
  }

  /**
   * Saves everything, then downloads the update and runs its installer. On Windows Pensieve closes for that
   * at once, without its own closing steps (hence everything saved first, with the page closed), and the
   * installer opens it again, updated. Her projects and settings stay where they are.
   */
  async install() {
    const next = this.found;
    if (!next || this.progress !== null) return;
    this.failed = "";
    this.progress = 0;
    try {
      await this.#closeEditor(async () => {
        await flushPrefs();
        let total = 0;
        let received = 0;
        await next.downloadAndInstall((event) => {
          if (event.event === "Started") total = event.data.contentLength ?? 0;
          else if (event.event === "Progress") {
            received += event.data.chunkLength;
            this.progress = total ? Math.min(99, Math.round((received / total) * 100)) : 0;
          } else this.progress = 100;
        });
      });
    } catch (error) {
      this.failed = errorMessage(error);
      this.progress = null;
    }
  }
}
