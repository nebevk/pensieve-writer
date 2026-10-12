import { describe, expect, it } from "vitest";
import { defaultLibraryFolder, folderNameProblem, folderOf, groupBooks, isInside, joinPath, lastName, looksSynced, parentFolder, projectFolders, rebasePath, sameFolder, type LibraryEntry } from "./library";

describe("the library folder", () => {
  it("knows folders that a sync service keeps copying", () => {
    expect(looksSynced("C:\\Users\\Eva\\OneDrive\\Documents")).toBe(true);
    expect(looksSynced("C:\\Users\\Eva\\OneDrive - Založba\\Dokumenti")).toBe(true);
    expect(looksSynced("G:\\My Drive\\Pensieve")).toBe(true);
    expect(looksSynced("C:\\Users\\Eva\\Google Drive\\Knjige")).toBe(true);
    expect(looksSynced("D:\\Dropbox (Personal)\\Books")).toBe(true);
    expect(looksSynced("C:\\Users\\Eva\\iCloudDrive")).toBe(true);
    expect(looksSynced("C:\\Users\\Eva\\Documents\\Pensieve")).toBe(false);
    expect(looksSynced("C:\\Users\\Eva\\Documents\\My Driveway notes")).toBe(false);
  });

  it("goes in Documents, or the home folder when Documents is synced", () => {
    expect(defaultLibraryFolder({ documents: "C:\\Users\\Eva\\Documents", home: "C:\\Users\\Eva" })).toBe("C:\\Users\\Eva\\Documents\\Pensieve");
    expect(defaultLibraryFolder({ documents: "C:\\Users\\Eva\\OneDrive\\Documents", home: "C:\\Users\\Eva" })).toBe("C:\\Users\\Eva\\Pensieve");
    expect(defaultLibraryFolder({ documents: "", home: "/home/eva" })).toBe("/home/eva/Pensieve");
  });

  it("joins and compares paths as Windows does", () => {
    expect(joinPath("C:\\Books\\", "Zgodbe")).toBe("C:\\Books\\Zgodbe");
    expect(joinPath("/home/eva", "Books")).toBe("/home/eva/Books");
    expect(isInside("c:\\books\\zgodbe\\pensieve.db", "C:\\Books")).toBe(true);
    expect(isInside("C:/Books", "C:\\Books\\")).toBe(true);
    expect(isInside("C:\\Bookshelf\\x", "C:\\Books")).toBe(false);
    expect(isInside("C:\\Books", "")).toBe(false);
  });

  it("says what is wrong with a folder's name", () => {
    expect(folderNameProblem("Zgodbe ob reki")).toBe(null);
    expect(folderNameProblem("Čarovnica")).toBe(null);
    expect(folderNameProblem("   ")).toBe("nameEmpty");
    expect(folderNameProblem("...")).toBe("nameEmpty");
    expect(folderNameProblem("a/b")).toBe("nameCharacters");
    expect(folderNameProblem("Who? Me")).toBe("nameCharacters");
    expect(folderNameProblem("con")).toBe("nameReserved");
    expect(folderNameProblem("LPT1.txt")).toBe("nameReserved");
    expect(folderNameProblem("Console")).toBe(null);
    expect(folderNameProblem("x".repeat(121))).toBe("nameTooLong");
    // Folders the library leaves out, as Windows and other programs keep them.
    expect(folderNameProblem(".drafts")).toBe("nameStart");
    expect(folderNameProblem("$Recycle")).toBe("nameStart");
    expect(folderNameProblem("Draft.1")).toBe(null);
  });
});

describe("moving folders in the library", () => {
  const LIB = "C:\\Users\\Eva\\Documents\\Pensieve";
  it("follows a renamed or moved folder with the paths inside it", () => {
    const from = `${LIB}\\Zgodbe`;
    const to = `${LIB}\\Primeri\\Kratke zgodbe`;
    expect(rebasePath(`${LIB}\\Zgodbe\\Brod\\pensieve.db`, from, to)).toBe(`${LIB}\\Primeri\\Kratke zgodbe\\Brod\\pensieve.db`);
    expect(rebasePath(`${LIB}\\zgodbe\\Brod\\pensieve.db`, from, to)).toBe(`${LIB}\\Primeri\\Kratke zgodbe\\Brod\\pensieve.db`);
    expect(rebasePath(from, from, to)).toBe(to);
    // A neighbour whose name starts the same stays where it is, and so does anything outside.
    expect(rebasePath(`${LIB}\\Zgodbe ob reki\\pensieve.db`, from, to)).toBe(`${LIB}\\Zgodbe ob reki\\pensieve.db`);
    expect(rebasePath("", from, to)).toBe("");
  });

  it("finds the folder a folder is in, a drive's top too", () => {
    expect(parentFolder(`${LIB}\\Kratke zgodbe`)).toBe(LIB);
    expect(parentFolder(`${LIB}\\Kratke zgodbe\\`)).toBe(LIB);
    expect(parentFolder("E:\\Brod")).toBe("E:\\");
  });

  it("names folders and compares them as Windows does", () => {
    expect(lastName(`${LIB}\\Kratke zgodbe\\`)).toBe("Kratke zgodbe");
    expect(lastName("/home/eva/Knjige")).toBe("Knjige");
    expect(sameFolder(`${LIB}\\Primeri`, `${LIB.toLowerCase()}\\primeri\\`)).toBe(true);
    expect(sameFolder(`${LIB}\\Primeri`, `${LIB}\\Primeri\\Stari`)).toBe(false);
  });
});

describe("the library", () => {
  it("names a book's folder from a Windows or a POSIX path", () => {
    expect(folderOf("C:\\Books\\Pensieve\\pensieve.db")).toEqual({ path: "C:\\Books\\Pensieve", name: "Pensieve" });
    expect(folderOf("C:\\Books\\Pensieve\\examples\\lantern.db")).toEqual({ path: "C:\\Books\\Pensieve\\examples", name: "examples" });
    expect(folderOf("/home/eva/Books/novel.db")).toEqual({ path: "/home/eva/Books", name: "Books" });
    expect(folderOf("novel.db")).toEqual({ path: "", name: "" });
  });

  it("groups books by folder, the open book's folder first, the books by title", () => {
    const books = [
      { path: "C:\\Books\\Pensieve\\examples\\lantern.db", title: "The Lantern House" },
      { path: "C:\\Books\\Pensieve\\pensieve.db", title: "Zgodbe ob reki" },
      { path: "C:\\Books\\Pensieve\\examples\\essay.db", title: "Why I write by hand first" },
      { path: "C:\\Books\\Pensieve\\another.db", title: "Another" },
    ];
    const folders = groupBooks(books, "C:\\Books\\Pensieve\\examples\\essay.db");
    expect(folders.map((folder) => folder.name)).toEqual(["examples", "Pensieve"]);
    expect(folders[0].books.map((book) => book.title)).toEqual(["The Lantern House", "Why I write by hand first"]);
    expect(folders[1].books.map((book) => book.title)).toEqual(["Another", "Zgodbe ob reki"]);
  });

  it("lists an open book it doesn't know yet under its folder, with the title given", () => {
    const folders = groupBooks([{ path: "C:\\Books\\Pensieve\\other.db", title: "Other" }], "C:\\Books\\Pensieve\\new.db", "Nova knjiga");
    expect(folders).toHaveLength(1);
    expect(folders[0].books.map((book) => book.title)).toEqual(["Nova knjiga", "Other"]);
  });
});

describe("a new project's place", () => {
  it("lists the library's folders by their way from the top, č after c, never a project or a file", () => {
    const folder = (path: string, children: LibraryEntry[] = []): LibraryEntry => ({ name: lastName(path), path, project: false, children });
    const entries: LibraryEntry[] = [
      folder("C:\\K\\Romani", [folder("C:\\K\\Romani\\Čarovnice"), folder("C:\\K\\Romani\\Cesta", [folder("C:\\K\\Romani\\Cesta\\Globoko")])]),
      { name: "Brod", path: "C:\\K\\Brod", project: true, children: [folder("C:\\K\\Brod\\Slike")] },
      { name: "zapiski.txt", path: "C:\\K\\zapiski.txt", project: false, file: true, children: [] },
    ];
    expect(projectFolders(entries, "sl").map((place) => place.label)).toEqual(["Romani", "Romani / Cesta", "Romani / Cesta / Globoko", "Romani / Čarovnice"]);
    // Only as deep as the tree lists.
    expect(projectFolders(entries, "sl", 2).map((place) => place.label)).toEqual(["Romani", "Romani / Cesta", "Romani / Čarovnice"]);
  });
});
