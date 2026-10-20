import { invoke } from "@tauri-apps/api/core";
import { folderNameProblem, folderOf, isInside, lastName, parentFolder, rebasePath, sameFolder } from "$lib/chapters/library";
import { errorMessage } from "$lib/save/autosave";
import { moveProjectFile } from "$lib/storage/sqlite";
import { t } from "$lib/ui.svelte";

/** What the library's folders and projects on disk need from the page around them (+page.svelte), IMP-28. */
export type LibraryDiskHost = {
  /** The library folder; "" until it is known. */
  libraryRoot: () => string;
  /** The open project's file. */
  openFile: () => string;
  /** Runs one change after the ones before it. */
  oneAtATime: <T>(work: () => Promise<T>) => Promise<T>;
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
};

/** The library's folders and projects on disk, made, renamed, moved and deleted, and her files in it opened (IMP-28). */
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
        const file = host.openFile();
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
    if (!library || !isInside(path, library) || sameFolder(folderOf(path).path, folderOf(this.#host.openFile()).path)) return;
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
}
