type SaveQueueOptions<T> = {
  delayMs: number;
  /** Items with the same key replace each other; different keys are all saved. */
  key: (item: T) => string;
  save: (item: T) => Promise<void>;
  onError?: (error: unknown) => void;
};

export type SaveQueue<T> = {
  schedule: (item: T) => void;
  flush: () => Promise<void>;
};

/**
 * Saves edits a short while after typing stops. It keeps one pending copy per key,
 * so switching from one note to another never drops the first note's last edit.
 */
export function createSaveQueue<T>(options: SaveQueueOptions<T>): SaveQueue<T> {
  const pending = new Map<string, T>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> = Promise.resolve();

  function schedule(item: T) {
    pending.set(options.key(item), item);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, options.delayMs);
  }

  async function drain(): Promise<void> {
    const items = [...pending.entries()];
    pending.clear();
    let failure: { error: unknown } | null = null;
    for (const [key, item] of items) {
      try {
        await options.save(item);
      } catch (error) {
        // Keep the edit for the next attempt, unless a newer one arrived meanwhile.
        if (!pending.has(key)) pending.set(key, item);
        failure ??= { error };
      }
    }
    if (failure) {
      options.onError?.(failure.error);
      throw failure.error;
    }
  }

  /** Saves everything pending, after any save that is already running. */
  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const run = running.then(drain, drain);
    running = run.catch(() => undefined);
    return run;
  }

  return { schedule, flush };
}
