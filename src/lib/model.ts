export type DocumentJson = {
  type: string;
  content?: unknown[];
};

export type Chapter = {
  id: string;
  projectId: string;
  title: string;
  position: number;
  contentJson: DocumentJson;
  plainText: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
};

export type SnapshotInfo = {
  id: string;
  projectId: string;
  createdAt: string;
};

export function emptyDocument(): DocumentJson {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function createProject(): Project {
  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  return {
    id: projectId,
    title: "Untitled",
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
    updatedAt: now,
  };
}
