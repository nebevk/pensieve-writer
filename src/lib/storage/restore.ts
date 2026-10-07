import type { Chapter, ChapterStatus, Writing, WritingLanguage } from "$lib/model";
import { emptyDocument } from "$lib/model";
import type { Note, Task } from "./organize";

/**
 * What a local snapshot of a writing holds, with the project's notes and to-dos. Snapshots taken before
 * notes were included have no `notes` or `tasks`, and ones from before writings had a "Split into
 * chapters" switch have no `split` or `wordGoal`.
 */
export type SnapshotPayload = {
  title: string;
  language?: WritingLanguage;
  split?: boolean;
  wordGoal?: number;
  chapters: Chapter[];
  notes?: Note[];
  tasks?: Task[];
};

export function snapshotPayload(writing: Writing, notes: Note[], tasks: Task[]): SnapshotPayload {
  return {
    title: writing.title,
    language: writing.language,
    split: writing.split,
    wordGoal: writing.wordGoal,
    chapters: writing.chapters,
    notes,
    tasks,
  };
}

/** The notes or to-dos from a snapshot or backup that the project no longer has. */
export function missingItems<T extends { id: string }>(items: T[] | undefined, existingIds: Iterable<string>): T[] {
  if (!Array.isArray(items)) return [];
  const have = new Set(existingIds);
  return items.filter((item) => item && typeof item.id === "string" && !have.has(item.id));
}

export function normalizeNote(note: Note, projectId: string, now = new Date().toISOString()): Note {
  const category =
    note.category === "characters" || note.category === "places" || note.category === "research"
      ? note.category
      : "ideas";
  const todoState =
    note.todoState === "todo" || note.todoState === "doing" || note.todoState === "done" ? note.todoState : null;
  return {
    id: note.id,
    projectId,
    title: typeof note.title === "string" ? note.title : "Untitled note",
    contentJson: note.contentJson?.type === "doc" ? note.contentJson : emptyDocument(),
    plainText: typeof note.plainText === "string" ? note.plainText : "",
    category,
    tags: typeof note.tags === "string" ? note.tags : "",
    aliases: typeof note.aliases === "string" ? note.aliases : "",
    fields: Array.isArray(note.fields) ? note.fields : [],
    todoState,
    chapterIds: Array.isArray(note.chapterIds) ? note.chapterIds : [],
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || now,
  };
}

export function normalizeTask(task: Task, projectId: string, now = new Date().toISOString()): Task {
  const todoState = task.todoState === "doing" || task.todoState === "done" ? task.todoState : "todo";
  return {
    id: task.id,
    projectId,
    title: typeof task.title === "string" ? task.title : "",
    todoState,
    updatedAt: task.updatedAt || now,
    chapterId: typeof task.chapterId === "string" ? task.chapterId : "",
    noteId: typeof task.noteId === "string" ? task.noteId : "",
  };
}

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

/**
 * A writing put back as it was in a snapshot. One that was split into chapters then comes back split,
 * even if it is one page now; an old snapshot without the switch keeps the writing's own, unless it
 * holds several chapters, which a one-page writing can't show.
 */
export function writingFromSnapshot(
  current: Writing,
  payload: { title?: string; language?: string; split?: boolean; wordGoal?: number; chapters: Chapter[] },
  now = new Date().toISOString(),
): Writing {
  const split = (typeof payload.split === "boolean" ? payload.split : current.split) || payload.chapters.length > 1;
  return {
    ...current,
    title: payload.title || current.title,
    language: payload.language === "sl" ? "sl" : payload.language === "en" ? "en" : current.language,
    split,
    wordGoal: Number.isFinite(payload.wordGoal) ? Number(payload.wordGoal) : current.wordGoal,
    updatedAt: now,
    chapters: payload.chapters.map((chapter) => ({ ...normalizeChapter(chapter), writingId: current.id })),
  };
}

/**
 * A writing after restoring a Drive backup of it. It keeps its own id, so the backup's chapters come
 * into the open file even when the backup came from another computer. A backup from before writings
 * had the "Split into chapters" switch says what kind of book it was: an article was one page.
 */
export function writingFromBackup(
  current: Writing,
  saved: Pick<Writing, "title" | "chapters"> & Partial<Pick<Writing, "language" | "wordGoal" | "split">> & { kind?: unknown },
  now = new Date().toISOString(),
): Writing {
  const language = saved.language === "sl" || saved.language === "en" ? saved.language : current.language;
  const said = typeof saved.split === "boolean" ? saved.split : typeof saved.kind === "string" ? saved.kind !== "article" : current.split;
  return {
    ...current,
    title: saved.title || current.title,
    language,
    split: said || saved.chapters.length > 1,
    wordGoal: Number.isFinite(saved.wordGoal) ? Number(saved.wordGoal) : current.wordGoal,
    updatedAt: now,
    chapters: saved.chapters.map((chapter, index) => ({
      ...normalizeChapter(chapter),
      writingId: current.id,
      position: Number.isFinite(chapter.position) ? chapter.position : index,
    })),
  };
}

export function withRestoredChapter(current: Writing, older: Chapter, now = new Date().toISOString()): Writing {
  const chapter = { ...normalizeChapter(older), writingId: current.id };
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
