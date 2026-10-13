// Checks undo goes back a word at a time, as in Word (owner, 8 October): steady typing, one key every
// 120 ms, used to be one step that a single Ctrl+Z took whole. A word and its space are one step, as in
// Word, and a typed "# " goes back in one. Ctrl+Y and the toolbar's Undo too.
// Usage: node undo-check.mjs
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const page = await connect({ width: 1400, height: 860 });
await page.harness();
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.mouse(".home .continue .go", "");
await sleep(1500);
const text = () => page.run(`document.querySelector(".paper .ProseMirror").textContent`);
await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`);
await sleep(300);
const start = await text();
const typeSteadily = async (words) => {
  for (const ch of words) {
    await page.type(ch);
    await sleep(120);
  }
};
await typeSteadily(" Ena dva tri.");
await sleep(2600);
const ctrl = (key, code, keyCode) => page.key(key, code, keyCode, 2);
await ctrl("z", "KeyZ", 90);
await sleep(300);
check("Ctrl+Z after steady typing takes back the last word only", (await text()) === `${start} Ena dva `, JSON.stringify((await text()).slice(-20)));
await ctrl("z", "KeyZ", 90);
await sleep(300);
check("and again the word before it, with its space, as Word does", (await text()) === `${start} Ena `, JSON.stringify((await text()).slice(-20)));
await ctrl("y", "KeyY", 89);
await sleep(300);
check("Ctrl+Y brings a word back", (await text()) === `${start} Ena dva `, JSON.stringify((await text()).slice(-20)));
// A new paragraph is a step of its own too.
await page.key("End", "End", 35);
await page.key("Enter", "Enter", 13);
await sleep(150);
await typeSteadily("Nov");
await sleep(700);
const paragraphs = await page.run(`document.querySelectorAll(".paper .ProseMirror > p").length`);
await ctrl("z", "KeyZ", 90);
await sleep(300);
const afterNew = await page.run(`({ text: document.querySelector(".paper .ProseMirror").textContent, paragraphs: document.querySelectorAll(".paper .ProseMirror > p").length })`);
check("a new paragraph and its first word go back in one step, the words before it stay", afterNew.paragraphs === paragraphs - 1 && afterNew.text === `${start} Ena dva `, JSON.stringify({ ...afterNew, text: afterNew.text.slice(-20) }));
// The toolbar's Undo button steps back the same way.
await typeSteadily(" pet šest");
await sleep(700);
await page.mouse(".ribbon button[title^='Razveljavi']", "");
await sleep(300);
check("the toolbar's Undo takes back one word too", (await text()) === `${start} Ena dva  pet `, JSON.stringify((await text()).slice(-20)));
// The full toolbar is open from the start (owner, 8 October), and closing it is remembered.
check("the full toolbar is open from the start", await page.run(`!!document.querySelector(".ribbon.expanded")`));
await page.mouse(".ribbon button.more.fewer", "");
await sleep(300);
const closed = await page.run(`({ short: !document.querySelector(".ribbon.expanded"), saved: JSON.parse(localStorage.getItem("pensieve-prefs")).toolsExpanded })`);
check("closing it gives the short toolbar, and is remembered", closed.short && closed.saved === false, JSON.stringify(closed));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
