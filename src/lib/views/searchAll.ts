import type { ProjectText } from "$lib/storage/sqlite";

/** Search across every project (owner, 12 October): its writings' chapters and its notes. */

/** A project read for the search: its file, the name the library shows, and its text. */
export type SearchSource = { path: string; name: string; text: ProjectText };

/** A chapter or a note where the words are: how many times, and the first time with what is around it. */
export type SearchPlace = {
  path: string;
  kind: "chapter" | "note";
  writingId: string;
  chapterId: string;
  noteId: string;
  /** The writing and its chapter ("Pod lipo › 2. poglavje"), the writing alone when it is one page, or the note. */
  label: string;
  count: number;
  before: string;
  match: string;
  after: string;
};

export type SearchGroup = { path: string; name: string; places: SearchPlace[] };

export type SearchResult = { groups: SearchGroup[]; places: number; capped: boolean };

/** How much is shown either side of the words, in characters, before it is cut at a word. */
const AROUND = 48;

/**
 * Where the words are in every project, in the order given, matched as Find matches them: in any case,
 * with č and c told apart. A chapter's title is its first line on the page, and a note's its name, so
 * both are looked in. At most `most` places, so a common word stays quick.
 */
export function searchProjects(sources: SearchSource[], query: string, most = 150): SearchResult {
  const needle = query.trim().toLowerCase();
  if (!needle) return { groups: [], places: 0, capped: false };
  const groups: SearchGroup[] = [];
  let places = 0;
  let capped = false;
  for (const source of sources) {
    const found: SearchPlace[] = [];
    const look = (place: Pick<SearchPlace, "kind" | "writingId" | "chapterId" | "noteId" | "label">, title: string, text: string) => {
      const whole = title.trim() ? `${title}\n${text}` : text;
      const lower = whole.toLowerCase();
      const first = lower.indexOf(needle);
      if (first < 0) return;
      if (places >= most) {
        capped = true;
        return;
      }
      let count = 0;
      for (let at = first; at >= 0; at = lower.indexOf(needle, at + needle.length)) count += 1;
      found.push({ path: source.path, ...place, count, ...around(whole, first, needle.length) });
      places += 1;
    };
    for (const writing of source.text.writings) {
      const onePage = writing.chapters.length === 1 && writing.chapters[0].title.trim() === writing.title.trim();
      for (const chapter of writing.chapters) {
        const label = onePage ? writing.title : `${writing.title} › ${chapter.title}`;
        look({ kind: "chapter", writingId: writing.id, chapterId: chapter.id, noteId: "", label }, chapter.title, chapter.text);
      }
    }
    for (const note of source.text.notes) {
      look({ kind: "note", writingId: "", chapterId: "", noteId: note.id, label: note.title }, note.title, note.text);
    }
    if (found.length > 0) groups.push({ path: source.path, name: source.name, places: found });
  }
  return { groups, places, capped };
}

/** The words found, and a little of the text either side, cut at whole words and on one line. */
function around(text: string, at: number, length: number): Pick<SearchPlace, "before" | "match" | "after"> {
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
