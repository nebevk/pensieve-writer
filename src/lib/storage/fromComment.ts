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
    fields: [],
    todoState: null,
    chapterIds: [chapterId],
    createdAt: now,
    updatedAt: now,
  };
}
