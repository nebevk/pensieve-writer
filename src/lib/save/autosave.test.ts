import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosave, type SaveStatus } from "./autosave";

/** An autosave whose saves are counted; `failing` makes them fail. */
function counted(options: { maxWaitMs?: number; mayInterrupt?: () => boolean } = {}) {
  const state = { saves: 0, failing: false, statuses: [] as SaveStatus["state"][] };
  const autosave = createAutosave({
    delayMs: 2000,
    ...options,
    save: async () => {
      state.saves += 1;
      if (state.failing) throw new Error("The disk is full");
    },
    onStatus: (status) => state.statuses.push(status.state),
  });
  return { autosave, state };
}

/** Keys every `every` ms for `forMs`, as steady typing. */
async function type(autosave: { schedule: () => void }, forMs: number, every = 300) {
  for (let at = 0; at < forMs; at += every) {
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(every);
  }
}

describe("Autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves once at a pause, not at each key", async () => {
    const { autosave, state } = counted({ maxWaitMs: 10000 });
    await type(autosave, 1500);
    expect(state.saves).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(state.saves).toBe(1);
    expect(state.statuses.at(-1)).toBe("saved");
  });

  it("saves at least every 10 seconds while she types on without a pause", async () => {
    const { autosave, state } = counted({ maxWaitMs: 10000 });
    await type(autosave, 31000);
    expect(state.saves).toBe(3);
    // Without the longest wait, steady typing never saves.
    const old = counted();
    await type(old.autosave, 31000);
    expect(old.state.saves).toBe(0);
  });

  it("waits for the pause while a save mustn't come mid-typing", async () => {
    let naming = true;
    const { autosave, state } = counted({ maxWaitMs: 10000, mayInterrupt: () => !naming });
    await type(autosave, 15000);
    expect(state.saves).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(state.saves).toBe(1);
    naming = false;
    await type(autosave, 11000);
    expect(state.saves).toBe(2);
  });

  it("tries a failed save again, and typing on puts that off no longer than the longest wait", async () => {
    const { autosave, state } = counted({ maxWaitMs: 10000 });
    state.failing = true;
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(2000);
    expect(state.saves).toBe(1);
    expect(state.statuses.at(-1)).toBe("error");
    await type(autosave, 10500);
    expect(state.saves).toBe(2);
    state.failing = false;
    await vi.advanceTimersByTimeAsync(12000);
    expect(state.statuses.at(-1)).toBe("saved");
  });

  it("flush saves at once, and a change during a save brings exactly one more", async () => {
    const { autosave, state } = counted({ maxWaitMs: 10000 });
    autosave.schedule();
    const first = autosave.flush();
    autosave.schedule();
    await first;
    await autosave.flush();
    expect(state.saves).toBe(2);
    await vi.advanceTimersByTimeAsync(20000);
    expect(state.saves).toBe(2);
  });
});
