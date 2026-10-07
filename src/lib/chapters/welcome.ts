import { createChapter, type Chapter, type DocumentJson } from "$lib/model";
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

/** Whether a chapter is the welcome page a new book starts with, going by its title in either language. */
export function isWelcomePage(chapter: Pick<Chapter, "title">): boolean {
  const title = chapter.title.trim();
  return (["en", "sl"] as const).some((language) => translate(language, "welcomeTitle") === title);
}

/** The welcome page's title; a one-page writing's page carries the writing's own title. */
export function openingTitle(split: boolean, title: string, language: UiLanguage = "en"): string {
  if (!split) return title || translate(language, "articleTitle");
  return translate(language, "welcomeTitle");
}

/** The title a new chapter starts with, in the writing's language: "Chapter 3", "Poglavje 3". */
export function chapterTitle(language: UiLanguage, n: number): string {
  return translate(language, "defaultChapter", { n });
}

/**
 * What the first writing of a new library starts with: the welcome page, in the interface language,
 * then an empty chapter (a one-page writing is the welcome page alone).
 */
export function firstChapters(writingId: string, split: boolean, title: string, language: UiLanguage = "en"): Chapter[] {
  const now = new Date().toISOString();
  const welcome: Chapter = {
    ...createChapter(writingId, openingTitle(split, title, language), 0, now),
    contentJson: welcomeDocument(split, language),
    plainText: welcomePlain(split, language),
  };
  return split ? [welcome, createChapter(writingId, chapterTitle(language, 1), 1, now)] : [welcome];
}

/** What a new writing starts with: one empty chapter, or one empty page titled with the writing's title. */
export function newWritingChapters(writingId: string, split: boolean, title: string, language: UiLanguage = "en"): Chapter[] {
  return [createChapter(writingId, split ? chapterTitle(language, 1) : title, 0)];
}
