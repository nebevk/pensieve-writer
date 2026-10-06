export type DocumentJson = {
  type: string;
  content?: unknown[];
};

export type ChapterStatus = "draft" | "revised" | "final";

export type WritingLanguage = "en" | "sl";

export type ProjectKind = "novel" | "stories" | "article";

export type Chapter = {
  id: string;
  projectId: string;
  title: string;
  position: number;
  contentJson: DocumentJson;
  plainText: string;
  synopsis: string;
  status: ChapterStatus;
  /** Empty means “use the project language”. */
  language: "" | WritingLanguage;
  wordGoal: number;
  /** Empty means the chapter sits outside a part. */
  part: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  language: WritingLanguage;
  kind: ProjectKind;
  /** Words planned for the whole book; 0 means Home adds up the chapter goals instead. */
  wordGoal: number;
  chapters: Chapter[];
};

export type SnapshotInfo = {
  id: string;
  projectId: string;
  createdAt: string;
  kind: "hourly" | "daily" | "manual" | "before-restore";
};

export function effectiveLanguage(project: Project, chapter: Chapter | null): WritingLanguage {
  if (chapter?.language === "en" || chapter?.language === "sl") return chapter.language;
  return project.language === "sl" ? "sl" : "en";
}

export function emptyDocument(): DocumentJson {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function createProject(): Project {
  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  return {
    id: projectId,
    title: "Untitled",
    language: "en",
    kind: "novel",
    wordGoal: 0,
    createdAt: now,
    updatedAt: now,
    chapters: [createChapter(projectId, "Chapter 1", 0, now)],
  };
}

export function createChapter(
  projectId: string,
  title: string,
  position: number,
  now = new Date().toISOString(),
): Chapter {
  return {
    id: crypto.randomUUID(),
    projectId,
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
