import { invoke } from "@tauri-apps/api/core";
import { joinPath, projectName } from "$lib/chapters/library";
import { summarize, summarizeProject } from "$lib/chapters/progress";
import { chapterTitle } from "$lib/chapters/welcome";
import type { Writing } from "$lib/model";
import type { KnownProject, Prefs } from "$lib/prefs";
import { errorMessage } from "$lib/save/autosave";
import type { Session } from "$lib/session.svelte";
import type { Note, Task } from "$lib/storage/organize";
import { openShelf, writeSampleProject, type OpenedProject } from "$lib/storage/sqlite";
import { t, ui } from "$lib/ui.svelte";

/** A sample project, as it is written into the library. */
export type SampleProject = {
  slug: string;
  /** Where it goes in the library: "" for the library itself, or a folder in it. */
  folder: string;
  title: string;
  build: (projectId: string) => { writings: { writing: Writing; folder: string }[]; notes: Note[]; tasks: Task[] };
};

/** What the samples need from the page around them (+page.svelte), IMP-28. */
export type SamplesHost = {
  /** Whether a writing is open: samples are written only then. */
  writingOpen: () => boolean;
  writingId: () => string;
  libraryRoot: () => string;
  prefs: () => Prefs;
  /** Where the samples were written, and Home's and the library's lists with them, remembered. */
  remember: (patch: Pick<Prefs, "samples" | "knownProjects">) => void;
  /** The open project, and every switch to another. */
  session: Session;
  /** Runs work with the page's editor closed, and opens it again after. */
  withEditorClosed: (work: () => Promise<void>) => Promise<void>;
  /** The open writing's Word copy, brought up to date while its project is still open. */
  updateWordCopy: () => Promise<void>;
  rememberProject: () => void;
  /** Makes a project's folder in the library, or reuses one there already (libraryDisk.ts). */
  makeProjectFolder: (parent: string, name: string, reuse?: boolean) => Promise<string>;
  /** The open project read again after: `show` its writing when it was one of them, or its writing went. */
  reopened: (opened: OpenedProject, show: boolean) => void;
  /** Reads the library's tree again. */
  refreshLibrary: () => Promise<void>;
  /** Said in Settings, under its rows. */
  say: (message: string) => void;
};

/** The example projects and the long test book, from Settings: written into the library, or put back as they were (IMP-28). */
export class SampleProjects {
  #host: SamplesHost;

  constructor(host: SamplesHost) {
    this.#host = host;
  }

  /**
   * Writes sample projects into folders of their own in the library and lists them in it. A sample that
   * is there already is put back as it was written: its writings go to Deleted, where whatever was written
   * in them can still be put back, and its notes and to-dos go. The writer's own projects are never touched.
   */
  async write(samples: SampleProject[], done: string): Promise<void> {
    const host = this.#host;
    if (!host.writingOpen()) return;
    try {
      const written: Record<string, string> = {};
      const remembered: KnownProject[] = [];
      let homeRewritten = false;
      await host.withEditorClosed(async () => {
        // The project open when this change runs, which may not be the one open when it was asked for.
        const home = host.session.path;
        const homeWriting = host.writingId();
        await host.updateWordCopy();
        host.rememberProject();
        await host.session.elsewhere(
          async (visit) => {
            const library = host.libraryRoot();
            for (const sample of samples) {
              const parent = sample.folder ? joinPath(library, sample.folder) : library;
              const before = host.prefs().samples[sample.slug];
              const existing = before && (await invoke<boolean>("project_file_exists", { path: before }));
              const path = existing ? before : await host.makeProjectFolder(parent, sample.title, true);
              const fresh = !(await invoke<boolean>("project_file_exists", { path }));
              // Opened only to be written: it never becomes the open project, nor the one that opens at the next start.
              await visit(path);
              const opened = await openShelf("", { title: sample.title, writingTitle: sample.title, welcome: false });
              const built = sample.build(opened.shelf.projectId);
              // A file made just now starts with one empty writing, which simply goes.
              await writeSampleProject({ path, title: sample.title, placeholder: fresh ? opened.writing.id : "", ...built });
              written[sample.slug] = path;
              // Home and the library show it, with its writings, before it is ever opened.
              remembered.push({ path, title: sample.title, summary: summarizeProject(built.writings.map((item) => summarize(item.writing))) });
              if (path.toLowerCase() === home.toLowerCase()) homeRewritten = true;
            }
          },
          // Whatever happened, the open project is open again, and storage knows it, for note and to-do saves.
          async () => {
            const reopened = await openShelf(homeRewritten ? "" : homeWriting, { title: projectName(home), writingTitle: t("untitled"), welcome: false });
            // The open project was one of them, or a reset that failed half-way already put its writing in Deleted:
            // show what is there now, never a deleted writing (or the next save would write the old text back).
            host.reopened(reopened, homeRewritten || reopened.writing.id !== homeWriting);
          },
        );
      });
      const prefs = host.prefs();
      const paths = new Set(remembered.map((item) => item.path.toLowerCase()));
      host.remember({
        samples: { ...prefs.samples, ...written },
        knownProjects: [...remembered, ...prefs.knownProjects.filter((item) => !paths.has(item.path.toLowerCase()))].slice(0, 50),
      });
      await host.refreshLibrary();
      host.say(done);
    } catch (error) {
      host.say(errorMessage(error));
    }
  }

  /** The example projects, in a folder of their own in the library. */
  async addExamples(): Promise<void> {
    const { EXAMPLE_PROJECTS, buildExample } = await import("$lib/samples/examples");
    await this.write(
      EXAMPLE_PROJECTS.map((example) => ({
        slug: example.slug,
        folder: t("examplesFolder"),
        title: example.title,
        build: (projectId: string) => buildExample(example, projectId),
      })),
      t("examplesAdded"),
    );
  }

  /** About 150,000 words, for timing typing in a big book on the writer's laptop. */
  async addLongBook(): Promise<void> {
    const { LONG_BOOK_SLUG, buildLongBook } = await import("$lib/samples/longBook");
    const language = ui.language;
    await this.write(
      [
        {
          slug: LONG_BOOK_SLUG,
          folder: "",
          title: t("longBookTitle"),
          build: (projectId: string) => {
            const built = buildLongBook(projectId, t("longBookTitle"), (n) => chapterTitle(language, n));
            return { writings: [{ writing: built.writing, folder: "" }], notes: built.notes, tasks: built.tasks };
          },
        },
      ],
      t("longBookAdded"),
    );
  }
}
