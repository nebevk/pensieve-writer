import { wordsFor } from "$lib/editor/counts";
import type { ChapterStatus, Project, ProjectKind, WritingLanguage } from "$lib/model";

/** What a book's Home card shows. Kept with the remembered books, so cards of closed books show it too. */
export type BookSummary = {
  kind: ProjectKind;
  language: WritingLanguage;
  words: number;
  /** Words planned: the book target, or else the chapter goals added up; 0 when there's neither. */
  target: number;
  chapters: number;
  /** Chapters marked final. */
  finished: number;
  /** The first chapter's status, which is the whole article's. */
  status: ChapterStatus;
  editedAt: string;
};

export function summarize(project: Project): BookSummary {
  const chapters = [...project.chapters].sort((a, b) => a.position - b.position);
  const goals = chapters.reduce((sum, chapter) => sum + (chapter.wordGoal > 0 ? chapter.wordGoal : 0), 0);
  return {
    kind: project.kind,
    language: project.language,
    // Home asks for this whenever the book changes; a chapter whose text did not change is not counted again.
    words: chapters.reduce((sum, chapter) => sum + wordsFor(chapter.id, chapter.plainText), 0),
    target: project.wordGoal > 0 ? project.wordGoal : goals,
    chapters: chapters.length,
    finished: chapters.filter((chapter) => chapter.status === "final").length,
    status: chapters[0]?.status ?? "draft",
    editedAt: chapters.reduce((latest, chapter) => (chapter.updatedAt > latest ? chapter.updatedAt : latest), ""),
  };
}

/**
 * How far along a book is, from 0 to 1: words against the target when there is one. Without a target,
 * a collection counts its finished stories, and an article goes by its status.
 */
export function bookProgress(summary: BookSummary): number {
  if (summary.target > 0) return Math.min(1, summary.words / summary.target);
  if (summary.kind === "article") {
    if (summary.status === "final") return 1;
    if (summary.status === "revised") return 2 / 3;
    return summary.words > 0 ? 1 / 3 : 0;
  }
  return summary.chapters === 0 ? 0 : summary.finished / summary.chapters;
}
