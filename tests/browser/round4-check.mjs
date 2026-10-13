// Checks the fourth review's page-flow fixes: letters typed straight after the Enter that starts a new
// chapter land in it; Undo of a split puts back the parts a Heading 1 changed; and Undo refuses once
// anything was written since, a title included. Usage: node round4-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

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
const lines = () => page.run(`[...document.querySelectorAll(".paper .ProseMirror > *")].map((el) => el.tagName + ":" + el.textContent.trim().slice(0, 24))`);
const names = () => page.run(`[...document.querySelectorAll(".sidebar li button .name")].map((el) => el.textContent.trim())`);
const parts = () => page.run(`[...document.querySelectorAll(".sidebar li")].map((li) => li.classList.contains("part") ? "[" + li.textContent.trim() + "]" : li.querySelector(".name")?.textContent.trim()).filter(Boolean)`);
const notice = () => page.run(`document.querySelector(".write-notice")?.textContent.replace(/\\s+/g, " ").trim() ?? ""`);
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
const setStyle = (value) => page.run(`(() => { const select = [...document.querySelectorAll("select")].find((el) => [...el.options].some((option) => option.value === "h2")); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const openChapter = (name) => page.run(`(() => { const el = [...document.querySelectorAll(".sidebar li button")].find((b) => b.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)}); if (!el) return "missing"; el.click(); return "ok"; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
const start = await names();

// Letters typed straight after the Enter that starts a chapter go into it.
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h2");
await page.type("Chapter Four");
await page.key("Enter", "Enter", 13);
await page.type("It rained.");
await sleep(1500);
const typed = await lines();
check("letters typed straight after Enter land in the new chapter", typed[0] === "H2:Chapter Four" && typed.some((line) => line === "P:It rained."), typed.join(" | "));
await sleep(10500);

// Undo refuses once something was written since, even only in the title.
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h2");
await page.type("Chapter Five");
await page.key("Enter", "Enter", 13);
await sleep(400);
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); const title = editor.children[0]; editor.focus(); const text = document.createTreeWalker(title, NodeFilter.SHOW_TEXT).nextNode(); const range = document.createRange(); range.setStart(text, text.length); range.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await sleep(200);
await page.type("!");
await sleep(2600);
const before = (await names()).length;
await page.click(".notice-undo");
await sleep(1200);
check("Undo refuses once the new chapter's title was changed", (await names()).length === before && /stays/.test(await notice()), `${JSON.stringify(await names())} ${await notice()}`);
await sleep(4000);

// Undo of a Heading 1 split puts the chapters after it back in their parts.
await openChapter("Welcome");
await until(`(document.querySelector(".paper .ProseMirror > h2")?.textContent ?? "") === "Welcome"`);
await sleep(600);
const partsBefore = await parts();
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h1");
await page.type("Part Two");
await page.key("Enter", "Enter", 13);
await until(`document.querySelectorAll(".sidebar li.part").length > 0`);
await sleep(300);
const split = await parts();
await page.click(".notice-undo");
await sleep(1500);
const undone = await parts();
check("Undo of a new part puts every chapter back in its part", JSON.stringify(undone) === JSON.stringify(partsBefore), `${JSON.stringify(partsBefore)} -> ${JSON.stringify(split)} -> ${JSON.stringify(undone)}`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
void start;
