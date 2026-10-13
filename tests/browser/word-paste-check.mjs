// Checks pasting a manuscript from Word (IMP-18). The fixture is Word 365's clipboard HTML for a short chapter in
// Slovenian, with what makes pasting from Word hard: list bullets and numbers typed in front of paragraphs
// (mso-list:Ignore), a footnote as a numbered link with its text at the end, an empty line of a no-break
// space, a language on every run, Word's own o:p elements and conditional comments. Pasted at the end of
// the example article (a writing of one page, so its headings stay headings), the page must hold headings,
// paragraphs, italics and bold, real lists, a Pensieve footnote, č, š and ž, and nothing of Word's markup.
// Usage: node word-paste-check.mjs [port]
import { readFileSync } from "node:fs";
import { connect, sleep } from "./cdp.mjs";
import { clickFound } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
await page.harness();
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 60) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const WORD = readFileSync(new URL("./fixtures/word-clipboard.html", import.meta.url), "utf8");

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.clickText(".project", "The Lantern series");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await page.clickText(".sidebar .views button", "Library");
await until(`!!document.querySelector(".library")`);
await clickFound(page, `[...document.querySelectorAll(".library button.tree-row.writing")].find((el) => el.textContent.includes("Why I write by hand first"))`);
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("keyboard")`);
await sleep(800);

// Pasted from Word on a new line at the end of the article, as Word puts it on the clipboard.
await page.run(`(() => {
  const editor = document.querySelector(".paper .ProseMirror");
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
  return true;
})()`);
await page.key("Enter", "Enter", 13);
await sleep(200);
await page.run(`(() => {
  const editor = document.querySelector(".paper .ProseMirror");
  const data = new DataTransfer();
  data.setData("text/html", ${JSON.stringify(WORD)});
  data.setData("text/plain", "Pod lipo");
  editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  return true;
})()`);
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("lipa bo zacvetela")`);
await sleep(500);

// What came in: everything after "Pod lipo", the manuscript's title, now a line of the page.
const pasted = await page.run(`(() => {
  const editor = document.querySelector(".paper .ProseMirror");
  const blocks = [...editor.children];
  const start = blocks.findIndex((el) => el.textContent.trim() === "Pod lipo");
  const mine = blocks.slice(start);
  const lists = mine.filter((el) => el.tagName === "UL" || el.tagName === "OL");
  return {
    title: mine[0]?.tagName ?? "",
    headings: mine.filter((el) => /^H[1-3]$/.test(el.tagName)).map((el) => el.tagName + ":" + el.textContent.trim()),
    italic: [...editor.querySelectorAll("em")].map((el) => el.textContent).filter((text) => /Čaša|lipa bo zacvetela/.test(text)),
    bold: [...editor.querySelectorAll("strong")].map((el) => el.textContent).filter((text) => text === "tiho"),
    lists: lists.map((list) => list.tagName + ":" + [...list.children].map((item) => item.querySelector("p")?.textContent.trim() + (item.querySelector("ul, ol") ? "[" + [...item.querySelector("ul, ol").children].map((inner) => inner.textContent.trim()).join("|") + "]" : "")).join("|")),
    footnotes: [...editor.querySelectorAll("sup[data-footnote]")].map((el) => el.dataset.footnote),
    centred: mine.filter((el) => el.textContent.trim() === "* * *").map((el) => getComputedStyle(el).textAlign),
    empty: mine.filter((el) => el.tagName === "P" && !el.textContent.trim()).length,
    nbsp: mine.filter((el) => el.tagName === "P" && el.textContent === "\\u00a0").length,
    languages: [...editor.querySelectorAll("span[lang]")].map((el) => el.getAttribute("lang") + ":" + el.textContent),
    fonts: editor.querySelectorAll("[data-font], [data-size], [data-color]").length,
    text: mine.map((el) => el.innerText).join("\\n"),
  };
})()`);

check("the manuscript's title comes in as a line of the page", pasted.title === "P", pasted.title);
check("its headings stay headings", JSON.stringify(pasted.headings) === JSON.stringify(["H1:Prvo poglavje", "H1:Drugo poglavje", "H2:Pismo"]), JSON.stringify(pasted.headings));
check("italics and bold stay", JSON.stringify(pasted.italic) === JSON.stringify(["Čaša", "lipa bo zacvetela"]) && JSON.stringify(pasted.bold) === JSON.stringify(["tiho"]), JSON.stringify({ italic: pasted.italic, bold: pasted.bold }));
check(
  "Word's lists are lists, nested as they were, without the bullets and numbers Word typed in",
  JSON.stringify(pasted.lists) === JSON.stringify(["UL:kruh in sol,[črn in bel,]|ključ od kleti,|pismo za Žana.", "OL:zapreti okna,|ugasniti luč."]),
  JSON.stringify(pasted.lists),
);
check("the footnote is a footnote, with its text", JSON.stringify(pasted.footnotes) === JSON.stringify(["Babica je govorila po dolenjsko."]), JSON.stringify(pasted.footnotes));
check("the scene break stays centred", JSON.stringify(pasted.centred) === JSON.stringify(["center"]), JSON.stringify(pasted.centred));
check("Word's empty line is an empty line, not a no-break space", pasted.empty >= 1 && pasted.nbsp === 0, JSON.stringify({ empty: pasted.empty, nbsp: pasted.nbsp }));
check("only the English words keep a language of their own", JSON.stringify(pasted.languages) === JSON.stringify(["en:Good morning"]), JSON.stringify(pasted.languages));
check("Word's fonts and colours don't come in", pasted.fonts === 0, String(pasted.fonts));
check("č, š and ž as written", ["ŽAREL Š in Č", "pismo za Žana.", "ugasniti luč.", "„Si prišla?“ je vprašala babica — tiho"].every((words) => pasted.text.includes(words)), pasted.text.slice(0, 120));
check(
  "nothing of Word's markup shows: no bullets, numbers or notes typed in, no o:p, no [if …]",
  !/^[·o§]\s|\[1\]|\[if|endif|mso-|o:p|Babica je govorila po dolenjsko/m.test(pasted.text),
  pasted.text.split("\n").filter((line) => /^[·o§]\s|\[1\]|\[if|endif|mso-|o:p|Babica/.test(line)).join(" / "),
);

// Saved as such.
await page.key("s", "KeyS", 83, 2);
await until(`/^Saved/.test(document.querySelector(".titlebar .save")?.textContent.trim() ?? "")`);
const stored = await page.run(`(() => { for (const db of window.__PV_HARNESS__.books.values()) { const r = db.exec("SELECT c.content_json FROM chapters c JOIN projects p ON c.project_id = p.id WHERE p.title LIKE 'Why I write by hand first%'"); if (r[0]) return r[0].values[0][0]; } return ""; })()`);
check("saved with its lists and footnote", stored.includes('"type":"bulletList"') && stored.includes('"type":"orderedList"') && stored.includes('"text":"Babica je govorila po dolenjsko."'), stored.length + " characters");

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
