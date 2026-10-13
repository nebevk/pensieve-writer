// Checks today's word count behind the Goals list: a duplicated chapter doesn't count as written, the
// count carries on when another book is opened and when coming back, and a goal typed as "2.000" is
// two thousand. Usage: node day-count-check.mjs [port]
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
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
const today = async () => Number(((await page.run(`document.querySelector(".statusbar .today")?.textContent ?? ""`)).match(/[\d,]+/)?.[0] ?? "-1").replace(/,/g, ""));

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en', panel: 'goals' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);

// Example books, so there is another book to open.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);

await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(500);
await toEnd();
await page.key("Enter", "Enter", 13);
await page.type("One two three four five six seven eight nine ten.");
await sleep(1500);
const first = await today();
check("ten words written today", first === 10, String(first));

// A copy of a chapter isn't writing.
const chapterCount = () => page.run(`document.querySelectorAll(".sidebar li button .name").length`);
const beforeCopy = await chapterCount();
await page.clickText(".sidebar .chapter-actions button", "Duplicate");
await sleep(1500);
check("Duplicate makes a copy of the chapter", (await chapterCount()) === beforeCopy + 1, `${beforeCopy} -> ${await chapterCount()}`);
check("duplicating a chapter leaves today's count", (await today()) === first, String(await today()));

// Another book: today's words go on counting there, then back here.
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".project", "The Lantern series");
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").length > 50`);
await sleep(800);
check("today's count carries into the next book opened", (await today()) === first, String(await today()));
await toEnd();
await page.key("Enter", "Enter", 13);
await page.type("Five more words right here.");
await sleep(1500);
const second = await today();
check("and counts what is written there", second === first + 5, String(second));
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
const welcome = await page.run(`[...document.querySelectorAll(".project")].map((el) => el.textContent.trim().slice(0, 40))`);
await page.run(`(() => { const card = [...document.querySelectorAll(".project")].find((el) => !/Lantern|Zgodbe|Ferry|Slow|Collection|Essay|hand/i.test(el.textContent)); card?.click(); return !!card; })()`);
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
check("coming back keeps the day's count, not the gap between the books", (await today()) === second, `${await today()} (cards ${JSON.stringify(welcome)})`);

// A goal typed the Slovenian way, with a dot for thousands.
await until(`!!document.querySelector("aside.panel .goal input")`);
await page.run(`(() => { const input = document.querySelector("aside.panel .goal input"); input.value = "2.000"; input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
await sleep(400);
const goal = await page.run(`({ field: document.querySelector("aside.panel .goal input").value, saved: JSON.parse(localStorage.getItem("pensieve-prefs")).dailyGoal })`);
check("a goal typed as 2.000 is two thousand", goal.saved === 2000 && goal.field === "2000", JSON.stringify(goal));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
