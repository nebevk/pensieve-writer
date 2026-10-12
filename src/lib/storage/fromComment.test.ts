import { describe, expect, it } from "vitest";
import type { CommentInfo } from "$lib/editor/comments";
import { ideaNote, namesANote, noteFromComment, noteFromWords, todoFromComment } from "./fromComment";

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

describe("a note from selected words", () => {
  it("is named by a short selection, such as a name, and left empty to write in", () => {
    const note = noteFromWords("  Marija Kos ", "p", "ch1", now);
    expect(note).toMatchObject({ title: "Marija Kos", plainText: "", category: "ideas", chapterIds: ["ch1"] });
    expect(note.contentJson.content).toEqual([{ type: "paragraph" }]);
  });

  it("quotes a passage, named by its first words, with room to write under it", () => {
    const passage = "Ana read it twice at the workbench, between a chair with a cracked rail and a cabinet.\nShe had not been back in twelve years.";
    const note = noteFromWords(passage, "p", "ch1", now);
    expect(note.title).toBe("Ana read it twice at the workbench, between a chair with a…");
    expect(note.plainText).toBe("Ana read it twice at the workbench, between a chair with a cracked rail and a cabinet.\n\nShe had not been back in twelve years.");
    expect(note.contentJson.content?.[0]).toMatchObject({ type: "blockquote" });
    expect((note.contentJson.content?.[0] as { content?: unknown[] }).content).toHaveLength(2);
    expect(note.contentJson.content?.[1]).toEqual({ type: "paragraph" });
  });

  it("takes words over two lines, or past 60 letters, as a passage; č, š and ž count as letters", () => {
    expect(namesANote("Ana\nMarija")).toBe(false);
    expect(namesANote("a".repeat(61))).toBe(false);
    expect(namesANote("Čez reko, Špela in Žiga")).toBe(true);
    expect(noteFromWords("Ana\nMarija", "p", "", now)).toMatchObject({ title: "Ana…", chapterIds: [] });
  });
});

describe("a quick idea", () => {
  it("is a note among Ideas, tied to no chapter, named by a short idea", () => {
    const idea = ideaNote("  Stara hiša ob reki  ", "p", now);
    expect(idea).toMatchObject({ projectId: "p", title: "Stara hiša ob reki", category: "ideas", chapterIds: [], plainText: "", createdAt: now });
    expect(idea.contentJson).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("keeps the lines under a short first line as its text", () => {
    const idea = ideaNote("Čarovnica\nŽivi pri mlinu.\n\nNihče ne ve, od kdaj.", "p", now);
    expect(idea.title).toBe("Čarovnica");
    expect(idea.plainText).toBe("Živi pri mlinu.\n\nNihče ne ve, od kdaj.");
    expect(idea.contentJson.content).toHaveLength(2);
  });

  it("names a long one by its first words, cut at a word, and keeps all of it", () => {
    const long = "Kaj če bi Ana našla pismo, ki ga je babica skrila za ogledalo v spalnici, in ga prebrala šele po pogrebu";
    const idea = ideaNote(long, "p", now);
    expect(idea.title.endsWith("…")).toBe(true);
    expect(idea.title.length).toBeLessThanOrEqual(60);
    expect(long.startsWith(idea.title.slice(0, -1))).toBe(true);
    expect(idea.plainText).toBe(long);
  });
});
