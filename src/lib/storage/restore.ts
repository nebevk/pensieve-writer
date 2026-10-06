import type { Chapter, ChapterStatus, Project, WritingLanguage } from "$lib/model";
import { emptyDocument } from "$lib/model";
import type { Note, Task } from "./organize";

/** What a local snapshot holds. Snapshots taken before notes were included have no `notes` or `tasks`. */
export type SnapshotPayload = {
  title: string;
  language?: WritingLanguage;
  chapters: Chapter[];
  notes?: Note[];
  tasks?: Task[];
};

export function snapshotPayload(project: Project, notes: Note[], tasks: Task[]): SnapshotPayload {
  return {
    title: project.title,
    language: project.language,
    chapters: project.chapters,
    notes,
    tasks,
  };
}

/** The notes or to-dos from a snapshot or backup that the book no longer has. */
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

/**
 * The open book after restoring a Drive backup into it. The book keeps its own id, so the
 * backup's chapters move into the open file even when the backup came from another computer.
 */
export function projectFromBackup(
  current: Project,
  saved: Pick<Project, "title" | "chapters"> & Partial<Pick<Project, "language" | "kind" | "wordGoal">>,
  now = new Date().toISOString(),
): Project {
  const kind = saved.kind === "novel" || saved.kind === "stories" || saved.kind === "article" ? saved.kind : current.kind;
  const language = saved.language === "sl" || saved.language === "en" ? saved.language : current.language;
  return {
    ...current,
    title: saved.title || current.title,
    language,
    kind,
    wordGoal: Number.isFinite(saved.wordGoal) ? Number(saved.wordGoal) : current.wordGoal,
    updatedAt: now,
    chapters: saved.chapters.map((chapter, index) => ({
      ...normalizeChapter(chapter),
      projectId: current.id,
      position: Number.isFinite(chapter.position) ? chapter.position : index,
    })),
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
