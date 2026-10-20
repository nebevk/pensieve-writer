import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWriting, type Writing } from "$lib/model";
import { defaultPrefs } from "$lib/prefs";

// Where the save dialog answers, what was written where, and the clipboard.
let chosen: string | null = null;
let writeFails: string | null = null;
const written: { path: string; text: string }[] = [];
vi.mock("$lib/export/files", () => ({
  chooseSavePath: async (name: string, kind: string) => {
    asked.push(`${name} (${kind})`);
    return chosen;
  },
  writeFileTo: async (path: string, bytes: Uint8Array) => {
    if (writeFails) throw new Error(writeFails);
    written.push({ path, text: new TextDecoder().decode(bytes) });
    return { path, stamp: "1" };
  },
}));
vi.mock("$lib/export/wordAssets", () => ({ wordFileFor: async (book: Writing) => new TextEncoder().encode(`PK ${book.title}`) }));
const asked: string[] = [];

const { Exports } = await import("./exports");

describe("Settings' exports (IMP-28)", () => {
  let writing: Writing | null;
  let events: string[];
  let copied: string | null;
  let exporter: InstanceType<typeof Exports>;

  beforeEach(() => {
    chosen = null;
    writeFails = null;
    written.length = 0;
    asked.length = 0;
    events = [];
    copied = null;
    writing = createWriting("Zgodbe: ob reki?", "Prvo poglavje");
    writing.chapters[0].plainText = "Čaša, šola, žaba.";
    writing.chapters[0].contentJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Čaša, šola, žaba." }] }] };
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: async (text: string) => {
          if (text.includes("NE")) throw new Error("Document is not focused.");
          copied = text;
        },
      },
    });
    exporter = new Exports({
      writing: () => writing,
      prefs: () => defaultPrefs(),
      saveFirst: async () => void events.push("saved first"),
      say: (message) => events.push(`say: ${message}`),
      fail: (message) => events.push(`fail: ${message}`),
    });
  });

  it("a Word file, saved first, named after the writing, where she chose", async () => {
    chosen = "C:\\Users\\Eva\\Izvoz\\Zgodbe.docx";
    expect(await exporter.word()).toBe(chosen);
    expect(asked).toEqual(["Zgodbe ob reki.docx (docx)"]);
    expect(written).toEqual([{ path: chosen, text: "PK Zgodbe: ob reki?" }]);
    expect(events).toEqual(["saved first", `say: Saved ${chosen}`]);
  });

  it("Markdown and plain text, with her words in them", async () => {
    chosen = "C:\\Users\\Eva\\Izvoz\\Zgodbe.md";
    await exporter.text("markdown");
    chosen = "C:\\Users\\Eva\\Izvoz\\Zgodbe.txt";
    await exporter.text("plain");
    expect(asked).toEqual(["Zgodbe ob reki.md (md)", "Zgodbe ob reki.txt (txt)"]);
    expect(written[0].text.startsWith("# Zgodbe: ob reki?")).toBe(true);
    expect(written.every((file) => file.text.includes("Čaša, šola, žaba."))).toBe(true);
  });

  it("nothing when the dialog closes without a name, or no writing is open", async () => {
    expect(await exporter.word()).toBe("");
    writing = null;
    expect(await exporter.text("plain")).toBe("");
    expect([written, events]).toEqual([[], ["saved first"]]);
  });

  it("a file Windows won't write is said, in her words", async () => {
    chosen = "C:\\Users\\Eva\\Izvoz\\Zgodbe.docx";
    writeFails = "“Zgodbe.docx” is open in another program, probably Word. Close it there, then try again.";
    expect(await exporter.word()).toBe("");
    expect(events.at(-1)).toBe(`say: ${writeFails}`);
  });

  it("clean HTML on the clipboard, said; one the clipboard refuses is said where a failed save is", async () => {
    await exporter.copyHtml();
    expect(copied).toContain("<h1>Zgodbe: ob reki?</h1>");
    expect(copied).toContain("Čaša, šola, žaba.");
    expect(events).toEqual(["saved first", "say: Copied clean HTML"]);
    writing = createWriting("NE", "Prvo");
    await exporter.copyHtml();
    expect(events.at(-1)).toBe("fail: Document is not focused.");
  });
});
