import { createChapter, emptyDocument, type Chapter } from "$lib/model";
import { isUntitled } from "$lib/i18n";
import { collator } from "$lib/chapters/library";
import { looksLikeChapterTitle, type ImportedChapter, type WordImport } from "./wordImport";

/** Files brought in as writings: what kind each is, and how it becomes a writing or a book's chapters. */

export type DocumentKind = "word" | "text" | "markdown";

export function documentKind(path: string): DocumentKind | null {
  const kind = /\.([^.\\/]+)$/.exec(path)?.[1].toLowerCase();
  return kind === "docx" ? "word" : kind === "txt" ? "text" : kind === "md" || kind === "markdown" ? "markdown" : null;
}

/** A file's name without its folder or its kind: "Pod lipo" for C:\…\Pod lipo.docx. */
export function documentName(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? "";
  return documentKind(name) ? name.replace(/\.[^.]+$/, "") : name;
}

/** Files in the order Explorer shows them: "2 Drugo" before "10 Deseto". */
export function byFileName(paths: string[], locale: string): string[] {
  const order = collator(locale);
  return [...paths].sort((a, b) => order.compare(documentName(a), documentName(b)));
}

/** A writing made from a file: its title, whether it has chapters, and their text. */
export type WritingDraft = { title: string; split: boolean; chapters: ImportedChapter[] };

/**
 * How a file read in becomes a writing named after it (`name`), unless it names itself: its Title, or
 * its one heading. A file with several chapters is a writing of chapters; with one, one page.
 */
export function writingFromDocument(result: WordImport, name: string, untitled: string): WritingDraft {
  // A file's one chapter line (a Heading 1 such as "Pod lipo") was read as that chapter's title and isn't in
  // its text, so it mustn't be dropped: with no Title paragraph it names the writing; a chapter label, or a
  // line under a Title that says something else, stays the title of its one chapter.
  const only = result.chapters.length === 1 ? result.chapters[0].title.trim() : "";
  const named = only && only !== name && !isUntitled(only) && !looksLikeChapterTitle(only) ? only : "";
  const title = result.title.trim() || named || name || untitled;
  const split = result.chapters.length > 1 || (only !== "" && only !== name && !isUntitled(only) && only !== title);
  return { title, split, chapters: result.chapters };
}

/**
 * One book of several files, in the order given: a file's chapters, or the one it is, named by its own
 * heading or Title, else its file name. An empty file is an empty chapter, so none goes missing.
 */
export function bookFromDocuments(title: string, documents: { name: string; result: WordImport }[]): WritingDraft {
  const chapters = documents.flatMap(({ name, result }): ImportedChapter[] => {
    if (result.chapters.length > 1) return result.chapters;
    const own = result.chapters[0]?.title.trim() ?? "";
    const named = own && !isUntitled(own) ? own : result.title.trim() || name;
    return [result.chapters[0] ? { ...result.chapters[0], title: named } : { title: named, contentJson: emptyDocument(), plainText: "" }];
  });
  return { title, split: true, chapters };
}

/**
 * The chapters of a writing made from a draft, as storage asks for them, or none for a file with no text,
 * so the writing starts as a new one does. One page carries the writing's title on its title line.
 */
export function draftChapters(draft: WritingDraft, now = new Date().toISOString()): ((writingId: string) => Chapter[]) | undefined {
  if (draft.chapters.length === 0) return undefined;
  return (writingId) =>
    draft.chapters.map((item, index) => ({
      ...createChapter(writingId, draft.split ? item.title : draft.title, index, now),
      contentJson: item.contentJson,
      plainText: item.plainText,
      ...(item.part !== undefined ? { part: item.part } : {}),
    }));
}
