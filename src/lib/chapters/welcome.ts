import { createChapter, type Chapter, type DocumentJson, type ProjectKind } from "$lib/model";
import { translate, type UiLanguage } from "$lib/i18n";

export function welcomePlain(canDelete = true, language: UiLanguage = "en"): string {
  return [
    translate(language, "welcomeFirst"),
    translate(language, "welcomeChapters"),
    translate(language, "welcomeZen"),
    translate(language, canDelete ? "welcomeDelete" : "welcomeErase"),
  ].join("\n");
}

export function welcomeDocument(canDelete = true, language: UiLanguage = "en"): DocumentJson {
  return {
    type: "doc",
    content: welcomePlain(canDelete, language)
      .split("\n")
      .map((text) => ({
        type: "paragraph",
        content: [{ type: "text", text }],
      })),
  };
}

export function openingTitle(kind: ProjectKind, bookTitle: string, language: UiLanguage = "en"): string {
  if (kind === "article") return bookTitle || translate(language, "articleTitle");
  return translate(language, "welcomeTitle");
}

/** The title a new chapter starts with, in the book's language: "Chapter 3", "Zgodba 3". */
export function chapterTitle(kind: ProjectKind, language: UiLanguage, n: number): string {
  return translate(language, kind === "stories" ? "defaultStory" : "defaultChapter", { n });
}

/**
 * What a new book starts with: the welcome page, in the interface language, then an empty chapter
 * (an article is one page).
 */
export function firstChapters(projectId: string, kind: ProjectKind, bookTitle: string, language: UiLanguage = "en"): Chapter[] {
  const now = new Date().toISOString();
  const welcome: Chapter = {
    ...createChapter(projectId, openingTitle(kind, bookTitle, language), 0, now),
    contentJson: welcomeDocument(kind !== "article", language),
    plainText: welcomePlain(kind !== "article", language),
  };
  return kind === "article" ? [welcome] : [welcome, createChapter(projectId, chapterTitle(kind, language, 1), 1, now)];
}
