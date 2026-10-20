import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWriting } from "$lib/model";
import { defaultPrefs, type Prefs } from "$lib/prefs";
import type { OpenedProject } from "$lib/storage/sqlite";
import type { SampleProject } from "./sampleProjects";

const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const HOME = `${LIBRARY}\\Moj roman\\pensieve.db`;

// The files on the pretend disk, the file open now, and what was written into which.
let files = new Set<string>();
let openFile = HOME;
const writes: string[] = [];
let writeFails = false;
vi.mock("@tauri-apps/api/core", () => ({ invoke: async (_command: string, args: { path: string }) => files.has(args.path) }));
vi.mock("$lib/storage/sqlite", () => ({
  openShelf: async (writingId: string) =>
    ({ shelf: { projectId: `id of ${openFile}` }, writing: { id: writingId || `first of ${openFile}` } }) as unknown as OpenedProject,
  writeSampleProject: async (sample: { path: string; title: string; placeholder: string }) => {
    if (writeFails) throw new Error("database or disk is full");
    writes.push(`${sample.title} into ${sample.path}${sample.placeholder ? `, without ${sample.placeholder}` : ""}`);
  },
}));

const { SampleProjects } = await import("./sampleProjects");

const sample = (slug: string, title: string, folder = "Primeri"): SampleProject => ({
  slug,
  folder,
  title,
  build: (projectId) => ({ writings: [{ writing: createWriting(`${title} (${projectId})`, "Prvo"), folder: "" }], notes: [], tasks: [] }),
});

describe("the samples, written into the library (IMP-28)", () => {
  let prefs: Prefs;
  let events: string[];
  let samples: InstanceType<typeof SampleProjects>;

  beforeEach(() => {
    files = new Set([HOME]);
    openFile = HOME;
    writes.length = 0;
    writeFails = false;
    prefs = { ...defaultPrefs(), knownProjects: [{ path: HOME, title: "Moj roman" }] };
    events = [];
    // The session: visits each sample's file in turn, then the open project's again.
    const session = {
      path: HOME,
      async elsewhere(work: (visit: (path: string) => Promise<void>) => Promise<void>, back: () => Promise<unknown>) {
        let failure: unknown = null;
        try {
          await work(async (path) => {
            openFile = path;
            files.add(path);
          });
        } catch (error) {
          failure = error;
        }
        openFile = HOME;
        await back();
        if (failure) throw failure;
      },
    };
    samples = new SampleProjects({
      writingOpen: () => true,
      writingId: () => "moje pisanje",
      libraryRoot: () => LIBRARY,
      prefs: () => prefs,
      remember: (patch) => (prefs = { ...prefs, ...patch }),
      session: session as unknown as import("$lib/session.svelte").Session,
      withEditorClosed: (work) => work(),
      updateWordCopy: async () => void events.push("word copy"),
      rememberProject: () => events.push("remember"),
      makeProjectFolder: async (parent, name) => `${parent}\\${name}\\pensieve.db`,
      reopened: (opened, show) => events.push(`reopened ${opened.writing.id}${show ? ", shown" : ""}`),
      refreshLibrary: async () => void events.push("refresh"),
      say: (message) => events.push(`say: ${message}`),
    });
  });

  it("writes each into a folder of its own, made just now, lists them, and keeps her project open", async () => {
    await samples.write([sample("svetilnik", "Svetilnik"), sample("reka", "Zgodbe ob reki")], "Dodano.");
    expect(writes).toEqual([
      `Svetilnik into ${LIBRARY}\\Primeri\\Svetilnik\\pensieve.db, without first of ${LIBRARY}\\Primeri\\Svetilnik\\pensieve.db`,
      `Zgodbe ob reki into ${LIBRARY}\\Primeri\\Zgodbe ob reki\\pensieve.db, without first of ${LIBRARY}\\Primeri\\Zgodbe ob reki\\pensieve.db`,
    ]);
    expect(prefs.samples).toEqual({ svetilnik: `${LIBRARY}\\Primeri\\Svetilnik\\pensieve.db`, reka: `${LIBRARY}\\Primeri\\Zgodbe ob reki\\pensieve.db` });
    expect(prefs.knownProjects.map((item) => item.title)).toEqual(["Svetilnik", "Zgodbe ob reki", "Moj roman"]);
    expect(prefs.knownProjects[0].summary?.writings).toHaveLength(1);
    expect(events).toEqual(["word copy", "remember", "reopened moje pisanje", "refresh", "say: Dodano."]);
  });

  it("one written before is put back in its own file, wherever it was moved, its file kept", async () => {
    const moved = `${LIBRARY}\\Stari primeri\\Svetilnik\\pensieve.db`;
    files.add(moved);
    prefs = { ...prefs, samples: { svetilnik: moved } };
    await samples.write([sample("svetilnik", "Svetilnik")], "Dodano.");
    expect(writes).toEqual([`Svetilnik into ${moved}`]);
  });

  it("her open project, when it was one of them, opens on what is there now", async () => {
    prefs = { ...prefs, samples: { svetilnik: HOME } };
    await samples.write([sample("svetilnik", "Svetilnik")], "Dodano.");
    expect(events).toContain(`reopened first of ${HOME}, shown`);
  });

  it("one that can't be written is said, and her project is open again all the same", async () => {
    writeFails = true;
    await samples.write([sample("svetilnik", "Svetilnik")], "Dodano.");
    expect(events).toEqual(["word copy", "remember", "reopened moje pisanje", "say: The disk is full. Make some room on it, and saving starts again."]);
    expect(prefs.samples).toEqual({});
  });
});
