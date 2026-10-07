import type { Shelf } from "$lib/model";
import type { Note, NoteCategory } from "$lib/storage/organize";
import type { KnownProject } from "$lib/prefs";

/**
 * The library beside the page: every book Pensieve knows, by the folder its file is in, as a tree to
 * browse between them. The folder the open book is in comes first; the others follow by name.
 */

export type LibraryFolder = { path: string; name: string; books: KnownProject[] };

/** The folder a book's file is in, and the folder's own name. */
export function folderOf(path: string): { path: string; name: string } {
  const cut = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  const folder = cut > 0 ? path.slice(0, cut) : "";
  const nameCut = Math.max(folder.lastIndexOf("\\"), folder.lastIndexOf("/"));
  return { path: folder, name: folder.slice(nameCut + 1) || folder };
}

/**
 * The known books by folder, the open book's folder first. A book Pensieve has open but doesn't know
 * yet (its first moments) is listed under its own folder with the title given.
 */
export function groupBooks(books: KnownProject[], currentPath: string, currentTitle = ""): LibraryFolder[] {
  const listed = books.some((book) => book.path === currentPath);
  const all = listed || !currentPath ? books : [{ path: currentPath, title: currentTitle }, ...books];
  const folders = new Map<string, LibraryFolder>();
  for (const book of all) {
    const folder = folderOf(book.path);
    const entry = folders.get(folder.path) ?? { ...folder, books: [] };
    entry.books.push(book);
    folders.set(folder.path, entry);
  }
  const current = folderOf(currentPath).path;
  const byName = (a: { name: string; title?: string }, b: { name: string; title?: string }) =>
    (a.title ?? a.name).localeCompare(b.title ?? b.name, undefined, { sensitivity: "base" });
  return [...folders.values()]
    .map((folder) => ({ ...folder, books: [...folder.books].sort((a, b) => byName({ name: "", title: a.title }, { name: "", title: b.title })) }))
    .sort((a, b) => (a.path === current ? -1 : b.path === current ? 1 : byName(a, b)));
}

/**
 * Folders a sync service keeps copying while files in them are open (OneDrive, Google Drive, Dropbox,
 * iCloud). A live book must never sit in one: a half-synced database can come back broken or doubled.
 * The writer's Drive folder gets backups instead, which are whole files written once.
 */
const SYNCED = ["onedrive", "google drive", "googledrive", "my drive", "dropbox", "icloud drive", "iclouddrive", "icloud"];

export function looksSynced(path: string): boolean {
  return path
    .toLowerCase()
    .split(/[\\/]+/)
    .some((part) => SYNCED.some((name) => part === name || part.startsWith(`${name} `) || part.startsWith(`${name}-`)));
}

/** `folder` and `name` joined with the folder's own slash. */
export function joinPath(folder: string, name: string): string {
  const slash = folder.includes("\\") || !folder.includes("/") ? "\\" : "/";
  return `${folder.replace(/[\\/]+$/, "")}${slash}${name}`;
}

/** Whether `path` is `folder` or inside it, as Windows compares paths: either slash, any case. */
export function isInside(path: string, folder: string): boolean {
  const clean = (value: string) => value.trim().replace(/[\\/]+/g, "\\").replace(/\\$/, "").toLowerCase();
  const inner = clean(path);
  const outer = clean(folder);
  return outer.length > 0 && (inner === outer || inner.startsWith(`${outer}\\`));
}

/** The folder `path` is in. At a drive's top that is "E:\": a bare "E:" is that drive's current folder to Windows. */
export function parentFolder(path: string): string {
  const parent = folderOf(path.trim().replace(/[\\/]+$/, "")).path;
  return /^[a-z]:$/i.test(parent) ? `${parent}\\` : parent;
}

/** Whether two paths are the same folder, as Windows compares paths. */
export function sameFolder(a: string, b: string): boolean {
  return isInside(a, b) && isInside(b, a);
}

/** A folder's own name: the last part of its path. */
export function lastName(path: string): string {
  const clean = path.trim().replace(/[\\/]+$/, "");
  return clean.slice(Math.max(clean.lastIndexOf("\\"), clean.lastIndexOf("/")) + 1);
}

/** Where `path` is after the folder `from` became `to` (renamed or moved); a path outside `from` stays as it is. */
export function rebasePath(path: string, from: string, to: string): string {
  if (!path || !isInside(path, from)) return path;
  const tail = path.trim().replace(/[\\/]+$/, "").slice(from.trim().replace(/[\\/]+$/, "").length);
  return `${to.trim().replace(/[\\/]+$/, "")}${tail}`;
}

/** Where the library goes unless she chooses: Documents\Pensieve, or her home folder's when Documents is synced. */
export function defaultLibraryFolder(places: { documents: string; home: string }): string {
  const base = places.documents && !looksSynced(places.documents) ? places.documents : places.home;
  return joinPath(base, "Pensieve");
}

/** What is wrong with a name for a new folder or project, as an interface string's key; null when it's fine. */
export function folderNameProblem(name: string): "nameEmpty" | "nameTooLong" | "nameCharacters" | "nameStart" | "nameReserved" | null {
  const trimmed = name.trim().replace(/[.\s]+$/, "");
  if (!trimmed || trimmed === "." || trimmed === "..") return "nameEmpty";
  if ([...trimmed].length > 120) return "nameTooLong";
  // Characters Windows refuses in a folder's name, and control characters. A name starting with a dot or
  // a dollar sign would make a folder the library hides, as Windows and other programs keep such ones.
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(trimmed)) return "nameCharacters";
  if (/^[.$]/.test(trimmed)) return "nameStart";
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(trimmed)) return "nameReserved";
  return null;
}

/** A folder in the library, or a project (a folder holding a pensieve.db), as the Rust side lists them. */
export type LibraryEntry = { name: string; path: string; project: boolean; children: LibraryEntry[] };

/** The file a project folder keeps its project in. */
export function projectFile(folder: string): string {
  return joinPath(folder, "pensieve.db");
}

/** A project's name: its folder's, as Explorer shows it. */
export function projectName(file: string): string {
  return folderOf(file).name;
}

/** One collator per language, made once: a new one for each comparison is slow on the writer's laptop. */
const collators = new Map<string, Intl.Collator>();
export function collator(locale: string): Intl.Collator {
  let made = collators.get(locale);
  if (!made) {
    made = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    collators.set(locale, made);
  }
  return made;
}

/** Folders and projects sorted by name, as the writer's language sorts them (č after c, š after s). */
export function sortEntries(entries: LibraryEntry[], locale: string): LibraryEntry[] {
  const order = collator(locale);
  return [...entries].sort((a, b) => order.compare(a.name, b.name)).map((entry) => ({ ...entry, children: sortEntries(entry.children, locale) }));
}

/** The first project in the library, folders searched in order: the file to open when none was open. */
export function firstProject(entries: LibraryEntry[], locale = "en"): string | null {
  for (const entry of sortEntries(entries, locale)) {
    if (entry.project) return projectFile(entry.path);
    const inside = firstProject(entry.children, locale);
    if (inside) return inside;
  }
  return null;
}

/** Every project file in the library, at any depth. */
export function projectFiles(entries: LibraryEntry[]): string[] {
  return entries.flatMap((entry) => (entry.project ? [projectFile(entry.path)] : projectFiles(entry.children)));
}

/**
 * What the library's tree can ask the page to do. A new name comes back with a message to show beside
 * it when it won't do (null when it was made).
 */
export type LibraryActions = {
  openProject(path: string): void;
  openWriting(path: string, writingId: string, chapterId?: string): void;
  openNote(id: string): void;
  openTodos(): void;
  openAnother(): void;
  newProject(parent: string, name: string): Promise<string | null>;
  newLibraryFolder(parent: string, name: string): Promise<string | null>;
  /** Renames a folder of the library or a project's folder (`path`), on disk. */
  renameLibraryEntry(path: string, name: string): Promise<string | null>;
  /** Moves a folder of the library or a project's folder into another folder (`into`; the library's own for its top). */
  moveLibraryEntry(path: string, into: string): void;
  deleteLibraryFolder(path: string): void;
  /** Puts a writing just before another one, in that one's writing folder. */
  placeWriting(id: string, beforeId: string): void;
  newWriting(folder: string, name: string): Promise<string | null>;
  newWritingFolder(name: string): Promise<string | null>;
  renameWritingFolder(from: string, to: string): Promise<string | null>;
  deleteWritingFolder(name: string): void;
  renameWriting(id: string, title: string): void;
  duplicateWriting(id: string): void;
  deleteWriting(id: string): void;
  putBack(id: string): void;
  eraseWriting(id: string): void;
  moveWriting(id: string, folder: string): void;
  setSplit(id: string, split: boolean): void;
  newNote(category: NoteCategory, title: string): void;
  renameNote(id: string, title: string): void;
  duplicateNote(id: string): void;
  deleteNote(id: string): void;
  moveNote(id: string, category: NoteCategory): void;
  moveIntoLibrary(): void;
};

/** Everything the library's tree shows: the folder on disk, the open project's shelf, and its notes. */
export type LibraryView = {
  /** The library folder, and its folders and projects as last read from disk. */
  root: string;
  entries: LibraryEntry[];
  /** Projects opened before, some of them kept outside the library ("Elsewhere"). */
  known: KnownProject[];
  /** The open project's file. */
  currentPath: string;
  shelf: Shelf | null;
  notes: Note[];
  openTodos: number;
  /** Home's "+ New" asked to name a new project, at this time. */
  create: { kind: "project"; parent: string; at: number } | null;
};
