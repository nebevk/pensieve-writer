export type SaveStatus =
  | { state: "saved" }
  | { state: "unsaved" }
  | { state: "saving" }
  | { state: "error"; message: string };

type AutosaveOptions = {
  delayMs: number;
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

  function schedule() {
    dirty = true;
    options.onStatus({ state: "unsaved" });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, options.delayMs);
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
        options.onStatus({ state: "error", message: errorMessage(error) });
        timer = setTimeout(() => {
          void flush().catch(() => undefined);
        }, options.delayMs);
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

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Could not save";
  }
}
