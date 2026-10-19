import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isUntitled, localizeError, pluralize, relativeTime, translate, uiKeys } from "./i18n";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("interface language", () => {
  it("has a Slovenian text for every English one, with the same blanks to fill", () => {
    for (const key of uiKeys) {
      const english = translate("en", key);
      const slovenian = translate("sl", key);
      expect(slovenian.trim(), key).not.toBe("");
      expect(placeholders(slovenian), key).toEqual(placeholders(english));
    }
  });

  it("fills in values and writes numbers the local way", () => {
    expect(translate("en", "inTheBook", { n: 48930 })).toBe("48,930 in the book");
    expect(translate("sl", "inTheBook", { n: 48930 })).toBe("48.930 v knjigi");
    expect(translate("sl", "deleteQuestion", { title: "Brod" })).toBe("Izbrišem »Brod«?");
  });

  it("uses the four Slovenian plural forms", () => {
    const words = (n: number) => pluralize("sl", "words", n);
    expect([1, 2, 3, 4, 5, 11, 101, 102, 103, 111].map(words)).toEqual([
      "1 beseda",
      "2 besedi",
      "3 besede",
      "4 besede",
      "5 besed",
      "11 besed",
      "101 beseda",
      "102 besedi",
      "103 besede",
      "111 besed",
    ]);
    expect(pluralize("sl", "chapters", 0)).toBe("0 poglavij");
    // After "ima" (has): "Ima 20.001 besedo", "20.002 besedi", "21.103 besede", "20.011 besed".
    expect([20001, 20002, 21103, 20011].map((n) => translate("sl", "joinLong", { words: pluralize("sl", "hasWords", n) }).split(":")[0])).toEqual([
      "Ima 20.001 besedo",
      "Ima 20.002 besedi",
      "Ima 21.103 besede",
      "Ima 20.011 besed",
    ]);
    expect(pluralize("en", "words", 1)).toBe("1 word");
    expect(pluralize("en", "words", 1240)).toBe("1,240 words");
    // A goal follows the words written: "230 od 500 besed", "1 od 1 besede".
    expect([1, 2, 101, 500, 10000].map((n) => pluralize("sl", "wordsOf", n))).toEqual([
      "od 1 besede",
      "od 2 besed",
      "od 101 besede",
      "od 500 besed",
      "od 10.000 besed",
    ]);
    expect(pluralize("en", "wordsOf", 500)).toBe("of 500 words");
  });

  it("says how long ago in both languages", () => {
    const now = Date.parse("2026-10-05T12:00:00Z");
    const before = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
    expect(relativeTime("en", before(0), now)).toBe("just now");
    expect(relativeTime("sl", before(5), now)).toBe("pred 5 min");
    expect(relativeTime("sl", before(3 * 60), now)).toBe("pred 3 h");
    expect(relativeTime("sl", before(24 * 60), now)).toBe("včeraj");
    expect(relativeTime("sl", before(2 * 24 * 60), now)).toBe("pred 2 dnevoma");
    expect(relativeTime("sl", before(5 * 24 * 60), now)).toBe("pred 5 dnevi");
    expect(relativeTime("en", before(5 * 24 * 60), now)).toBe("5 d ago");
  });

  it("translates the problems Windows reports, and leaves unknown ones alone", () => {
    expect(localizeError("sl", "Enter one word, without spaces")).toBe("Vnesite eno besedo brez presledkov");
    expect(localizeError("sl", "“Roman.docx” is open in another program, probably Word. Close it there, then try again.")).toBe(
      "»Roman.docx« je odprta v drugem programu, verjetno v Wordu. Tam jo zaprite in poskusite znova.",
    );
    expect(localizeError("en", "Enter one word, without spaces")).toBe("Enter one word, without spaces");
    expect(localizeError("sl", "disk I/O error")).toBe("disk I/O error");
  });

  it("has Slovenian for every problem the Windows side words itself (ARCH-19)", () => {
    // Its texts in English, out of the Rust code itself: what it returns as an error, in any of the ways it does.
    const literal = String.raw`"((?:[^"\\]|\\.)*)"`;
    const ways = [
      new RegExp(String.raw`Err\(\s*${literal}`, "g"),
      new RegExp(String.raw`ok_or\(\s*${literal}`, "g"),
      new RegExp(String.raw`${literal}\s*\.(?:into|to_string)\(\)`, "g"),
      new RegExp(String.raw`const [A-Z_]+: &str = ${literal}`, "g"),
      new RegExp(String.raw`format!\(\s*${literal}`, "g"),
    ];
    // Not hers to read: answers the page acts on, the reason Windows shows at shutdown (the page gives it in
    // her language), and what only another system would say.
    const unread = new Set(["EXISTS", "CHANGED_ELSEWHERE", "absent", "Pensieve is saving your words", "Only Windows has the Recycle Bin Pensieve uses"]);
    const folder = join(process.cwd(), "src-tauri", "src");
    const texts = new Set<string>();
    for (const file of readdirSync(folder).filter((name) => name.endsWith(".rs"))) {
      // Its tests' own texts are left out.
      const code = readFileSync(join(folder, file), "utf8").split("#[cfg(test)]")[0];
      for (const way of ways) {
        for (const match of code.matchAll(way)) {
          const worded = JSON.parse(`"${match[1]}"`) as string;
          // A name made of values ("{}.db") says nothing to her; a sentence starts with a capital or a quote.
          const text = worded.replace(/\{\w*\}/g, "Roman.docx");
          if (/^[A-Z“]/.test(worded) && !unread.has(text)) texts.add(text);
        }
      }
    }
    expect(texts.size).toBeGreaterThan(40);
    expect([...texts].filter((text) => localizeError("sl", text) === text)).toEqual([]);
  });

  it("knows an untitled book in either language", () => {
    expect(isUntitled("Untitled")).toBe(true);
    expect(isUntitled("Brez naslova")).toBe(true);
    expect(isUntitled("Zgodbe ob reki")).toBe(false);
  });
});
