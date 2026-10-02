import { createChapter, type Chapter, type Project } from "$lib/model";

export function patchChapter(
  project: Project,
  id: string,
  patch: Partial<Chapter>,
  now = new Date().toISOString(),
): Project {
  return {
    ...project,
    chapters: project.chapters.map((chapter) =>
      chapter.id === id ? { ...chapter, ...patch, updatedAt: now } : chapter,
    ),
  };
}

export function setChapterText(project: Project, id: string, plainText: string): Project {
  const current = project.chapters.find((chapter) => chapter.id === id);
  if (!current || current.plainText === plainText) return project;
  return {
    ...project,
    chapters: project.chapters.map((chapter) => (chapter.id === id ? { ...chapter, plainText } : chapter)),
  };
}

export function renameChapterProject(project: Project, id: string, title: string, now = new Date().toISOString()): Project {
  return patchChapter(project, id, { title }, now);
}

export function duplicateChapterProject(
  project: Project,
  id: string,
  now = new Date().toISOString(),
): { project: Project; activeId: string } | null {
  const source = project.chapters.find((chapter) => chapter.id === id);
  if (!source) return null;
  const copy = createChapter(project.id, `${source.title} copy`, source.position + 1, now);
  copy.contentJson = structuredClone(source.contentJson);
  copy.plainText = source.plainText;
  copy.synopsis = source.synopsis;
  copy.language = source.language;
  copy.status = source.status;
  copy.wordGoal = source.wordGoal;
  copy.part = source.part;
  const chapters = project.chapters.map((chapter) =>
    chapter.position > source.position ? { ...chapter, position: chapter.position + 1 } : chapter,
  );
  chapters.push(copy);
  return { project: { ...project, chapters }, activeId: copy.id };
}

export function removeChapter(project: Project, id: string): { project: Project; activeId: string | null } | null {
  if (project.chapters.length < 2) return null;
  const chapters = project.chapters
    .filter((chapter) => chapter.id !== id)
    .sort((a, b) => a.position - b.position)
    .map((chapter, index) => ({ ...chapter, position: index }));
  return { project: { ...project, chapters }, activeId: chapters[0]?.id ?? null };
}

export function reorderChapterList(project: Project, draggedId: string, targetId: string): Project | null {
  if (draggedId === targetId) return null;
  const ordered = [...project.chapters].sort((a, b) => a.position - b.position);
  const from = ordered.findIndex((chapter) => chapter.id === draggedId);
  const to = ordered.findIndex((chapter) => chapter.id === targetId);
  if (from < 0 || to < 0) return null;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  return {
    ...project,
    chapters: ordered.map((chapter, index) => ({ ...chapter, position: index })),
  };
}
