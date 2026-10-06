import { describe, expect, it } from "vitest";
import type { CommentInfo } from "$lib/editor/comments";
import { noteFromComment, todoFromComment } from "./fromComment";

const now = "2026-10-05T12:00:00.000Z";
const comment = (text: string, quote: string): CommentInfo => ({ id: "c", text, createdAt: now, from: 1, to: 2, quote });

describe("turning a comment into a to-do or a note", () => {
  it("makes a to-do for the chapter from what the comment says", () => {
    const task = todoFromComment(comment("Check the date of the letter", "in March"), "p", "ch1", now);
    expect(task).toMatchObject({ projectId: "p", chapterId: "ch1", title: "Check the date of the letter", todoState: "todo", noteId: "" });
  });

  it("names the to-do after the words when the comment is empty", () => {
    expect(todoFromComment(comment("  ", "the brass ring"), "p", "ch1", now).title).toBe("the brass ring");
  });

  it("names a note after the commented words, with the comment as its text", () => {
    const note = noteFromComment(comment("Where did it come from?\nAsk Vera.", "the brass ring"), "p", "ch1", now);
    expect(note.title).toBe("the brass ring");
    expect(note.chapterIds).toEqual(["ch1"]);
    expect(note.plainText).toBe("Where did it come from?\n\nAsk Vera.");
    expect(note.contentJson.content).toHaveLength(2);
  });

  it("quotes a long passage in the note and names it by the comment's first line", () => {
    const passage = "The keys hung on a nail behind the pantry door, eleven of them on a ring of brass.";
    const note = noteFromComment(comment("The keys\nWho hung them there?", passage), "p", "ch1", now);
    expect(note.title).toBe("The keys");
    expect(note.plainText).toContain(`“${passage}”`);
  });

  it("shortens a long passage into a title when the comment says nothing", () => {
    const passage = "Ana took them down the morning after the funeral and laid them out on the kitchen table.";
    const note = noteFromComment(comment("", passage), "p", "ch1", now);
    expect(note.title.endsWith("…")).toBe(true);
    expect(note.title.length).toBeLessThanOrEqual(60);
  });
});
