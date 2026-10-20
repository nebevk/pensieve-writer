type SaveQueueOptions<T> = {
  delayMs: number;
  /** Items with the same key replace each other; different keys are all saved. */
  key: (item: T) => string;
  save: (item: T) => Promise<void>;
  onError?: (error: unknown) => void;
  /** After a save that failed, how long until it is tried again by itself; without it, it waits for the next change or flush. */
  retryMs?: number;
  /** After a round of saves that all worked. */
  onSaved?: () => void;
};

export type SaveQueue<T> = {
  schedule: (item: T) => void;
  flush: () => Promise<void>;
  /** What isn't saved yet: waiting, or being written now. */
  waiting: () => T[];
};

/**
 * Saves edits a short while after typing stops. It keeps one pending copy per key,
 * so switching from one note to another never drops the first note's last edit.
 */
export function createSaveQueue<T>(options: SaveQueueOptions<T>): SaveQueue<T> {
  const pending = new Map<string, T>();
  // Being written now: off `pending` until each is saved, so what waiting() gives meanwhile still has them.
  const writing = new Map<string, T>();
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
    for (const [key, item] of items) writing.set(key, item);
    let failure: { error: unknown } | null = null;
    for (const [key, item] of items) {
      try {
        await options.save(item);
      } catch (error) {
        // Keep the edit for the next attempt, unless a newer one arrived meanwhile.
        if (!pending.has(key)) pending.set(key, item);
        failure ??= { error };
      } finally {
        writing.delete(key);
      }
    }
    if (failure) {
      options.onError?.(failure.error);
      // Tried again in a moment, so what waits is saved once the file is back, without another change to it.
      if (options.retryMs !== undefined && !timer) {
        timer = setTimeout(() => {
          timer = null;
          void flush().catch(() => undefined);
        }, options.retryMs);
      }
      throw failure.error;
    }
    if (items.length > 0) options.onSaved?.();
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

  function waiting(): T[] {
    // A newer change waiting takes the place of the one being written.
    return [...new Map([...writing, ...pending]).values()];
  }

  return { schedule, flush, waiting };
}
