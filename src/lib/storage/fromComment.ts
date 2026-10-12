import type { CommentInfo } from "$lib/editor/comments";
import type { Note, Task } from "./organize";

/** A to-do for the chapter, saying what the comment said, or naming its words when it said nothing. */
export function todoFromComment(comment: CommentInfo, projectId: string, chapterId: string, now: string): Task {
  return {
    id: crypto.randomUUID(),
    projectId,
    title: comment.text.trim() || comment.quote,
    todoState: "todo",
    updatedAt: now,
    chapterId,
    noteId: "",
  };
}

/** Whether words selected on the page are short enough to name a note (a person, a place), not to be quoted in one. */
export function namesANote(words: string): boolean {
  const text = words.trim();
  return text.length > 0 && text.length <= 60 && !text.includes("\n");
}

/**
 * A note from words selected on the page (owner, 12 October), tied to the chapter. Words short enough to
 * be a name name it and leave it empty to be written in; a longer passage is quoted in it, and its first
 * words name it.
 */
export function noteFromWords(words: string, projectId: string, chapterId: string, now: string): Note {
  const text = words.trim();
  const named = namesANote(text);
  const paragraphs = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const first = paragraphs[0] ?? "";
  const cut = first.length <= 60 ? first : first.slice(0, 59).replace(/\s+\S*$/, "");
  return {
    id: crypto.randomUUID(),
    projectId,
    title: named ? text : `${cut}…`,
    contentJson: {
      type: "doc",
      content: named
        ? [{ type: "paragraph" }]
        : [
            { type: "blockquote", content: paragraphs.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })) },
            { type: "paragraph" },
          ],
    },
    plainText: named ? "" : paragraphs.join("\n\n"),
    category: "ideas",
    tags: "",
    aliases: "",
    fields: [],
    todoState: null,
    chapterIds: chapterId ? [chapterId] : [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A note tied to the chapter. The commented words name it when they are short enough, which is how
 * a name or a place gets its note; a longer passage is quoted in the note and its first line names it.
 */
export function noteFromComment(comment: CommentInfo, projectId: string, chapterId: string, now: string): Note {
  const said = comment.text.trim();
  const quoteNames = comment.quote.length <= 60;
  const firstLine = said.split("\n")[0].trim();
  const title = quoteNames
    ? comment.quote
    : firstLine && firstLine.length <= 60
      ? firstLine
      : `${comment.quote.slice(0, 59).trimEnd()}…`;
  const lines = [...said.split(/\n+/).filter(Boolean), ...(quoteNames ? [] : [`“${comment.quote}”`])];
  return {
    id: crypto.randomUUID(),
    projectId,
    title,
    contentJson: {
      type: "doc",
      content:
        lines.length > 0
          ? lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] }))
          : [{ type: "paragraph" }],
    },
    plainText: lines.join("\n\n"),
    category: "ideas",
    tags: "",
    aliases: "",
    fields: [],
    todoState: null,
    chapterIds: [chapterId],
    createdAt: now,
    updatedAt: now,
  };
}
