import type { Chapter, ChapterStatus, DocumentJson, Project } from "$lib/model";
import type { Note, NoteCategory, Task, TodoState } from "$lib/storage/organize";
import { proseText } from "./examples";

/**
 * A long book for timing typing on the writer's laptop (IMP-10): fifteen chapters of about ten
 * thousand words each, made from a few dozen sentences in a fixed order, with notes whose names
 * appear in the text and to-dos across the chapters. The same book comes out every time.
 */

export const LONG_BOOK_SLUG = "long-test-book";

const CHAPTERS = 15;
const WORDS_PER_CHAPTER = 10_000;

type Cast = { title: string; call: string; category: NoteCategory; line: string; fields?: [string, string][] };

const CAST: Cast[] = [
  { title: "Ana Novak", call: "Ana", category: "characters", line: "Restorer, thirty-four, back in the house after twelve years.", fields: [["Age", "34"], ["Wants", "To sell the house"]] },
  { title: "Vera Novak", call: "Vera", category: "characters", line: "Ana's mother. Answers questions with chores.", fields: [["Lives", "The ground floor"]] },
  { title: "Marija Kos", call: "Marija", category: "characters", line: "The grandmother who kept the keys.", fields: [["Died", "March"]] },
  { title: "Lojze Brod", call: "Lojze", category: "characters", line: "Ferryman. Never takes money for the crossing." },
  { title: "Nika Mlinar", call: "Nika", category: "characters", line: "The miller's daughter, home from the city to sell the mill." },
  { title: "Tomaž Kos", call: "Tomaž", category: "characters", line: "Marija's brother, who left and wrote once a year." },
  { title: "The attic", call: "the attic", category: "places", line: "Low beams, one round window over the river." },
  { title: "The mill", call: "the mill", category: "places", line: "Empty for thirty years; the water still runs under it." },
  { title: "The ferry", call: "the ferry", category: "places", line: "A flat boat on a cable, older than the bridge." },
  { title: "The orchard", call: "the orchard", category: "places", line: "Apples nobody picks, and a bench nobody sits on." },
];

const PEOPLE = CAST.filter((who) => who.category === "characters").map((who) => who.call);
const PLACES = CAST.filter((who) => who.category === "places").map((who) => who.call);

const SENTENCES = [
  "{p} stood at the window and watched the river take the last of the light.",
  "Nobody in the house spoke of {q} after that winter, and nobody asked why.",
  "The keys were cold in {p}'s pocket, heavier than they had any right to be.",
  "Somewhere below, a door opened and closed again, as if the house were breathing in its sleep.",
  "{p} counted the stairs out of habit: eleven, and the twelfth that creaked.",
  "Rain came over {q} in long grey sheets and went on without a pause until evening.",
  "There was a letter on the kitchen table that nobody had opened.",
  "“You knew,” {p} said quietly. “You knew all along, and you let me find out like this.”",
  "The lamp in the upstairs window burned as it always had, steady and a little too yellow.",
  "{p} found the photograph between the pages of an old almanac, face down.",
  "By noon the fog had lifted from {q}, and the village came back piece by piece.",
  "It was the kind of silence that has a shape, and {p} could feel its edges in the dark.",
  "Every summer the swallows came back to the eaves above {q}, as if nothing had changed.",
  "{p} wrote the date at the top of the page and then nothing at all for a long time.",
  "The smell of apples and woodsmoke had not changed in twenty years.",
  "Later, {p} would remember the sound of it more clearly than the words.",
  "“Leave it,” said {p}. “Some things are better left where they are.”",
  "The clock in the hall had stopped at ten past four, and no one had wound it since.",
  "{p} went down to {q} with a torch and came back without saying what was there.",
  "In the morning the river was high and brown, and the ferry did not cross.",
  "A dog barked twice across the water and then was still.",
  "{p} put the kettle on, took it off again, and sat with both hands flat on the table.",
  "The path to {q} was overgrown, but the stones were still where they had always been.",
  "“Tell me the truth,” {p} said, “just once, and then I will stop asking.”",
];

/** A small, fixed random sequence, so the book is the same every time it is made. */
function sequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function chapterDocument(index: number): DocumentJson {
  const next = sequence(index + 1);
  const pick = <T>(items: T[]) => items[Math.floor(next() * items.length)];
  const paragraphs: string[] = [];
  let words = 0;
  while (words < WORDS_PER_CHAPTER) {
    const sentences: string[] = [];
    const length = 4 + Math.floor(next() * 5);
    for (let i = 0; i < length; i += 1) {
      const sentence = pick(SENTENCES).replaceAll("{p}", pick(PEOPLE)).replaceAll("{q}", pick(PLACES));
      sentences.push(sentence);
      words += sentence.split(/\s+/).length;
    }
    paragraphs.push(sentences.join(" "));
  }
  return { type: "doc", content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })) };
}

function statusOf(index: number): ChapterStatus {
  return index < 5 ? "final" : index < 10 ? "revised" : "draft";
}

/** The long book, its notes and its to-dos, for a book file whose project id is `projectId`. */
export function buildLongBook(
  projectId: string,
  title: string,
  chapterName: (n: number) => string,
  now = new Date().toISOString(),
): { project: Project; notes: Note[]; tasks: Task[] } {
  const parts = ["Part One", "Part Two", "Part Three"];
  const chapters: Chapter[] = Array.from({ length: CHAPTERS }, (_, index) => {
    const contentJson = chapterDocument(index);
    return {
      id: crypto.randomUUID(),
      projectId,
      title: chapterName(index + 1),
      position: index,
      contentJson,
      plainText: proseText(contentJson),
      synopsis: "",
      status: statusOf(index),
      language: "",
      wordGoal: WORDS_PER_CHAPTER,
      part: parts[Math.floor(index / 5)],
      updatedAt: now,
    };
  });
  const notes: Note[] = CAST.map((who, index) => ({
    id: crypto.randomUUID(),
    projectId,
    title: who.title,
    contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: who.line }] }] },
    plainText: who.line,
    category: who.category,
    tags: "",
    aliases: "",
    fields: (who.fields ?? []).map(([key, value]) => ({ key, value })),
    todoState: null,
    chapterIds: [chapters[index % CHAPTERS].id],
    createdAt: now,
    updatedAt: now,
  }));
  const states: TodoState[] = ["todo", "todo", "doing", "done"];
  const tasks: Task[] = Array.from({ length: 40 }, (_, index) => ({
    id: crypto.randomUUID(),
    projectId,
    title: `Check chapter ${(index % CHAPTERS) + 1}: ${["timeline", "names", "the weather", "dialogue", "the ending"][index % 5]}`,
    todoState: states[index % states.length],
    updatedAt: now,
    chapterId: index % 8 === 7 ? "" : chapters[index % CHAPTERS].id,
    noteId: index % 3 === 0 ? notes[index % notes.length].id : "",
  }));
  return {
    project: {
      id: projectId,
      title,
      kind: "novel",
      language: "en",
      wordGoal: CHAPTERS * WORDS_PER_CHAPTER,
      createdAt: now,
      updatedAt: now,
      chapters,
    },
    notes,
    tasks,
  };
}
