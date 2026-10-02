import type { Chapter, ChapterStatus, Project, WritingLanguage } from "$lib/model";

export function normalizeChapter(chapter: Chapter): Chapter {
  const status: ChapterStatus =
    chapter.status === "revised" || chapter.status === "final" ? chapter.status : "draft";
  const language: "" | WritingLanguage =
    chapter.language === "en" || chapter.language === "sl" ? chapter.language : "";
  return {
    ...chapter,
    synopsis: chapter.synopsis ?? "",
    status,
    language,
    wordGoal: Number.isFinite(chapter.wordGoal) ? chapter.wordGoal : 0,
    part: chapter.part ?? "",
  };
}

export function projectFromSnapshot(
  current: Project,
  payload: { title?: string; language?: string; chapters: Chapter[] },
  now = new Date().toISOString(),
): Project {
  return {
    ...current,
    title: payload.title || current.title,
    language: payload.language === "sl" ? "sl" : current.language,
    updatedAt: now,
    chapters: payload.chapters.map(normalizeChapter),
  };
}

export function withRestoredChapter(current: Project, older: Chapter, now = new Date().toISOString()): Project {
  const chapter = normalizeChapter(older);
  const exists = current.chapters.some((item) => item.id === chapter.id);
  const chapters = exists
    ? current.chapters.map((item) => (item.id === chapter.id ? { ...chapter, position: item.position } : item))
    : [...current.chapters, { ...chapter, position: current.chapters.length }];
  return { ...current, chapters, updatedAt: now };
}

/** The text a restore drill compares, chapter by chapter. */
export function manuscriptText(project: { chapters: { plainText: string }[] }): string {
  return project.chapters.map((chapter) => chapter.plainText).join("\n");
}
