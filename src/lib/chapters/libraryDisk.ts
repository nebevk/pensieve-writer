import { invoke } from "@tauri-apps/api/core";
import { folderNameProblem, folderOf, isInside, joinPath, lastName, looksSynced, parentFolder, projectFile, projectName, rebasePath, sameFolder } from "$lib/chapters/library";
import { errorMessage } from "$lib/save/autosave";
import type { Session } from "$lib/session.svelte";
import { chooseBackupFolder } from "$lib/storage/backup";
import { copyOpenProject, moveProjectFile, openShelf, type OpenedProject } from "$lib/storage/sqlite";
import { t } from "$lib/ui.svelte";

/** What library.rs says when a folder of that name is there already. */
const FOLDER_TAKEN = "Something with that name is already there";
/** An error as the Windows side reported it, before it is translated. */
const rawError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** What the library's folders and projects on disk need from the page around them (+page.svelte), IMP-28. */
export type LibraryDiskHost = {
  /** The library folder; "" until it is known. */
  libraryRoot: () => string;
  /** The folder her backups go to: the library is never in it, nor it in the library. */
  backupFolder: () => string;
  /** The library folder she chose: Pensieve remembers it, and the trees show it. */
  setLibraryFolder: (folder: string) => void;
  /** The open project, and every switch to another. */
  session: Session;
  /** The open project's name and writing; null while none is open. */
  openProject: () => { title: string; writingId: string } | null;
  /** Runs one change after the ones before it. */
  oneAtATime: <T>(work: () => Promise<T>) => Promise<T>;
  /** Runs work with the page's editor closed, and opens it again after. */
  withEditorClosed: (work: () => Promise<void>) => Promise<void>;
  /** The open project, moved with its folder and opened where it went: its name follows the folder's. */
  renamedByFolder: (file: string) => Promise<void>;
  /** What Pensieve keeps of paths in a folder that moved follows it there. */
  followMove: (from: string, to: string) => void;
  rememberProject: () => void;
  /** Takes a project off Pensieve's lists. */
  forgetProject: (path: string) => void;
  /** Reads the library's tree again. */
  refreshLibrary: () => Promise<void>;
  /** Said where she is: above the page, or on Home. */
  libraryNotice: (message: string) => void;
  /** Said above the page. */
  notice: (message: string) => void;
  /** A project just opened, named by its folder when it is in the library. */
  named: (path: string, opened: OpenedProject) => Promise<OpenedProject>;
  /** The open project, copied into the library and opened there: the old file goes off the lists. */
  movedIn: (source: string, opened: OpenedProject) => void;
  /** Said in Settings, under its rows. */
  say: (message: string) => void;
  /** Said where a failed save is. */
  fail: (message: string) => void;
};

/**
 * The library on disk: its folder, chosen; its folders and projects made, renamed, moved and deleted; a project
 * from elsewhere moved into it; and her files in it opened (IMP-28).
 */
export class LibraryDisk {
  #host: LibraryDiskHost;

  constructor(host: LibraryDiskHost) {
    this.#host = host;
  }

  /** A new folder in the library, on disk, to keep projects in. Returns what is wrong, or null. */
  async newFolder(parent: string, name: string): Promise<string | null> {
    const problem = folderNameProblem(name);
    if (problem) return t(problem);
    try {
      await invoke<string>("create_library_folder", { parent: parent || this.#host.libraryRoot(), name: name.trim() });
      await this.#host.refreshLibrary();
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  /**
   * Renames a folder of the library or a project's folder, or moves it into another folder, on disk. When the
   * open project is in it, storage lets go of its file for the move and opens it where it went, in one step:
   * the page stays open, and saves made meanwhile wait and go into the file there. Returns what is wrong, or null.
   */
  async relocate(from: string, parent: string, name: string): Promise<string | null> {
    const problem = folderNameProblem(name);
    if (problem) return t(problem);
    const host = this.#host;
    const library = host.libraryRoot();
    const move = () => invoke<string>("move_library_entry", { path: from, parent, name: name.trim(), library });
    let to = "";
    try {
      // After the changes before it, so the project open then is the one it looks at.
      await host.oneAtATime(async () => {
        const file = host.session.path;
        if (!isInside(file, from)) {
          to = await move();
          return;
        }
        const reopened = await moveProjectFile(
          async () => {
            to = await move();
            return rebasePath(file, from, to);
          },
          // It moved but won't open there: it goes back where it was.
          async () => {
            await invoke<string>("move_library_entry", { path: to, parent: parentFolder(from), name: lastName(from), library });
            to = "";
          },
        );
        await host.renamedByFolder(reopened);
      });
      return null;
    } catch (error) {
      return errorMessage(error);
    } finally {
      // Whatever failed after the move, what Pensieve remembers follows the folder to where it is now.
      if (to) {
        host.followMove(from, to);
        host.rememberProject();
      }
      await host.refreshLibrary();
    }
  }

  /** Moves a folder or a project into another folder of the library, keeping its name. */
  async move(path: string, into: string): Promise<void> {
    if (!into || sameFolder(parentFolder(path), into) || isInside(into, path)) return;
    const problem = await this.relocate(path, into, lastName(path));
    if (problem) this.#host.libraryNotice(problem);
  }

  /** Deletes an empty folder of the library; one with anything in it stays, and she is told why. */
  async deleteFolder(path: string): Promise<void> {
    try {
      await invoke("remove_library_folder", { path, library: this.#host.libraryRoot() });
    } catch (error) {
      this.#host.libraryNotice(errorMessage(error));
    }
    await this.#host.refreshLibrary();
  }

  /**
   * Moves a project of the library to the Recycle Bin, with everything in its folder (HOME-15); never the open
   * one. Where there is no Recycle Bin, Windows asks her itself, and a no there leaves it all as it was.
   */
  async deleteProject(path: string): Promise<void> {
    const library = this.#host.libraryRoot();
    if (!library || !isInside(path, library) || sameFolder(folderOf(path).path, folderOf(this.#host.session.path).path)) return;
    try {
      if (await invoke<boolean>("trash_project_folder", { path: folderOf(path).path, library })) this.#host.forgetProject(path);
    } catch (error) {
      this.#host.libraryNotice(errorMessage(error));
    }
    await this.#host.refreshLibrary();
  }

  /** One of her files, opened in its own program: a Word file in Word, a picture in Photos. */
  async openFile(path: string): Promise<void> {
    try {
      await invoke("open_library_file", { path });
    } catch (error) {
      this.#host.notice(errorMessage(error));
    }
  }

  async showInExplorer(path: string): Promise<void> {
    try {
      await invoke("show_in_explorer", { path });
    } catch (error) {
      this.#host.notice(errorMessage(error));
    }
  }

  /**
   * Makes a project's folder in `parent` and returns its file. With `reuse`, a project already there under
   * that name is used, and so is its folder left empty by an earlier try; any other trouble is said.
   */
  async makeProjectFolder(parent: string, name: string, reuse = false): Promise<string> {
    const problem = folderNameProblem(name);
    if (problem) throw new Error(t(problem));
    const target = projectFile(joinPath(parent, name.trim()));
    if (reuse && (await invoke<boolean>("project_file_exists", { path: target }))) return target;
    try {
      return await invoke<string>("new_project_folder", { parent, name: name.trim() });
    } catch (error) {
      if (reuse && rawError(error) === FOLDER_TAKEN) return target;
      throw error;
    }
  }

  /**
   * A folder in `parent` for a project named `name`: the name made fit for a folder, with " (2)", " (3)"…
   * when one of that name is there already. Returns the folder.
   */
  async freeProjectFolder(parent: string, name: string): Promise<string> {
    const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/^[.$\s]+|[.\s]+$/g, "").trim() || t("firstProjectName");
    const fit = folderNameProblem(base) ? t("firstProjectName") : base;
    for (let n = 1; n < 100; n += 1) {
      const candidate = n === 1 ? fit : `${fit} (${n})`;
      try {
        return await invoke<string>("create_library_folder", { parent, name: candidate });
      } catch (error) {
        if (rawError(error) !== FOLDER_TAKEN) throw error;
      }
    }
    throw new Error(t("nameTaken"));
  }

  /** The library folder, chosen in Settings: never in a synced folder, never with the backups, never a project's own. */
  async chooseFolder(): Promise<void> {
    const host = this.#host;
    try {
      const folder = await chooseBackupFolder(t("dialogLibraryFolder"));
      if (!folder) return;
      if (looksSynced(folder)) return host.say(t("librarySynced"));
      const backups = host.backupFolder();
      if (backups && (isInside(folder, backups) || isInside(backups, folder))) return host.say(t("libraryBackupApart"));
      if (await invoke<boolean>("project_file_exists", { path: projectFile(folder) })) return host.say(t("libraryIsProject"));
      host.setLibraryFolder(folder);
      await host.refreshLibrary();
      host.say(t("libraryMoved", { path: folder }));
    } catch (error) {
      host.say(errorMessage(error));
    }
  }

  /**
   * Copies the open project, kept outside the library, into a folder of its own in it, and opens the copy. The old
   * file stays where it was, off the lists, so nobody edits the stale one.
   */
  async moveOpenProjectIn(): Promise<void> {
    const host = this.#host;
    if (!host.openProject()) return;
    try {
      await host.withEditorClosed(async () => {
        // The project open when this change runs.
        const source = host.session.path;
        const library = host.libraryRoot();
        if (isInside(source, library)) return;
        const name = host.openProject()?.title.trim() || projectName(source) || t("untitled");
        let folder = "";
        // Saves wait from the copy until the copy is the open file: one made in between would stay in the old one.
        // A copy that won't open goes to the Recycle Bin rather than stay in the library as a project that won't
        // open, and the project stays where it was, opened there again.
        const opened = await host.session.moveTo(
          async () => {
            folder = await this.freeProjectFolder(library, name);
            // A whole copy from SQLite itself, in the save queue: nothing written meanwhile is left behind (ARCH-6).
            return copyOpenProject(folder);
          },
          async (path) => host.named(path, await openShelf(host.openProject()?.writingId ?? "", { title: name, writingTitle: name, welcome: false })),
          () => invoke("trash_project_folder", { path: folder, library }),
        );
        const destination = host.session.path;
        host.movedIn(source, opened);
        host.say(t("projectMoved", { path: destination }));
        host.notice(t("projectMoved", { path: destination }));
      });
      await host.refreshLibrary();
    } catch (error) {
      host.say(errorMessage(error));
      host.fail(errorMessage(error));
    }
  }
}
