import { createChapter, type Chapter, type DocumentJson, type ProjectKind } from "$lib/model";

const LINES = [
  "This page is only here for the first sitting.",
  "Chapters live in the list on the left. Notes and to-dos open beside the page.",
  "Zen mode clears the desk. Backups are snapshot files in the folder you choose in Settings.",
];

export function welcomePlain(canDelete = true): string {
  const lines = LINES.slice(0, 3);
  lines.push(
    canDelete
      ? "Delete this page once you know your way around. The book keeps at least one chapter."
      : "Erase these lines when you start writing.",
  );
  return lines.join("\n");
}

export function welcomeDocument(canDelete = true): DocumentJson {
  return {
    type: "doc",
    content: welcomePlain(canDelete)
      .split("\n")
      .map((text) => ({
        type: "paragraph",
        content: [{ type: "text", text }],
      })),
  };
}

export function openingTitle(kind: ProjectKind, bookTitle: string): string {
  if (kind === "article") return bookTitle || "Article";
  if (kind === "stories") return "Welcome";
  return "Welcome";
}

export function nextTitle(kind: ProjectKind): string {
  return kind === "stories" ? "Story 1" : "Chapter 1";
}

/** What a new book starts with: the welcome page, then an empty chapter (an article is one page). */
export function firstChapters(projectId: string, kind: ProjectKind, bookTitle: string): Chapter[] {
  const now = new Date().toISOString();
  const welcome: Chapter = {
    ...createChapter(projectId, openingTitle(kind, bookTitle), 0, now),
    contentJson: welcomeDocument(kind !== "article"),
    plainText: welcomePlain(kind !== "article"),
  };
  return kind === "article" ? [welcome] : [welcome, createChapter(projectId, nextTitle(kind), 1, now)];
}
