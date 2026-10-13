import type { ProjectText } from "$lib/storage/sqlite";
import { findPattern, type FindOptions } from "$lib/editor/findPattern";

/** Search across every project (owner, 12 October): its writings' chapters and its notes. */

/** A project read for the search: its file, the name the library shows, and its text. */
export type SearchSource = { path: string; name: string; text: ProjectText };

/** How much is shown either side of the words, in characters, before it is cut at a word. */
const AROUND = 48;

/**
 * One place the words are, for the find's list (owner, 13 October): in a chapter, known by its number, in a
 * writing of one page, known by its page, or in a note.
 */
export type SearchHit = {
  path: string;
  kind: "chapter" | "note";
  writingId: string;
  chapterId: string;
  noteId: string;
  /** The writing's name, or the note's. */
  title: string;
  /** The chapter's number in its writing; 0 in a writing of one page, or a note. */
  chapter: number;
  /** The page it is on in a writing of one page, a page holding about PAGE_CHARACTERS; else 0. */
  page: number;
  /** Which time it is in its chapter (its title first) or note, from 0: the page opens on that one. */
  nth: number;
  before: string;
  match: string;
  after: string;
};

/** A project's places, and how many times the words are in it. */
export type HitGroup = { path: string; name: string; count: number; hits: SearchHit[] };

export type HitResult = { groups: HitGroup[]; total: number; capped: boolean };

/**
 * About how much of a writing a page holds, in characters, for "p. 4": what a sheet of A4 holds in Write at
 * the usual 12 points (measured 13 October), so the list's page is about the page she sees there.
 */
export const PAGE_CHARACTERS = 2750;

/**
 * Every place the words are in every project, in the order given, as Find matches them (Aa, ab; č apart
 * from c): chapters with their titles, and notes with their names. Every time is counted; at most `most`
 * are listed, so a common word stays quick.
 */
export function searchHits(sources: SearchSource[], query: string, options: FindOptions, most = 2000): HitResult {
  const pattern = findPattern(query, options);
  if (!pattern) return { groups: [], total: 0, capped: false };
  const groups: HitGroup[] = [];
  let total = 0;
  let listed = 0;
  for (const source of sources) {
    const group: HitGroup = { path: source.path, name: source.name, count: 0, hits: [] };
    const look = (place: Pick<SearchHit, "kind" | "writingId" | "chapterId" | "noteId" | "title" | "chapter">, title: string, text: string, paged: boolean) => {
      const whole = title.trim() ? `${title}\n${text}` : text;
      const head = title.trim() ? title.length + 1 : 0;
      let nth = 0;
      for (const match of whole.matchAll(pattern)) {
        const at = match.index ?? 0;
        group.count += 1;
        total += 1;
        if (listed < most) {
          const page = paged ? Math.floor(Math.max(0, at - head) / PAGE_CHARACTERS) + 1 : 0;
          group.hits.push({ path: source.path, ...place, page, nth, ...around(whole, at, match[0].length) });
          listed += 1;
        }
        nth += 1;
      }
    };
    for (const writing of source.text.writings) {
      const split = writing.split ?? !(writing.chapters.length === 1 && writing.chapters[0].title.trim() === writing.title.trim());
      writing.chapters.forEach((chapter, index) => {
        const place = { kind: "chapter" as const, writingId: writing.id, chapterId: chapter.id, noteId: "", title: writing.title, chapter: split ? index + 1 : 0 };
        look(place, chapter.title, chapter.text, !split);
      });
    }
    for (const note of source.text.notes) {
      look({ kind: "note", writingId: "", chapterId: "", noteId: note.id, title: note.title, chapter: 0 }, note.title, note.text, false);
    }
    if (group.count > 0) groups.push(group);
  }
  return { groups, total, capped: total > listed };
}

/** A project in the list: the first of its places, numbered down the whole list for the arrow keys, and how many more it has. */
export type ShownGroup = HitGroup & { shown: { hit: SearchHit; index: number }[]; more: number };

/** The places the list shows: the first `first` of each project, or as many as she opened it to (`opened`, by its file). */
export function shownHits(groups: HitGroup[], opened: Record<string, number>, first: number): ShownGroup[] {
  let index = 0;
  return groups.map((group) => {
    const count = Math.min(group.hits.length, Math.max(first, opened[group.path] ?? 0));
    return { ...group, shown: group.hits.slice(0, count).map((hit) => ({ hit, index: index++ })), more: group.hits.length - count };
  });
}

/** The words found, and a little of the text either side, cut at whole words and on one line. */
function around(text: string, at: number, length: number): Pick<SearchHit, "before" | "match" | "after"> {
  const flat = (value: string) => value.replace(/\s+/g, " ");
  let start = Math.max(0, at - AROUND);
  let end = Math.min(text.length, at + length + AROUND);
  if (start > 0) {
    const space = text.slice(start, at).search(/\s/);
    if (space >= 0) start += space + 1;
  }
  if (end < text.length) {
    const tail = text.slice(at + length, end);
    const space = Math.max(tail.lastIndexOf(" "), tail.lastIndexOf("\n"));
    if (space > 0) end = at + length + space;
  }
  return {
    before: `${start > 0 ? "…" : ""}${flat(text.slice(start, at)).trimStart()}`,
    match: flat(text.slice(at, at + length)),
    after: `${flat(text.slice(at + length, end)).trimEnd()}${end < text.length ? "…" : ""}`,
  };
}
