// Checks everything that now loads after Home: writing, comments and what they turn into, footnotes,
// the Notes view with other names, the other views, Settings and printing. Usage: node lazy-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect();
await page.harness();
await page.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => { const look = () => { if (document.querySelector(".home .continue")) window.__homeAt = performance.now(); else requestAnimationFrame(look); }; requestAnimationFrame(look); })();`,
});
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const text = (selector) => page.run(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ""`);

// A clean start in this browser.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
check("Home shows", await until(`!!document.querySelector(".home .continue")`));
await sleep(2500);
const split = await page.run(`(() => { const scripts = performance.getEntriesByType("resource").filter((e) => e.name.endsWith(".js")); return { before: scripts.filter((e) => e.startTime < window.__homeAt).length, after: scripts.filter((e) => e.startTime >= window.__homeAt).length }; })()`);
check("the rest is read after Home", split.after > 0, `${split.before} scripts before Home, ${split.after} after`);

// Writing.
await page.clickText(".home button", "Continue writing");
check("the editor opens", await until(`!!document.querySelector(".paper .ProseMirror")`));
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Ana met Babica at the old mill by the river.");
await sleep(300);
check("typing reaches the page", (await text(".paper .ProseMirror")).includes("Babica at the old mill"));
await page.click("button.more:not(.fewer)");
await sleep(300);

// A comment, turned into a to-do.
await page.selectWords("Babica");
await sleep(200);
await page.click('button[aria-label="Comment"]');
check("a comment card opens", await until(`!!document.querySelector(".card textarea")`));
await sleep(300);
await page.type("Check her name");
await sleep(400);
await page.clickText(".card button", "To-do");
check("the comment becomes a to-do", await until(`!document.querySelector(".card") && document.body.innerText.includes("Check her name")`));

// A comment, turned into a note, by the keyboard shortcut.
await page.selectWords("old mill");
await sleep(200);
await page.key("m", "KeyM", 77, 2 | 1);
check("Ctrl+Alt+M opens a comment", await until(`!!document.querySelector(".card textarea")`));
await sleep(300);
await page.clickText(".card button", "Note");
if (!(await page.run(`[...document.querySelectorAll(".paper .ProseMirror [data-note-id]")].some((el) => el.textContent.includes("old mill"))`))) await sleep(1500);
console.log("     around old mill:", await page.run(`(() => { const html = document.querySelector(".paper .ProseMirror").innerHTML; const at = html.indexOf("old mill"); return html.slice(Math.max(0, at - 160), at + 40); })()`));
check(
  "the comment becomes a linked note",
  await until(`!document.querySelector(".card") && [...document.querySelectorAll(".paper .ProseMirror [data-note-id], .paper .ProseMirror .note-link")].some((el) => el.textContent.includes("old mill"))`),
);

// A footnote: the panel stays open while its text is written.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await sleep(200);
await page.click('button[aria-label="Footnote"]');
check("a footnote opens its note", await until(`!!document.querySelector(".footnote-edit textarea")`));
await page.run(`document.querySelector(".footnote-edit textarea").focus(), true`);
await page.type("From grandmother's diary");
await sleep(500);
const footnote = await page.run(`({ open: !!document.querySelector(".footnote-edit textarea"), value: document.querySelector(".footnote-edit textarea")?.value, listed: document.querySelector(".page-notes")?.innerText ?? "" })`);
check("the footnote keeps its panel while typing", footnote.open && footnote.value === "From grandmother's diary", JSON.stringify(footnote.value));
check("the footnote is listed under the page", footnote.listed.includes("From grandmother's diary"));

// Notes: other names, and search by them.
await page.clickText("[role=tab]", "Notes");
check("the Notes view opens", await until(`!!document.querySelector(".search input")`));
await page.clickText("button", "old mill");
await sleep(500);
const aliasField = await page.run(`(() => { const field = document.querySelector("input.aliases"); if (!field) return false; field.focus(); return true; })()`);
check("a note has an Other names field", aliasField);
await page.type("watermill");
await sleep(600);
await page.run(`(() => { const box = document.querySelector(".search input"); box.focus(); return true; })()`);
await page.type("watermill");
await sleep(500);
const listed = () => page.run(`[...document.querySelectorAll(".list .row .name")].map((name) => name.textContent.trim())`);
const byAlias = await listed();
await page.run(`(() => { const box = document.querySelector(".search input"); box.select(); return true; })()`);
await page.type("zzzz");
await sleep(400);
const byNothing = await listed();
check("search finds a note by another name", byAlias.length === 1 && byAlias[0] === "old mill" && byNothing.length === 0, `${JSON.stringify(byAlias)} for watermill, ${byNothing.length} for zzzz`);

// The other views.
for (const [tab, expect] of [["To-dos", "Check her name"], ["Outline", "1"], ["Book", "Babica"]]) {
  await page.clickText("[role=tab]", tab);
  check(`the ${tab} view opens`, await until(`(document.querySelector(".alt")?.innerText ?? "").includes(${JSON.stringify(expect)})`));
}

// Settings, and printing waits for the Book view.
await page.clickText("[role=tab]", "Write");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await page.click(".gear");
check("Settings opens", await until(`!!document.querySelector(".window")`));
await page.run(`window.print = () => { window.__printed = document.querySelector(".alt")?.innerText.length ?? 0; }, true`);
await page.clickText(".window nav button, .window [role=tab]", "Backup");
await sleep(300);
await page.clickText(".window button", "Print");
check("printing shows the whole book first", await until(`(window.__printed ?? 0) > 20`), `${await page.run("window.__printed ?? 0")} characters`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
