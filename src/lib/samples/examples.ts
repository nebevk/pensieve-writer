import type { Chapter, ChapterStatus, DocumentJson, Project, ProjectKind, WritingLanguage } from "$lib/model";
import type { Note, NoteCategory, NoteField, Task, TodoState } from "$lib/storage/organize";

/**
 * Example books, one of each kind, so every screen has something to show: chapters in every
 * status, parts and goals, notes of every kind with [[links]], and to-dos in every state.
 * The novel follows the design system's sample story.
 */

type ExampleChapter = {
  key: string;
  title: string;
  status: ChapterStatus;
  synopsis: string;
  part?: string;
  wordGoal?: number;
  /** Lines of text: "## " heading, "> " quote, "* *" scene break, *italic* and **bold** inline. */
  lines: string[];
};

type ExampleNote = {
  key: string;
  title: string;
  category: NoteCategory;
  tags: string;
  fields?: NoteField[];
  lines: string[];
  chapters?: string[];
  todoState?: TodoState;
};

type ExampleTask = { title: string; state: TodoState; chapter?: string; note?: string };

export type ExampleBook = {
  slug: string;
  title: string;
  kind: ProjectKind;
  language: WritingLanguage;
  chapters: ExampleChapter[];
  notes: ExampleNote[];
  tasks: ExampleTask[];
};

type JsonNode = { type: string; text?: string; marks?: { type: string }[]; attrs?: Record<string, unknown>; content?: JsonNode[] };

function inline(text: string): JsonNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) return { type: "text", text: part.slice(2, -2), marks: [{ type: "bold" }] };
      if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
        return { type: "text", text: part.slice(1, -1), marks: [{ type: "italic" }] };
      }
      return { type: "text", text: part };
    });
}

/** Turns readable lines into an editor document. */
export function prose(lines: string[]): DocumentJson {
  const content: JsonNode[] = [];
  for (const line of lines) {
    if (line === "* *" || line === "* * *") {
      content.push({ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "* *" }] });
    } else if (line.startsWith("## ")) {
      content.push({ type: "heading", attrs: { level: 1 }, content: inline(line.slice(3)) });
    } else if (line.startsWith("> ")) {
      const last = content[content.length - 1];
      const paragraph = { type: "paragraph", content: inline(line.slice(2)) };
      if (last?.type === "blockquote") last.content?.push(paragraph);
      else content.push({ type: "blockquote", content: [paragraph] });
    } else {
      content.push({ type: "paragraph", content: inline(line) });
    }
  }
  return content.length > 0 ? { type: "doc", content } : { type: "doc", content: [{ type: "paragraph" }] };
}

/** The text the editor reports for a document, for word counts. */
export function proseText(doc: DocumentJson): string {
  const text = (node: JsonNode): string => node.text ?? (node.content ?? []).map(text).join("");
  return ((doc.content ?? []) as JsonNode[]).map(text).join("\n\n");
}

export const EXAMPLE_BOOKS: ExampleBook[] = [
  {
    slug: "the-lantern-house",
    title: "The Lantern House",
    kind: "novel",
    language: "en",
    chapters: [
      {
        key: "letter",
        title: "The Letter",
        status: "final",
        part: "Part One",
        wordGoal: 600,
        synopsis: "A letter from a notary calls Ana home after twelve years.",
        lines: [
          "The letter came on a Tuesday, in an envelope the colour of weak tea. Ana knew the handwriting before she knew the name on it, and for a long moment she did not open it at all.",
          "It was from a notary in Krško. Her grandmother had died in March. The house by the river was to be divided, the letter said, *in accordance with the wishes of the deceased*, and the family was asked to attend on the first of May.",
          "Ana read it twice at the workbench, between a chair with a cracked rail and a cabinet that would not close. Then she put it face down under a tin of beeswax, as if that would keep it quiet.",
          "She had not been back in twelve years. Not since the night her father drove away with the headlights off, and her mother stood in the kitchen and said nothing, the way she said nothing about everything.",
          "That evening she phoned her mother. Vera answered on the third ring.",
          "“So you got it,” Vera said.",
          "“I got it.”",
          "“The first of May,” said her mother, and then, after a silence long enough to hear the river behind her voice: “The lamp is still lit. Someone has to see to it.”",
        ],
      },
      {
        key: "fog",
        title: "Fog on the Sava",
        status: "final",
        part: "Part One",
        wordGoal: 600,
        synopsis: "Ana drives south through the fog and remembers the night her father left.",
        lines: [
          "The fog came down at Zidani Most and stayed with her all the way to Krško, so thick that the river was only a sound beside the road.",
          "Ana drove slowly. Her hands remembered the bends before her eyes did, and with every one of them a little more of the house came back: the warped third stair, the pantry that smelled of apples, the lamp in the upstairs window that her grandmother never let go out.",
          "* *",
          "Her father had left in fog like this. She had been twenty-two and home for the summer, and she had watched from the landing as his car rolled down to the road without a sound, the headlights switched off until the very last moment, as if leaving quietly made it less of a leaving.",
          "In the morning her mother made coffee for three and poured the third cup down the sink without a word.",
          "Now the lamp swam up out of the fog, exactly where it had always been. Ana pulled onto the gravel, turned off the engine and sat with her hands on the wheel until the windows went white.",
        ],
      },
      {
        key: "keys",
        title: "Grandmother's Keys",
        status: "revised",
        part: "Part Two",
        wordGoal: 800,
        synopsis: "Ana finds the ring of keys, and her mother sends her to the attic.",
        lines: [
          "The keys hung on a nail behind the pantry door, eleven of them on a ring of brass gone soft and brown with handling. Nobody in the family could say what half of them opened.",
          "Ana took them down the morning after the funeral. They were heavier than she expected, and colder, as if they had been waiting in the dark for someone to remember them.",
          "“Start with the attic,” her mother said from the kitchen, without turning around.",
          "Ana turned the ring over in her hands. Some of the keys she knew: the front door, the woodshed, the little one for the sewing box. Others had no lock left in the house to fit. One was long and black, with teeth like a comb, and it was *warm*, which made no sense at all.",
          "On the inside of the pantry door, just under the nail, someone had pencilled a line so faint she nearly missed it:",
          "> Some doors you open for the room, and some for the one who locked them.",
          "It was her grandmother's handwriting. Ana put the keys in her pocket and went to find the attic stairs.",
        ],
      },
      {
        key: "attic",
        title: "The Attic",
        status: "draft",
        part: "Part Two",
        wordGoal: 800,
        synopsis: "Under the round window, a trunk that none of the keys seem to fit.",
        lines: [
          "The attic was lower than she remembered, or she was taller. Dust hung in the light from the round window like something that had decided to stay.",
          "The trunk sat under the window, where it had always sat. Ana knelt and tried the keys one by one. None of them fit. The long black one did not even go in.",
          "She sat back on her heels and laughed, quietly, because there was no one to hear it.",
          "**Next:** what is in the trunk? Letters, or nothing at all?",
        ],
      },
      { key: "ferry", title: "Untitled", status: "draft", wordGoal: 800, synopsis: "", lines: [] },
    ],
    notes: [
      {
        key: "ana",
        title: "Ana Novak",
        category: "characters",
        tags: "34, restorer in Ljubljana",
        fields: [
          { key: "Age", value: "34" },
          { key: "Lives", value: "Ljubljana, alone, above the workshop" },
          { key: "Wants", value: "To sell the house and be done with it" },
          { key: "Fears", value: "Becoming her mother" },
        ],
        lines: [
          "Restores furniture for a living, so she notices hinges, locks and old varnish before faces. Has not been back to [[The Lantern House]] since her father left in 2009. Keeps [[Grandmother Marija]]'s letters unopened in a shoebox.",
        ],
        chapters: ["letter", "keys", "attic"],
      },
      {
        key: "vera",
        title: "Vera, her mother",
        category: "characters",
        tags: "Never goes upstairs",
        fields: [{ key: "Lives", value: "The Lantern House, ground floor" }],
        lines: ["Answers questions with chores. Has not climbed to [[The attic]] since the funeral, and won't say why."],
        chapters: ["letter", "keys"],
      },
      {
        key: "marija",
        title: "Grandmother Marija",
        category: "characters",
        tags: "Died in March; kept the keys",
        fields: [{ key: "Died", value: "March" }],
        lines: ["Kept the keys on a nail behind the pantry door. Wrote to [[Ana Novak]] every Christmas and never posted a single letter."],
        chapters: ["keys"],
      },
      {
        key: "house",
        title: "The Lantern House",
        category: "places",
        tags: "Riverside house near Krško",
        fields: [{ key: "Where", value: "Near Krško, on the Sava" }],
        lines: ["Riverside house with one lamp always lit in the upstairs window. The ferry landing is a short walk downstream. See [[The attic]]."],
        chapters: ["letter", "fog"],
      },
      {
        key: "attic",
        title: "The attic",
        category: "places",
        tags: "Low beams, one round window",
        lines: ["Low beams and one round window facing the river. The trunk sits under the window. Part of [[The Lantern House]]."],
        chapters: ["attic"],
      },
      {
        key: "trams",
        title: "Ljubljana trams, 1950s",
        category: "research",
        tags: "Routes, colours, fares",
        lines: ["Routes, colours and fares, for Vera's memory in chapter two. Ask at the city archive."],
      },
      {
        key: "ferryman",
        title: "The ferryman",
        category: "ideas",
        tags: "Rows people across at dusk",
        lines: ["An old man who rows people across at dusk and never takes money. Maybe he knew [[Grandmother Marija]]."],
        todoState: "todo",
      },
    ],
    tasks: [
      { title: "Decide which key opens the trunk", state: "todo", chapter: "keys" },
      { title: "Give Ana one habit she hides from Vera", state: "todo", note: "ana" },
      { title: "Check the ending of chapter 1 against the letter's date", state: "todo", chapter: "letter" },
      { title: "Find a name for the river ferryman", state: "todo" },
      { title: "Decide what Ana does with the letters", state: "doing", chapter: "attic", note: "ana" },
      { title: "Check 1950s Ljubljana tram routes", state: "doing", chapter: "keys", note: "trams" },
      { title: "Rename the mother", state: "done" },
      { title: "Settle Ana's age", state: "done", note: "ana" },
    ],
  },
  {
    slug: "zgodbe-ob-reki",
    title: "Zgodbe ob reki",
    kind: "stories",
    language: "sl",
    chapters: [
      {
        key: "brod",
        title: "Brod",
        status: "final",
        wordGoal: 400,
        synopsis: "Stari brodar prevaža ljudi čez reko in nikoli ne vzame denarja.",
        lines: [
          "Lojze je vozil ljudi čez reko, odkar je kdo pomnil. Vozil je ob vsakem vremenu, tudi ko je bila Sava rjava in hitra, in nikoli ni vzel denarja.",
          "»Reka si sama vzame, kar ji gre,« je rekel, kadar mu je kdo vseeno stisnil kovanec v roko. Kovanec je potem obležal na dnu čolna, med vrvmi in suhim listjem.",
          "Tisto jesen je čez reko prišla deklica z rdečim šalom. Ni povedala, kako ji je ime, in Lojze je ni vprašal. Sedla je na klop na kljunu čolna in gledala v meglo, kot da bi nekoga čakala.",
          "»Greš domov?« je vprašal sredi reke.",
          "»Ne,« je rekla. »Grem pogledat, če lučka še gori.«",
        ],
      },
      {
        key: "megla",
        title: "Megla nad Savo",
        status: "revised",
        wordGoal: 400,
        synopsis: "Ko megla prekrije vas, Marta sliši reko na napačni strani ceste.",
        lines: [
          "Megla je prišla ponoči in zjutraj je bila vas izgubljena. Iz nje so štrlele samo strehe in zvonik, kot da bi nekdo pozabil narisati vse ostalo.",
          "Marta je šla po kruh in se vrnila brez njega. Pot do pekarne je poznala na pamet, a tisti dan je bila daljša. Pravila je, da je slišala reko na *napačni* strani ceste.",
          "* *",
          "Zvečer je mož odprl okno in prisluhnil. Reka je bila tam, kjer je bila vedno. »Domišljaš si,« je rekel. Marta je molčala in si šal zavezala tesneje okoli vratu.",
        ],
      },
      {
        key: "mlin",
        title: "Mlinarjeva hči",
        status: "draft",
        wordGoal: 400,
        synopsis: "Mlinarjeva hči se vrne iz mesta, da bi prodala prazen mlin.",
        lines: [
          "Mlin je stal prazen že trideset let. Kolo se ni vrtelo, voda pa je še vedno tekla mimo, kot da bi čakala, da se kdo spomni nanjo.",
          "Nika se je vrnila iz mesta s kovčkom in z načrtom, da mlin proda. Načrt je trajal do prvega večera, ko je slišala, kako voda šumi pod podi.",
          "**Preveri:** ali stoji mlin na Savi ali na potoku?",
        ],
      },
      {
        key: "vlak",
        title: "Zadnji vlak",
        status: "draft",
        wordGoal: 400,
        synopsis: "Zgodba še čaka.",
        lines: ["Zadnji vlak iz Zidanega Mostu je imel vedno zamudo."],
      },
    ],
    notes: [
      {
        key: "lojze",
        title: "Lojze, brodar",
        category: "characters",
        tags: "Star brodar ob pristanu",
        fields: [
          { key: "Starost", value: "71" },
          { key: "Živi", value: "V koči ob pristanu" },
        ],
        lines: ["Ljudi prevaža čez reko ob mraku in nikoli ne vzame denarja. Pozna vsak vrtinec pri [[Pristan pri Krškem]]."],
        chapters: ["brod"],
      },
      {
        key: "pristan",
        title: "Pristan pri Krškem",
        category: "places",
        tags: "Lesen pomol pod vrbami",
        lines: ["Lesen pomol pod vrbami. Ob visoki vodi ga zalije do zadnje deske."],
        chapters: ["brod", "megla"],
      },
      {
        key: "poplava",
        title: "Poplava leta 1990",
        category: "research",
        tags: "Datumi in višina vode",
        lines: ["Preveri datume in višino vode za zgodbo Megla nad Savo. Vprašaj v arhivu v Krškem."],
        chapters: ["megla"],
      },
    ],
    tasks: [
      { title: "Preveri, ali je brod vozil še leta 1990", state: "doing", chapter: "brod", note: "poplava" },
      { title: "Skrajšaj konec zgodbe Megla nad Savo", state: "todo", chapter: "megla" },
      { title: "Odloči, ali je Nika mlinarjeva vnukinja", state: "todo", chapter: "mlin" },
      { title: "Izberi naslov zbirke", state: "done" },
    ],
  },
  {
    slug: "why-i-write-by-hand-first",
    title: "Why I write by hand first",
    kind: "article",
    language: "en",
    chapters: [
      {
        key: "article",
        title: "Why I write by hand first",
        status: "final",
        wordGoal: 400,
        synopsis: "Pen first, keyboard second, and why it takes longer but gets finished.",
        lines: [
          "I write the first draft of almost everything by hand. Not because I am against computers; I am typing this sentence on one. But a first draft is a different animal, and it behaves better on paper.",
          "## The pen is slow, and that helps",
          "A pen is slower than my thoughts, which sounds like a problem and turns out to be the point. By the time a sentence reaches the end of the nib, I have already argued with it once. Half of my editing happens on the way to the page.",
          "## Paper doesn't keep score",
          "A blank document counts words, underlines spelling and offers to fix my grammar while I am still finding out what I mean. A notebook does none of that. It lets me be wrong in peace.",
          "> The first draft is just you telling yourself the story. (Terry Pratchett)",
          "## Then the keyboard",
          "When the notebook is full, I type it up. Typing is my second draft: everything gets read again, and most of it gets cut. What survives has earned its place *twice*.",
          "So: pen first, keyboard second. It takes longer. It is also the only way I have found to finish things.",
        ],
      },
    ],
    notes: [
      {
        key: "quote",
        title: "The Pratchett line",
        category: "research",
        tags: "Check the source",
        lines: ["Find where the first-draft line first appeared before the article goes out."],
        chapters: ["article"],
        todoState: "done",
      },
    ],
    tasks: [
      { title: "Add a photo of the notebook", state: "todo", chapter: "article" },
      { title: "Post it on the blog", state: "done", chapter: "article" },
    ],
  },
];

/** The book, notes and to-dos for an example, ready to save into a book file whose project id is `projectId`. */
export function buildExample(
  example: ExampleBook,
  projectId: string,
  now = new Date().toISOString(),
): { project: Project; notes: Note[]; tasks: Task[] } {
  const chapterIds = new Map(example.chapters.map((chapter) => [chapter.key, crypto.randomUUID()]));
  const noteIds = new Map(example.notes.map((note) => [note.key, crypto.randomUUID()]));
  const chapters: Chapter[] = example.chapters.map((chapter, position) => {
    const contentJson = prose(chapter.lines);
    return {
      id: chapterIds.get(chapter.key)!,
      projectId,
      title: chapter.title,
      position,
      contentJson,
      plainText: proseText(contentJson),
      synopsis: chapter.synopsis,
      status: chapter.status,
      language: "",
      wordGoal: chapter.wordGoal ?? 0,
      part: chapter.part ?? "",
      updatedAt: now,
    };
  });
  const notes: Note[] = example.notes.map((note) => {
    const contentJson = prose(note.lines);
    return {
      id: noteIds.get(note.key)!,
      projectId,
      title: note.title,
      contentJson,
      plainText: proseText(contentJson),
      category: note.category,
      tags: note.tags,
      fields: note.fields ?? [],
      todoState: note.todoState ?? null,
      chapterIds: (note.chapters ?? []).flatMap((key) => chapterIds.get(key) ?? []),
      createdAt: now,
      updatedAt: now,
    };
  });
  const tasks: Task[] = example.tasks.map((task) => ({
    id: crypto.randomUUID(),
    projectId,
    title: task.title,
    todoState: task.state,
    updatedAt: now,
    chapterId: task.chapter ? (chapterIds.get(task.chapter) ?? "") : "",
    noteId: task.note ? (noteIds.get(task.note) ?? "") : "",
  }));
  const project: Project = {
    id: projectId,
    title: example.title,
    kind: example.kind,
    language: example.language,
    createdAt: now,
    updatedAt: now,
    chapters,
  };
  return { project, notes, tasks };
}
