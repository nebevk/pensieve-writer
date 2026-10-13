// Checks the last review's three findings: Ctrl+Backspace and a selection deleted across the title keep
// the text below as its own line; an article's title line names the book; an article's headings never
// split it. Usage: node critic-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { clickFound } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1500, height: 900 });
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
const lines = () => page.run(`[...document.querySelectorAll(".paper .ProseMirror > *")].slice(0, 3).map((el) => el.tagName + ":" + el.textContent.trim().slice(0, 30))`);
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
/** Selects from `startOffset` in block `start` to `endOffset` in block `end` (a caret when they match). */
const select = async (start, startOffset, end, endOffset) => {
  await page.run(`(() => {
    const editor = document.querySelector(".paper .ProseMirror");
    const textIn = (index) => document.createTreeWalker(editor.children[index], NodeFilter.SHOW_TEXT).nextNode();
    editor.focus();
    const range = document.createRange();
    range.setStart(textIn(${start}), ${startOffset});
    range.setEnd(textIn(${end}), ${endOffset});
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    return true;
  })()`);
  await sleep(200);
};
const setStyle = (value) => page.run(`(() => { const select = [...document.querySelectorAll("select")].find((el) => [...el.options].some((option) => option.value === "h2")); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
const start = await lines();

// Ctrl+Backspace at the start of the text, and Ctrl+Delete at the end of the title, join nothing.
await select(1, 0, 1, 0);
await page.key("Backspace", "Backspace", 8, 2);
await sleep(300);
check("Ctrl+Backspace at the start of the text leaves the title alone", JSON.stringify(await lines()) === JSON.stringify(start), (await lines()).join(" | "));
await select(0, 7, 0, 7);
await page.key("Delete", "Delete", 46, 2);
await sleep(300);
check("Ctrl+Delete at the end of the title leaves the text alone", JSON.stringify(await lines()) === JSON.stringify(start), (await lines()).join(" | "));

// A selection from the title into the text, deleted: the title keeps its start, the text its own line.
await select(0, 3, 1, 5);
await page.key("Delete", "Delete", 46);
await sleep(300);
const crossed = await lines();
check("deleting across the title keeps the rest of the text a line of its own", crossed[0] === "H2:Wel" && crossed[1].startsWith("P:page is only here"), crossed.join(" | "));
await page.key("z", "KeyZ", 90, 2);
await sleep(300);
check("Undo puts both back", JSON.stringify(await lines()) === JSON.stringify(start), (await lines()).join(" | "));

// The example article: its title line names the book, and its headings never split it.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
// The article is a one-page writing in The Lantern series, in its Published folder.
await page.clickText(".project", "The Lantern series");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await page.clickText(".sidebar .views button", "Library");
await until(`!!document.querySelector(".library")`);
await clickFound(page, `[...document.querySelectorAll(".library button.tree-row.writing")].find((el) => el.textContent.includes("Why I write by hand first"))`);
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("keyboard")`);
await sleep(800);
const article = await lines();
const sections = await page.run(`[...document.querySelectorAll(".paper .ProseMirror > h1, .paper .ProseMirror > h2, .paper .ProseMirror > h3")].map((el) => el.tagName + ":" + el.textContent.trim().slice(0, 20))`);
check("the article opens with its title line and keeps its section headings", article[0] === "H2:Why I write by hand first" && sections.length >= 3, sections.join(" | "));
await select(0, 25, 0, 25);
await page.type(" today");
await sleep(1500);
const bar = await page.run(`document.querySelector(".titlebar .project")?.textContent.trim()`);
check("the article's title line names the writing in the window bar", bar === "Why I write by hand first today", bar);
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h2");
await page.type("A new section");
await page.key("Enter", "Enter", 13);
await page.type("Its first words.");
await sleep(3000);
const whole = await page.run(`document.querySelector(".paper .ProseMirror").innerText`);
check("a Heading 2 in an article stays in the article", whole.includes("pen is slow") && whole.includes("A new section") && whole.includes("Its first words."), whole.slice(-80).replace(/\s+/g, " "));
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
const shown = await page.run(`document.querySelector(".home .continue .running span")?.textContent.trim() ?? ""`);
// The page her last line is on, counted from the text as find counts "p. 4" (HOME-11).
const articleText = await page.run(`(() => { for (const db of window.__PV_HARNESS__.books.values()) { const r = db.exec("SELECT c.plain_text FROM chapters c JOIN projects p ON c.project_id = p.id WHERE p.title = 'Why I write by hand first today'"); if (r[0]) return r[0].values[0][0]; } return ""; })()`);
const articlePage = Math.floor(Math.max(0, articleText.trimEnd().length - 1) / 2750) + 1;
check("Home shows the article under its new title, and the page her last line is on", articleText.length > 0 && shown === `Why I write by hand first today · p. ${articlePage}`, `${shown} (${articleText.length} characters)`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
