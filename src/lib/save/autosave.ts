import { localizeError } from "$lib/i18n";
import { t, ui } from "$lib/ui.svelte";

export type SaveStatus =
  | { state: "saved" }
  | { state: "unsaved" }
  | { state: "saving" }
  | { state: "error"; message: string };

type AutosaveOptions = {
  /** How long a pause in typing is before it saves. */
  delayMs: number;
  /** The longest a change waits while she types on without a pause: saved by then (ARCH-3). */
  maxWaitMs?: number;
  /** Whether a save may come now, mid-typing; asked only when the longest wait is up. */
  mayInterrupt?: () => boolean;
  save: () => Promise<void>;
  onStatus: (status: SaveStatus) => void;
};

export type Autosave = {
  schedule: () => void;
  flush: () => Promise<void>;
};

export function createAutosave(options: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  let inFlight: Promise<void> | null = null;
  // When the oldest change no save has taken yet came: the longest wait counts from it.
  let since = 0;

  const saveNow = () => {
    timer = null;
    void flush().catch(() => undefined);
  };

  /** The save at the pause, or at the longest wait if that comes first. */
  function arm() {
    if (timer) clearTimeout(timer);
    const left = options.maxWaitMs === undefined ? Infinity : since + options.maxWaitMs - Date.now();
    timer = left <= options.delayMs ? setTimeout(longestWait, Math.max(0, left)) : setTimeout(saveNow, options.delayMs);
  }

  function longestWait() {
    timer = null;
    // Not now (she is naming a new chapter, say): the pause saves it, as before.
    if (options.mayInterrupt && !options.mayInterrupt()) timer = setTimeout(saveNow, options.delayMs);
    else saveNow();
  }

  function schedule() {
    if (!dirty) since = Date.now();
    dirty = true;
    options.onStatus({ state: "unsaved" });
    arm();
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (inFlight) {
      try {
        await inFlight;
      } catch {
        // The in-flight save already reported its error.
      }
      if (dirty) return flush();
      return;
    }
    if (!dirty) return;

    dirty = false;
    options.onStatus({ state: "saving" });
    const run = (async () => {
      try {
        await options.save();
        if (!dirty) options.onStatus({ state: "saved" });
      } catch (error) {
        dirty = true;
        // Tried again in a moment; typing on puts that off no longer than the longest wait.
        since = Date.now();
        options.onStatus({ state: "error", message: errorMessage(error) });
        arm();
        throw error;
      }
    })();
    inFlight = run;
    try {
      await run;
    } finally {
      if (inFlight === run) inFlight = null;
    }
  }

  return { schedule, flush };
}

/** A problem as the writer should read it, in the interface language where Pensieve knows it. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return localizeError(ui.language, error.message);
  if (typeof error === "string" && error) return localizeError(ui.language, error);
  try {
    return JSON.stringify(error);
  } catch {
    return t("couldNotSave");
  }
}
