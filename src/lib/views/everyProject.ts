import { invoke } from "@tauri-apps/api/core";
import { projectFiles, projectName, sortEntries, type LibraryEntry } from "$lib/chapters/library";
import type { KnownProject } from "$lib/prefs";

/**
 * Every project Pensieve knows, each once: the library's, in the order its tree shows them, then those kept
 * elsewhere. `first` goes before them all (the open project, for the search across projects); `except` is left out
 * (the open one, for the Ideas tab's other projects).
 */
export function everyProject(entries: LibraryEntry[], known: KnownProject[], locale: string, { first = "", except = "" } = {}): string[] {
  const paths: string[] = [];
  const seen = new Set<string>(except ? [except.trim().toLowerCase()] : []);
  const add = (path: string) => {
    const key = path.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      paths.push(path);
    }
  };
  add(first);
  for (const path of projectFiles(sortEntries(entries, locale))) add(path);
  for (const item of known) add(item.path);
  return paths;
}

/**
 * Reads each project in turn with `read`, saying how far it got. One that isn't there any more is left out, as
 * opening its file would make an empty one (`open`, the project open now, is there); one that can't be read is
 * named among the unread, and the others are still read.
 */
export async function readEach<T>(
  paths: string[],
  open: string,
  read: (path: string, name: string) => Promise<T[]>,
  progress: (done: number, total: number) => void,
): Promise<{ found: T[]; unread: string[] }> {
  const found: T[] = [];
  const unread: string[] = [];
  for (const [index, path] of paths.entries()) {
    progress(index, paths.length);
    try {
      if (path !== open && !(await invoke<boolean>("project_file_exists", { path }))) continue;
      found.push(...(await read(path, projectName(path))));
    } catch {
      unread.push(projectName(path));
    }
  }
  progress(paths.length, paths.length);
  return { found, unread };
}
