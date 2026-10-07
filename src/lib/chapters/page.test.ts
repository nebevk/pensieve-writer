import { describe, expect, it } from "vitest";
import { createChapter, type Chapter, type DocumentJson, type Writing } from "$lib/model";
import { applyPage, composePage, joinWriting, readPage, splitWriting, startsPart, withoutBreaks } from "./page";

const NOW = "2026-10-06T12:00:00.000Z";
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const doc = (...content: unknown[]): DocumentJson => ({ type: "doc", content });

function chapter(title: string, part: string, ...content: unknown[]): Chapter {
  return { ...createChapter("book", title, 0, "2026-10-01T00:00:00.000Z"), part, contentJson: doc(...content), plainText: "" };
}

function book(...chapters: Chapter[]): Writing {
  return {
    id: "book",
    title: "The Lantern House",
    createdAt: NOW,
    updatedAt: NOW,
    language: "en",
    split: true,
    wordGoal: 0,
    chapters: chapters.map((item, position) => ({ ...item, position })),
  };
}

const ordered = (writing: Writing) => [...writing.chapters].sort((a, b) => a.position - b.position);

describe("a chapter's page", () => {
  it("shows the part's name where a part begins, then the title, then the text", () => {
    const chapters = [chapter("The Letter", "Part One", p("It came.")), chapter("Fog", "Part One", p("Fog.")), chapter("Keys", "Part Two", p("Keys."))];
    expect(composePage(chapters, 0).content).toEqual([h(1, "Part One"), h(2, "The Letter"), p("It came.")]);
    expect(composePage(chapters, 1).content).toEqual([h(2, "Fog"), p("Fog.")]);
    expect(composePage(chapters, 2).content?.[0]).toEqual(h(1, "Part Two"));
    expect(startsPart(chapters, 1)).toBe(false);
  });

  it("leaves an untitled chapter's title line empty, and makes older headings subheadings", () => {
    const page = composePage([chapter("Untitled", "", h(1, "Old big heading"), p("Text."))], 0);
    expect(page.content).toEqual([{ type: "heading", attrs: { level: 2 } }, h(3, "Old big heading"), p("Text.")]);
  });

  it("reads a page back into the same chapter, with nothing lost or added", () => {
    const writing = book(chapter("The Letter", "Part One", p("It came."), h(3, "Later"), p("She read it.")), chapter("Fog", "Part One", p("Fog.")));
    const start = ordered(writing);
    const { writing: next, created } = applyPage(writing, start[0].id, composePage(start, 0), NOW, "Untitled");
    expect(created).toEqual([]);
    const [letter, fog] = ordered(next);
    expect(letter).toMatchObject({ title: "The Letter", part: "Part One", contentJson: start[0].contentJson, plainText: "It came.\n\nLater\n\nShe read it." });
    expect(fog).toEqual(start[1]);
  });

  it("renames the chapter from its title line", () => {
    const writing = book(chapter("Chapter 1", "", p("Text.")));
    const id = writing.chapters[0].id;
    const { writing: next } = applyPage(writing, id, doc(h(2, "The Letter"), p("Text.")), NOW, "Untitled");
    expect(next.chapters[0].title).toBe("The Letter");
    const { writing: emptied } = applyPage(writing, id, doc({ type: "heading", attrs: { level: 2 } }, p("Text.")), NOW, "Untitled");
    expect(emptied.chapters[0].title).toBe("Untitled");
  });

  it("starts a new chapter at a Heading 2 further down, right after this one", () => {
    const writing = book(chapter("The Letter", "Part One", p("A.")), chapter("Keys", "Part One", p("K.")));
    const start = ordered(writing);
    const edited = doc(h(1, "Part One"), h(2, "The Letter"), p("A."), h(2, "Fog on the Sava"), p("The fog came."), h(3, "Krško"), p("Rain."));
    expect(readPage(edited).starts).toEqual([3]);
    const { writing: next, created } = applyPage({ ...writing, chapters: start }, start[0].id, edited, NOW, "Untitled");
    const chapters = ordered(next);
    expect(chapters.map((item) => item.title)).toEqual(["The Letter", "Fog on the Sava", "Keys"]);
    expect(chapters.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(created).toEqual([chapters[1].id]);
    expect(chapters[0].contentJson.content).toEqual([p("A.")]);
    expect(chapters[1]).toMatchObject({ part: "Part One", status: start[0].status, contentJson: doc(p("The fog came."), h(3, "Krško"), p("Rain.")) });
    // Every word is still in the book, once.
    expect(chapters.map((item) => item.plainText).join(" ")).toBe("A. The fog came.\n\nKrško\n\nRain. ");
  });

  it("starts a part at a Heading 1, for the chapters after it that were in the old part too", () => {
    const writing = book(chapter("One", "Part One", p("1.")), chapter("Two", "Part One", p("2.")), chapter("Three", "Part One", p("3.")), chapter("Four", "Part Two", p("4.")));
    const start = ordered(writing);
    const edited = doc(h(2, "Two"), p("2."), h(1, "Part Between"), h(2, "Two and a half"), p("2.5."));
    const { writing: next } = applyPage({ ...writing, chapters: start }, start[1].id, edited, NOW, "Untitled");
    expect(ordered(next).map((item) => [item.title, item.part])).toEqual([
      ["One", "Part One"],
      ["Two", "Part One"],
      ["Two and a half", "Part Between"],
      ["Three", "Part Between"],
      ["Four", "Part Two"],
    ]);
  });

  it("renames, adds and removes a part from the part line", () => {
    const writing = book(chapter("One", "Part One", p("1.")), chapter("Two", "Part One", p("2.")), chapter("Three", "", p("3.")));
    const [one, two] = ordered(writing);
    const renamed = applyPage(writing, one.id, doc(h(1, "Beginnings"), h(2, "One"), p("1.")), NOW, "Untitled").writing;
    expect(ordered(renamed).map((item) => item.part)).toEqual(["Beginnings", "Beginnings", ""]);
    const added = applyPage(writing, two.id, doc(h(1, "Part Two"), h(2, "Two"), p("2.")), NOW, "Untitled").writing;
    expect(ordered(added).map((item) => item.part)).toEqual(["Part One", "Part Two", ""]);
    const removed = applyPage(writing, one.id, doc(h(2, "One"), p("1.")), NOW, "Untitled").writing;
    expect(ordered(removed).map((item) => item.part)).toEqual(["", "", ""]);
    // An emptied part line keeps the part, so its name can be typed again.
    const cleared = applyPage(writing, one.id, doc({ type: "heading", attrs: { level: 1 } }, h(2, "One"), p("1.")), NOW, "Untitled").writing;
    expect(ordered(cleared).map((item) => item.part)).toEqual(["Part One", "Part One", ""]);
  });

  it("starts nothing at an empty Heading 1 or 2, so its name can be typed first", () => {
    const empty = (level: number) => ({ type: "heading", attrs: { level } });
    const page = doc(h(2, "One"), p("1."), empty(1), empty(2), p("More."));
    const { first, more } = readPage(page);
    expect(more).toEqual([]);
    expect(first.content).toEqual([p("1."), empty(1), empty(2), p("More.")]);
    const writing = book(chapter("One", "", p("1.")));
    expect(applyPage(writing, writing.chapters[0].id, page, NOW, "Untitled").created).toEqual([]);
    // Once named, the Heading 1 begins a part, and the Heading 2 under it is its first chapter's title.
    const named = applyPage(writing, writing.chapters[0].id, doc(h(2, "One"), p("1."), h(1, "Part Two"), empty(2), p("More.")), NOW, "Untitled");
    expect(ordered(named.writing).map((item) => [item.title, item.part])).toEqual([
      ["One", ""],
      ["Untitled", "Part Two"],
    ]);
  });

  it("reads a page against what it showed when it opened, after the chapters were reordered", () => {
    // B opened without a part line, as A began the part. Dragged to the front, B now begins it, but
    // its page still has no part line: that is not the part being taken away.
    const writing = book(chapter("A", "Part One", p("a")), chapter("B", "Part One", p("b")), chapter("C", "Part One", p("c")));
    const [a, b, c] = ordered(writing);
    const moved = { ...writing, chapters: [{ ...b, position: 0 }, { ...a, position: 1 }, { ...c, position: 2 }] };
    const page = composePage(ordered(writing), 1);
    const kept = applyPage(moved, b.id, page, NOW, "Untitled", { began: false }).writing;
    expect(ordered(kept).map((item) => [item.title, item.part])).toEqual([
      ["B", "Part One"],
      ["A", "Part One"],
      ["C", "Part One"],
    ]);
  });

  it("takes a part added on the page away again when its line goes, the page still open", () => {
    const writing = book(chapter("One", "", p("1.")), chapter("Two", "", p("2.")));
    const [one] = ordered(writing);
    const added = applyPage(writing, one.id, doc(h(1, "Part One"), h(2, "One"), p("1.")), NOW, "Untitled", { began: false });
    expect(added.began).toBe(true);
    expect(ordered(added.writing).map((item) => item.part)).toEqual(["Part One", "Part One"]);
    const removed = applyPage(added.writing, one.id, doc(h(2, "One"), p("1.")), NOW, "Untitled", { began: added.began });
    expect(removed.began).toBe(false);
    expect(ordered(removed.writing).map((item) => item.part)).toEqual(["", ""]);
  });

  it("lets a heading with a comment or footnote stay a heading, and reads a line break in a title as a space", () => {
    const noted = {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "The Storm", marks: [{ type: "comment", attrs: { id: "c-1", text: "Move?" } }] }],
    };
    const footnoted = { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Fog" }, { type: "footnote", attrs: { text: "First published 2019." } }] };
    for (const heading of [noted, footnoted]) {
      const { first, more } = readPage(doc(h(2, "One"), p("1."), heading, p("More.")));
      expect(more).toEqual([]);
      expect(first.content).toContainEqual(heading);
    }
    const broken = { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Chapter Two" }, { type: "hardBreak" }, { type: "text", text: "The Fog" }] };
    expect(readPage(doc(h(2, "One"), p("1."), broken, p("Fog."))).more[0].title).toBe("Chapter Two The Fog");
  });

  it("treats part names that differ only by spaces as one part", () => {
    const writing = book(chapter("The Letter", "Part One", p("1.")), chapter("Fog", "Part One ", p("2.")), chapter("Keys", "Part Two", p("3.")));
    const [letter] = ordered(writing);
    const renamed = applyPage(writing, letter.id, doc(h(1, "Beginnings"), h(2, "The Letter"), p("1.")), NOW, "Untitled", { began: true }).writing;
    expect(ordered(renamed).map((item) => item.part)).toEqual(["Beginnings", "Beginnings", "Part Two"]);
  });

  it("keeps a title that says 'no title' in its own language when its line is empty", () => {
    const writing = book(chapter("Brez naslova", "", p("Besedilo.")));
    const page = composePage(ordered(writing), 0);
    expect(applyPage(writing, writing.chapters[0].id, page, NOW, "Untitled").writing.chapters[0].title).toBe("Brez naslova");
  });

  it("takes a split back to lines of text", () => {
    const page = doc(h(1, "Part One"), h(2, "One"), p("1."), h(1, "Part Two"), h(2, "Two"), p("2."));
    expect(withoutBreaks(page).content).toEqual([h(1, "Part One"), h(2, "One"), p("1."), p("Part Two"), p("Two"), p("2.")]);
  });

  it("keeps an article in one piece, its headings as they are", () => {
    const article = [chapter("Why I write by hand", "", p("Intro."), h(2, "The pen is slow"), p("Slow."))];
    const page = composePage(article, 0, false);
    expect(page.content).toEqual([h(2, "Why I write by hand"), p("Intro."), h(2, "The pen is slow"), p("Slow.")]);
    const writing = book(...article);
    const result = applyPage(writing, writing.chapters[0].id, page, NOW, "Untitled", { split: false });
    expect(result.created).toEqual([]);
    expect(result.writing.chapters[0].contentJson).toEqual(article[0].contentJson);
  });
});

describe("Split into chapters, turned off and on", () => {
  it("joins the chapters into one page, their titles as headings, keeping the first chapter's place", () => {
    const one = { ...chapter("The Letter", "Part One", p("Dear Ana.")), status: "final" as const, wordGoal: 600 };
    const two = chapter("Fog", "Part One", p("The river."));
    const three = chapter("Untitled", "Part Two", p("Keys."));
    const joined = joinWriting(book(one, two, three), NOW);
    expect(joined.writing.split).toBe(false);
    expect(joined.writing.chapters).toHaveLength(1);
    expect(joined.kept).toBe(one.id);
    expect(joined.removed).toEqual([two.id, three.id]);
    const page = joined.writing.chapters[0];
    expect(page).toMatchObject({ id: one.id, title: "The Lantern House", part: "", wordGoal: 0 });
    expect(page.contentJson.content).toEqual([
      h(1, "Part One"),
      h(2, "The Letter"),
      p("Dear Ana."),
      h(2, "Fog"),
      p("The river."),
      h(1, "Part Two"),
      p("Keys."),
    ]);
    expect(page.plainText).toContain("Dear Ana.");
  });

  it("splits a one-page writing at its headings again, with nothing lost", () => {
    const joined = joinWriting(book(chapter("The Letter", "", p("Dear Ana.")), chapter("Fog", "", p("The river."))), NOW).writing;
    const split = splitWriting(joined, NOW, "Untitled");
    expect(split.split).toBe(true);
    expect(ordered(split).map((item) => [item.title, item.plainText])).toEqual([
      ["The Letter", "Dear Ana."],
      ["Fog", "The river."],
    ]);
  });

  it("keeps a page's opening text as a first chapter under the writing's title", () => {
    const page = { ...chapter("The Lantern House", "", p("An opening."), h(2, "Fog"), p("The river.")) };
    const split = splitWriting({ ...book(page), split: false }, NOW, "Untitled");
    expect(ordered(split).map((item) => [item.title, item.plainText])).toEqual([
      ["The Lantern House", "An opening."],
      ["Fog", "The river."],
    ]);
  });
});
