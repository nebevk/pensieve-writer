import { beforeEach, describe, expect, it, vi } from "vitest";

const load = vi.fn();
const invoke = vi.fn();
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: (url: string) => load(url) } }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (command: string, args?: unknown) => invoke(command, args) }));

/** A file that opens, then can't be read: enough to tell that Pensieve tried to open it. */
const unreadable = () => ({ path: "x", select: vi.fn().mockRejectedValue(new Error("disk I/O error")), close: vi.fn().mockResolvedValue(true) });
const existsAsked = () => invoke.mock.calls.filter(([command]) => command === "project_file_exists").length;

describe("the project's file, opened again after it failed (ARCH-1)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    load.mockReset();
    invoke.mockReset();
  });

  it("is tried again at the next save, and only while it is there: never made anew, empty", async () => {
    const { checkpointDatabase, switchProjectFile } = await import("./sqlite");
    const file = "C:\\Users\\Eva\\Documents\\Pensieve\\Zgodbe ob reki\\pensieve.db";
    load.mockRejectedValueOnce(new Error("unable to open database file"));
    await expect(switchProjectFile(file, false)).rejects.toThrow("unable to open database file");
    expect(load).toHaveBeenCalledTimes(1);

    // Its folder renamed away: not opened, so the SQL plugin can't make an empty file where it was.
    invoke.mockResolvedValue(false);
    await expect(checkpointDatabase()).rejects.toThrow("can't reach this project's file");
    expect(load).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("project_file_exists", { path: file });

    // Put back: opened again.
    invoke.mockResolvedValue(true);
    load.mockResolvedValue(unreadable());
    await expect(checkpointDatabase()).rejects.toThrow("disk I/O error");
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(`sqlite:${file}`);
  });

  it("a project opened on purpose may make its file: a new project's is made so", async () => {
    const { switchProjectFile } = await import("./sqlite");
    load.mockRejectedValueOnce(new Error("unable to open database file"));
    await expect(switchProjectFile("C:\\a\\pensieve.db", false)).rejects.toThrow();
    load.mockResolvedValue(unreadable());
    await expect(switchProjectFile("C:\\Nov projekt\\pensieve.db", false)).rejects.toThrow("disk I/O error");
    expect(load).toHaveBeenLastCalledWith("sqlite:C:\\Nov projekt\\pensieve.db");
    expect(existsAsked()).toBe(0);
  });
});
