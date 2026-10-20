import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WordImport } from "./wordImport";

// Her files, by path; what the open dialog answers; the pictures made small.
const disk = new Map<string, string>();
let picked: string[] = [];
const shrunk: string[] = [];
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (_command: string, args: { path: string }) => {
    const text = disk.get(args.path);
    if (text === undefined) throw "That file isn't there any more";
    return new TextEncoder().encode(text).buffer;
  },
}));
vi.mock("$lib/storage/backup", () => ({ chooseDocumentFiles: async () => picked }));
vi.mock("$lib/editor/imageSize", () => ({
  shrinkImage: async (src: string) => {
    shrunk.push(src);
    return `${src}#small`;
  },
}));
// A Word file read: a chapter with a picture, in a paragraph's run as Word puts it.
vi.mock("./wordImport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./wordImport")>()),
  readWordFile: async (): Promise<WordImport> => ({
    title: "",
    fromPensieve: false,
    chapters: [
      {
        title: "Mlin",
        plainText: "",
        contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "image", attrs: { src: "data:image/png;base64,VELIKA" } }] }] },
      },
    ],
  }),
}));

const { chooseDocuments, documentAt, droppedDocuments, readDocumentData } = await import("./documents");

describe("documents coming in (IMP-28)", () => {
  beforeEach(() => {
    disk.clear();
    picked = [];
    shrunk.length = 0;
  });

  it("a file in the library comes in under its name and folder, read only when it is needed", async () => {
    const path = "C:\\Users\\Eva\\Documents\\Pensieve\\Gradivo\\Čarovnica.md";
    disk.set(path, "# Prvo poglavje\n\nČaša, šola, žaba.\n\n# Drugo poglavje\n\nReka.");
    const source = documentAt(path);
    expect([source.name, source.folder]).toEqual(["Čarovnica.md", "Gradivo"]);
    const read = await source.read();
    expect(read.chapters.map((chapter) => [chapter.title, chapter.plainText])).toEqual([
      ["Prvo poglavje", "Čaša, šola, žaba."],
      ["Drugo poglavje", "Reka."],
    ]);
  });

  it("the files she picks come in the order Explorer shows them", async () => {
    picked = ["D:\\Zgodbe\\10 Konec.txt", "D:\\Zgodbe\\2 Sredina.txt", "D:\\Zgodbe\\1 Začetek.txt"];
    expect((await chooseDocuments(true)).map((source) => source.name)).toEqual(["1 Začetek.txt", "2 Sredina.txt", "10 Konec.txt"]);
  });

  it("dropped files: documents come in, in Explorer's order; anything else stays out", async () => {
    const files = [new File(["B"], "Brod.txt"), new File(["x"], "slika.png"), new File(["A, čšž"], "Ana.txt")];
    const sources = droppedDocuments(files);
    expect(sources.map((source) => source.name)).toEqual(["Ana.txt", "Brod.txt"]);
    expect((await sources[0].read()).chapters[0].plainText).toBe("A, čšž");
  });

  it("a Word file's pictures are made small as it comes in", async () => {
    const read = await readDocumentData(new ArrayBuffer(4), "Mlin.docx");
    expect(shrunk).toEqual(["data:image/png;base64,VELIKA"]);
    expect(JSON.stringify(read.chapters[0].contentJson)).toContain("VELIKA#small");
  });

  it("a file gone since it was listed says so when it is read", async () => {
    await expect(documentAt("D:\\Ni ga.txt").read()).rejects.toBe("That file isn't there any more");
  });
});
