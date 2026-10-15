// A save at least every 10 seconds while she types on without a pause (ARCH-3): the save waited for a
// 2-second pause, so steady typing and a crash lost all of it. Not while she names a new chapter in its
// heading, where a save would cut the page under her cursor: that one still waits for her pause.
// Usage: node steady-save-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
await page.harness({ keep: true });
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
const FIRST = "C:\\Users\\Eva\\Documents\\Pensieve\\My first project\\pensieve.db";
const DB = `window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}`)})`;
const saved = (words) => `JSON.stringify(${DB}.exec("SELECT plain_text FROM chapters")[0]?.values ?? []).includes(${JSON.stringify(words)})`;
const chapterCount = () => page.run(`${DB}.exec("SELECT count(*) FROM chapters")[0]?.values[0][0] ?? 0`);
const firstLine = () => page.run(`document.querySelector(".paper .ProseMirror > *")?.textContent.trim() ?? ""`);
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
const setStyle = (value) => page.run(`(() => { const select = [...document.querySelectorAll("select")].find((el) => [...el.options].some((option) => option.value === "h2")); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
/** Types `text` a letter every `everyMs`, as steady typing with no pause; `watch` runs after each letter. */
const typeSteadily = async (text, everyMs, watch) => {
  const start = Date.now();
  for (const letter of text) {
    await page.type(letter);
    await sleep(everyMs);
    await watch(Date.now() - start);
  }
  return Date.now() - start;
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(2500);

// Steady typing, a letter every quarter of a second: saved by 10 seconds, without waiting for a pause.
await toEnd();
await page.key("Enter", "Enter", 13);
const words = "Megla se je spustila nad Zidani Most, čez reko in žerjav, šele potem je prišel dež.";
let reached = -1;
const took = await typeSteadily(words, 250, async (at) => {
  if (reached < 0 && (await page.run(saved("Megla se")))) reached = at;
});
check("steady typing is saved within 10 seconds, with no pause", reached >= 0 && reached <= 11000, `saved at ${reached} ms of ${took} ms typing`);
check("and the rest at the pause, č, š and ž with it", await until(saved(words), 40));

// Naming a new chapter in its heading for longer than that: no save cuts the page under her cursor.
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h2");
await sleep(300);
const before = await chapterCount();
const title = await firstLine();
let cut = "";
const named = await typeSteadily("Poglavje o megli, ki je čez Savo segla še dlje", 250, async (at) => {
  const now = { chapters: await chapterCount(), first: await firstLine() };
  if (!cut && (now.chapters !== before || now.first !== title)) cut = `${at} ms: ${JSON.stringify(now)}`;
});
check("a heading named for longer than 10 seconds isn't cut while she types it", !cut && named > 10500, cut || `${named} ms`);
check("her pause makes it a chapter, as before", await until(`${DB}.exec("SELECT count(*) FROM chapters")[0]?.values[0][0] === ${before + 1}`, 40));
check("the page follows her there", await until(`document.querySelector(".paper .ProseMirror > *")?.textContent.trim() === "Poglavje o megli, ki je čez Savo segla še dlje"`, 20), await firstLine());

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
