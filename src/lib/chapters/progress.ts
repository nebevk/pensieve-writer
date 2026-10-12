import { wordsFor } from "$lib/editor/counts";
import type { Writing, WritingLanguage, WritingOutline } from "$lib/model";

/** What a writing's card and row show. Kept with the remembered projects, so closed ones show it too. */
export type WritingSummary = {
  id: string;
  title: string;
  /** "Split into chapters"; off, the writing is one page. */
  split: boolean;
  language: WritingLanguage;
  words: number;
  /** Words planned: the writing's target, or else the chapter goals added up; 0 when there's neither. */
  target: number;
  chapters: number;
  editedAt: string;
};

/** A project as Home and the library show it while it's closed: its writings and their words added up. */
export type ProjectSummary = {
  words: number;
  editedAt: string;
  writings: WritingSummary[];
};

export function summarize(writing: Writing): WritingSummary {
  const chapters = [...writing.chapters].sort((a, b) => a.position - b.position);
  const goals = chapters.reduce((sum, chapter) => sum + (chapter.wordGoal > 0 ? chapter.wordGoal : 0), 0);
  return {
    id: writing.id,
    title: writing.title,
    split: writing.split,
    language: writing.language,
    // Home asks for this whenever the writing changes; a chapter whose text did not change is not counted again.
    words: chapters.reduce((sum, chapter) => sum + wordsFor(chapter.id, chapter.plainText), 0),
    target: writing.wordGoal > 0 ? writing.wordGoal : goals,
    chapters: chapters.length,
    editedAt: chapters.reduce((latest, chapter) => (chapter.updatedAt > latest ? chapter.updatedAt : latest), ""),
  };
}

/** The same summary for a writing that isn't open, from its outline (its chapter goals aren't in it). */
export function summarizeOutline(outline: WritingOutline): WritingSummary {
  const chapters = [...outline.chapters].sort((a, b) => a.position - b.position);
  return {
    id: outline.id,
    title: outline.title,
    split: outline.split,
    language: outline.language,
    words: chapters.reduce((sum, chapter) => sum + chapter.words, 0),
    target: outline.wordGoal,
    chapters: chapters.length,
    editedAt: outline.updatedAt,
  };
}

export function summarizeProject(writings: WritingSummary[]): ProjectSummary {
  return {
    words: writings.reduce((sum, writing) => sum + writing.words, 0),
    editedAt: writings.reduce((latest, writing) => (writing.editedAt > latest ? writing.editedAt : latest), ""),
    writings,
  };
}

/**
 * How far along a writing is, from 0 to 1: its words against its target, or 0 when it has none. Chapter
 * statuses, which it once counted too, are dropped (owner, 12 October).
 */
export function bookProgress(summary: Pick<WritingSummary, "target" | "words">): number {
  return summary.target > 0 ? Math.min(1, summary.words / summary.target) : 0;
}
