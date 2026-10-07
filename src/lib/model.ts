export type DocumentJson = {
  type: string;
  content?: unknown[];
};

export type ChapterStatus = "draft" | "revised" | "final";

export type WritingLanguage = "en" | "sl";

export type Chapter = {
  id: string;
  /** The writing the chapter belongs to. */
  writingId: string;
  title: string;
  position: number;
  contentJson: DocumentJson;
  plainText: string;
  synopsis: string;
  status: ChapterStatus;
  /** Empty means “use the writing's language”. */
  language: "" | WritingLanguage;
  wordGoal: number;
  /** Empty means the chapter sits outside a part. */
  part: string;
  updatedAt: string;
};

/**
 * One writing (a book, a story, an article) as the editor opens it: its chapters and its own settings.
 * A project holds any number of writings in one file, with the notes and to-dos they share.
 */
export type Writing = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  language: WritingLanguage;
  /** "Split into chapters": on, a Heading 2 starts a new chapter; off, the writing is one page. */
  split: boolean;
  /** Words planned for the whole writing; 0 means Home adds up the chapter goals instead. */
  wordGoal: number;
  chapters: Chapter[];
};

/** A chapter as the library's tree shows it, without its text. */
export type ChapterOutline = {
  id: string;
  title: string;
  part: string;
  position: number;
  status: ChapterStatus;
  words: number;
  empty: boolean;
};

/** A writing as the library's tree and Home show it, without its text. */
export type WritingOutline = {
  id: string;
  title: string;
  /** The folder it sits in inside the project ("Drafts"); empty for none. */
  folder: string;
  position: number;
  split: boolean;
  language: WritingLanguage;
  wordGoal: number;
  /** When it was put in the Deleted folder; empty while it isn't there. */
  deletedAt: string;
  /** When it was last opened, and the chapter open then. */
  openedAt: string;
  openedChapter: string;
  updatedAt: string;
  chapters: ChapterOutline[];
};

/**
 * The open project as its file holds it: the id its notes and to-dos are saved under, its name, its
 * writing folders (kept even while empty) and its writings, in order.
 */
export type Shelf = {
  projectId: string;
  title: string;
  folders: string[];
  writings: WritingOutline[];
};

export type SnapshotInfo = {
  id: string;
  writingId: string;
  createdAt: string;
  kind: "hourly" | "daily" | "manual" | "before-restore";
};

export function effectiveLanguage(writing: Pick<Writing, "language">, chapter: Chapter | null): WritingLanguage {
  if (chapter?.language === "en" || chapter?.language === "sl") return chapter.language;
  return writing.language === "sl" ? "sl" : "en";
}

export function emptyDocument(): DocumentJson {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function createWriting(title = "Untitled", chapterTitle = "Chapter 1"): Writing {
  const now = new Date().toISOString();
  const writingId = crypto.randomUUID();
  return {
    id: writingId,
    title,
    language: "en",
    split: true,
    wordGoal: 0,
    createdAt: now,
    updatedAt: now,
    chapters: [createChapter(writingId, chapterTitle, 0, now)],
  };
}

export function createChapter(
  writingId: string,
  title: string,
  position: number,
  now = new Date().toISOString(),
): Chapter {
  return {
    id: crypto.randomUUID(),
    writingId,
    title,
    position,
    contentJson: emptyDocument(),
    plainText: "",
    synopsis: "",
    status: "draft",
    language: "",
    wordGoal: 0,
    part: "",
    updatedAt: now,
  };
}
