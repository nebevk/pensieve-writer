import { describe, expect, it } from "vitest";
import type { Note } from "$lib/storage/organize";
import { mentions, noteMentions, notesInChapter } from "./mentions";

function note(id: string, title: string, chapterIds: string[] = [], category: Note["category"] = "characters"): Note {
  return {
    id,
    projectId: "p",
    title,
    contentJson: { type: "doc", content: [] },
    plainText: "",
    category,
    tags: "",
    fields: [],
    todoState: null,
    chapterIds,
    createdAt: "",
    updatedAt: "",
  };
}

const linked = (words: string, noteId: string) => ({
  type: "text",
  text: words,
  marks: [{ type: "noteLink", attrs: { noteId, title: words } }],
});

describe("notes in a chapter", () => {
  it("counts a title as whole words, however it is written", () => {
    expect(mentions("Ana went out. ANA came back, and ana slept.", "Ana")).toBe(3);
    expect(mentions("Babica Marija je šivala. Marija!", "Marija")).toBe(2);
    expect(mentions("A banana for Ana, not for Anabel.", "Ana")).toBe(1);
    expect(mentions("Čaša in čaj", "čaj")).toBe(1);
    expect(mentions("Anything", "A")).toBe(0);
  });

  it("counts a character by the first word of the note's title", () => {
    const text = "Ana took the keys. Ana Novak signed. Later Ana slept.";
    expect(noteMentions(text, { title: "Ana Novak", category: "characters" })).toBe(3);
    expect(noteMentions("Vera answered. Vera left.", { title: "Vera, her mother", category: "characters" })).toBe(2);
    // Places and other notes need their whole title.
    expect(noteMentions("The attic was cold. The stairs creaked.", { title: "The attic", category: "places" })).toBe(1);
    expect(noteMentions("The stairs creaked.", { title: "The attic", category: "places" })).toBe(0);
  });

  it("lists mentioned, linked and attached notes, most mentioned first", () => {
    const chapter = {
      id: "ch1",
      plainText: "Ana took the keys. Ana climbed to the attic. Her grandmother had hung them there.",
      contentJson: {
        type: "doc",
        content: [{ type: "paragraph", content: [linked("Her grandmother", "gran"), linked("grandmother", "gran"), linked("again", "gran")] }],
      },
    };
    const notes = [note("ana", "Ana"), note("gran", "Grandmother Marija"), note("attic", "The attic", [], "places"), note("vera", "Vera", ["ch1"]), note("ferry", "The ferryman")];
    expect(notesInChapter(notes, chapter).map((here) => [here.note.id, here.count])).toEqual([
      ["gran", 3],
      ["ana", 2],
      ["attic", 1],
      ["vera", 0],
    ]);
  });
});
