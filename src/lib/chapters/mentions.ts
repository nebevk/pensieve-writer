import type { Chapter, DocumentJson } from "$lib/model";
import type { Note } from "$lib/storage/organize";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How often a name appears in a chapter's text as whole words, ignoring case: "Ana", not "Banana". */
export function mentions(text: string, title: string): number {
  const needle = title.trim();
  if (needle.length < 2) return 0;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, "giu");
  return text.match(pattern)?.length ?? 0;
}

const ARTICLES = new Set(["the", "a", "an"]);

/**
 * How often a note is mentioned. A character is mostly called by the first word of the note's
 * title, so "Ana Novak" counts every "Ana" (and the full name within them). "The ferryman" keeps
 * its whole title, as an article names nobody.
 */
export function noteMentions(text: string, note: Pick<Note, "title" | "category">): number {
  const full = mentions(text, note.title);
  if (note.category !== "characters") return full;
  const first = note.title.trim().split(/[\s,]+/)[0] ?? "";
  if (first.length < 3 || ARTICLES.has(first.toLowerCase()) || first === note.title.trim()) return full;
  return Math.max(full, mentions(text, first));
}

type MarkedNode = { marks?: { type?: string; attrs?: { noteId?: string } }[]; content?: unknown[] };

/** How many passages of a chapter link to each note with "Link a note", in one pass. */
export function noteLinkCounts(doc: DocumentJson): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (node: MarkedNode) => {
    for (const mark of node.marks ?? []) {
      const id = mark.type === "noteLink" ? mark.attrs?.noteId : undefined;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const child of node.content ?? []) walk(child as MarkedNode);
  };
  walk(doc as MarkedNode);
  return counts;
}

/** How many passages of a chapter link to one note. */
export function linksTo(doc: DocumentJson, noteId: string): number {
  return noteLinkCounts(doc).get(noteId) ?? 0;
}

export type NoteHere = { note: Note; count: number };

/**
 * The notes a chapter mentions, links to, or is linked with on the note, most mentioned first:
 * what the panel beside the page lists.
 */
export function notesInChapter(notes: Note[], chapter: Pick<Chapter, "id" | "plainText" | "contentJson">): NoteHere[] {
  const links = noteLinkCounts(chapter.contentJson);
  return notes
    .flatMap((note) => {
      const count = Math.max(noteMentions(chapter.plainText, note), links.get(note.id) ?? 0);
      return count > 0 || note.chapterIds.includes(chapter.id) ? [{ note, count }] : [];
    })
    .sort((a, b) => b.count - a.count || a.note.title.localeCompare(b.note.title));
}
