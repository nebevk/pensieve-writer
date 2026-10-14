import { describe, expect, it } from "vitest";
import { emptyDocument } from "$lib/model";
import type { ImportedChapter, WordImport } from "./wordImport";
import { bookFromDocuments, byFileName, documentKind, documentName, draftChapters, draftsFound, draftsFrom, writingFromDocument } from "./importWriting";

const chapter = (title: string, words = "Besedilo."): ImportedChapter => ({
  title,
  contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: words }] }] },
  plainText: words,
});
const read = (title: string, ...chapters: ImportedChapter[]): WordImport => ({ title, chapters, fromPensieve: false });

describe("Files brought in as writings", () => {
  it("knows Word, text and Markdown files by their names", () => {
    expect(documentKind("C:\\Knjige\\Pod lipo.DOCX")).toBe("word");
    expect(documentKind("zapiski.txt")).toBe("text");
    expect(documentKind("objava.md")).toBe("markdown");
    expect(documentKind("objava.markdown")).toBe("markdown");
    expect(documentKind("slika.png")).toBeNull();
    expect(documentName("C:\\Knjige\\Pod lipo.docx")).toBe("Pod lipo");
    expect(documentName("C:/Knjige/v1.2 osnutek.md")).toBe("v1.2 osnutek");
  });

  it("orders files as Explorer does, numbers by value and č after c", () => {
    expect(byFileName(["10 Deseto.docx", "2 Drugo.txt", "1 Prvo.md"], "sl").map(documentName)).toEqual(["1 Prvo", "2 Drugo", "10 Deseto"]);
    expect(byFileName(["Čebela.txt", "Dom.txt", "Cesta.txt"], "sl").map(documentName)).toEqual(["Cesta", "Čebela", "Dom"]);
  });

  it("names a writing by the file's Title, its one heading, or the file, and gives it chapters only when it has them", () => {
    expect(writingFromDocument(read("", chapter("rokopis")), "rokopis", "Brez naslova")).toMatchObject({ title: "rokopis", split: false });
    expect(writingFromDocument(read("", chapter("Pod lipo")), "rokopis", "Brez naslova")).toMatchObject({ title: "Pod lipo", split: false });
    // A chapter label names the chapter, not the writing.
    expect(writingFromDocument(read("", chapter("3. poglavje")), "rokopis", "Brez naslova")).toMatchObject({ title: "rokopis", split: true });
    expect(writingFromDocument(read("Knjiga", chapter("Ena"), chapter("Dve")), "rokopis", "Brez naslova")).toMatchObject({ title: "Knjiga", split: true });
    expect(writingFromDocument(read(""), "", "Brez naslova")).toMatchObject({ title: "Brez naslova", split: false });
  });

  it("makes one book of several files, a chapter of each, and keeps a file's own chapters", () => {
    const book = bookFromDocuments("Zgodbe", [
      { name: "01 Uvod", result: read("", chapter("01 Uvod")) },
      { name: "02", result: read("", chapter("Prvo poglavje")) },
      { name: "03", result: read("", chapter("Drugo poglavje"), chapter("Tretje poglavje")) },
      { name: "04 Konec", result: read("") },
      { name: "05", result: read("Epilog", chapter("Brez naslova")) },
    ]);
    expect(book.split).toBe(true);
    expect(book.chapters.map((item) => item.title)).toEqual(["01 Uvod", "Prvo poglavje", "Drugo poglavje", "Tretje poglavje", "04 Konec", "Epilog"]);
    expect(book.chapters[4].contentJson).toEqual(emptyDocument());
  });

  it("gives a page the writing's title, chapters their own, and an empty file none", () => {
    const page = draftChapters(writingFromDocument(read("", chapter("Pod lipo")), "rokopis", "Brez naslova"))?.("w") ?? [];
    expect(page.map((item) => [item.writingId, item.title, item.position, item.plainText])).toEqual([["w", "Pod lipo", 0, "Besedilo."]]);
    const book = draftChapters(bookFromDocuments("Zgodbe", [{ name: "a", result: read("", chapter("Ena"), chapter("Dve")) }]))?.("w") ?? [];
    expect(book.map((item) => item.title)).toEqual(["Ena", "Dve"]);
    expect(draftChapters(writingFromDocument(read(""), "prazno", "Brez naslova"))).toBeUndefined();
  });
});

describe("What documents make, said before anything is made", () => {
  const story = (name: string, ...chapters: ImportedChapter[]) => ({ name, result: read("", ...chapters) });

  it("makes a writing of each document, or one book with a chapter for each", () => {
    const two = [story("Prva", chapter("Prva", "Ena dve.")), story("Druga", chapter("Druga", "Tri."))];
    expect(draftsFrom(two, false, "Zgodbe", "Brez naslova").map((draft) => draft.title)).toEqual(["Prva", "Druga"]);
    const book = draftsFrom(two, true, "Zgodbe", "Brez naslova");
    expect(book).toHaveLength(1);
    expect(book[0]).toMatchObject({ title: "Zgodbe", split: true });
    expect(book[0].chapters.map((item) => item.title)).toEqual(["Prva", "Druga"]);
    // One document is one writing, book or not.
    expect(draftsFrom(two.slice(0, 1), true, "Zgodbe", "Brez naslova")[0].title).toBe("Prva");
  });

  it("counts a writing's chapters and words, a page of one page, and names several writings", () => {
    const novel = draftsFrom([story("Roman", chapter("1. poglavje", "Čaša in šola."), chapter("2. poglavje", "Žaba."))], false, "", "Brez naslova");
    expect(draftsFound(novel)).toEqual({ chapters: 2, words: 4, titles: ["1. poglavje", "2. poglavje"] });
    const page = draftsFrom([story("Članek", chapter("Članek", "Ena dve tri."))], false, "", "Brez naslova");
    expect(draftsFound(page)).toEqual({ chapters: 1, words: 3, titles: [] });
    const two = draftsFrom([story("Prva", chapter("Prva", "Ena.")), story("Druga", chapter("Druga", "Dve tri."))], false, "", "Brez naslova");
    expect(draftsFound(two)).toEqual({ chapters: 2, words: 3, titles: ["Prva", "Druga"] });
  });
});
