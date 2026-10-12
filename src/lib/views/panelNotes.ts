import type { NoteHere } from "$lib/chapters/mentions";
import type { Note } from "$lib/storage/organize";

/** What the notes panel lists: the chapter's notes and every other one, or what a search found. */
export type PanelNotes = {
  /** The notes the chapter mentions, most mentioned first. */
  here: NoteHere[];
  /** The project's other notes, by name. */
  others: Note[];
  /** Searching: the notes that match, those whose name does first. Empty when not searching. */
  found: Note[];
  searching: boolean;
};

/** Whether a note's name, other names, description or text holds the words, ignoring case. */
export function noteMatches(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [note.title, note.aliases, note.tags, note.plainText].some((text) => text.toLowerCase().includes(needle));
}

/**
 * The notes panel's list (owner, 12 October): the notes the chapter mentions, then the project's other
 * notes by name; or, while searching, every note that matches, those named by the words first.
 */
export function panelNotes(here: NoteHere[], book: Note[], query: string, locale = "sl"): PanelNotes {
  const byName = (a: Note, b: Note) => a.title.localeCompare(b.title, locale, { sensitivity: "base" });
  const needle = query.trim().toLowerCase();
  if (needle) {
    const matching = book.filter((note) => noteMatches(note, needle));
    const named = matching.filter((note) => note.title.toLowerCase().includes(needle)).sort(byName);
    const rest = matching.filter((note) => !note.title.toLowerCase().includes(needle)).sort(byName);
    return { here: [], others: [], found: [...named, ...rest], searching: true };
  }
  const mentioned = new Set(here.map((item) => item.note.id));
  return { here, others: book.filter((note) => !mentioned.has(note.id)).sort(byName), found: [], searching: false };
}

/** The notes in the order the panel lists them, which the previous and next buttons walk. */
export function panelOrder(list: PanelNotes): string[] {
  return list.searching ? list.found.map((note) => note.id) : [...list.here.map((item) => item.note.id), ...list.others.map((note) => note.id)];
}
