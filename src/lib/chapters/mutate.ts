import { createChapter, type Chapter, type Writing } from "$lib/model";

export function patchChapter(
  writing: Writing,
  id: string,
  patch: Partial<Chapter>,
  now = new Date().toISOString(),
): Writing {
  return {
    ...writing,
    chapters: writing.chapters.map((chapter) =>
      chapter.id === id ? { ...chapter, ...patch, updatedAt: now } : chapter,
    ),
  };
}

export function setChapterText(writing: Writing, id: string, plainText: string): Writing {
  const current = writing.chapters.find((chapter) => chapter.id === id);
  if (!current || current.plainText === plainText) return writing;
  return {
    ...writing,
    chapters: writing.chapters.map((chapter) => (chapter.id === id ? { ...chapter, plainText } : chapter)),
  };
}

export function renameChapterIn(writing: Writing, id: string, title: string, now = new Date().toISOString()): Writing {
  return patchChapter(writing, id, { title }, now);
}

export function duplicateChapterIn(
  writing: Writing,
  id: string,
  now = new Date().toISOString(),
): { writing: Writing; activeId: string } | null {
  const source = writing.chapters.find((chapter) => chapter.id === id);
  if (!source) return null;
  const copy = createChapter(writing.id, `${source.title} copy`, source.position + 1, now);
  // A JSON copy: the open book is Svelte state, whose objects structuredClone refuses to copy.
  copy.contentJson = JSON.parse(JSON.stringify(source.contentJson)) as Writing["chapters"][number]["contentJson"];
  copy.plainText = source.plainText;
  copy.synopsis = source.synopsis;
  copy.language = source.language;
  copy.status = source.status;
  copy.wordGoal = source.wordGoal;
  copy.part = source.part;
  const chapters = writing.chapters.map((chapter) =>
    chapter.position > source.position ? { ...chapter, position: chapter.position + 1 } : chapter,
  );
  chapters.push(copy);
  return { writing: { ...writing, chapters }, activeId: copy.id };
}

export function removeChapter(writing: Writing, id: string): { writing: Writing; activeId: string | null } | null {
  if (writing.chapters.length < 2) return null;
  const chapters = writing.chapters
    .filter((chapter) => chapter.id !== id)
    .sort((a, b) => a.position - b.position)
    .map((chapter, index) => ({ ...chapter, position: index }));
  return { writing: { ...writing, chapters }, activeId: chapters[0]?.id ?? null };
}

export function reorderChapterList(writing: Writing, draggedId: string, targetId: string): Writing | null {
  if (draggedId === targetId) return null;
  const ordered = [...writing.chapters].sort((a, b) => a.position - b.position);
  const from = ordered.findIndex((chapter) => chapter.id === draggedId);
  const to = ordered.findIndex((chapter) => chapter.id === targetId);
  if (from < 0 || to < 0) return null;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  return {
    ...writing,
    chapters: ordered.map((chapter, index) => ({ ...chapter, position: index })),
  };
}
