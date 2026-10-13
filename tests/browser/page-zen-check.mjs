// Checks the plain chapter page (titles as Heading 2, parts as Heading 1, a new chapter from a Heading 2),
// the wider page, Zen as one plain page, and Home's greeting for Eva. Usage: node page-zen-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1500, height: 900 });
await page.harness();
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
const lines = () => page.run(`[...document.querySelectorAll(".paper .ProseMirror > *")].slice(0, 4).map((el) => el.tagName + ":" + el.textContent.trim().slice(0, 30))`);
const chapterNames = () => page.run(`[...document.querySelectorAll(".sidebar .name, aside .name")].map((el) => el.textContent.trim()).filter(Boolean)`);
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
const setStyle = (value) => page.run(`(() => { const select = [...document.querySelectorAll("select")].find((el) => [...el.options].some((option) => option.value === "h2")); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
const hello = await page.run(`document.querySelector(".home h1.greeting strong")?.textContent.trim()`);
check("Home greets Eva", /^(Good morning|Good afternoon|Good evening|Late again), Eva\.$/.test(hello ?? ""), hello);

// The page: only the text, its first line the chapter's title.
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
const first = await lines();
check("the page starts with the chapter's title as Heading 2", first[0] === "H2:Welcome", first.join(" | "));
const furniture = await page.run(`document.querySelectorAll(".paper .running, .paper .chapter-label, .paper .chapter-title").length`);
check("no running head, chapter label or title above the text", furniture === 0);
const cap = await page.run(`(() => { const p = document.querySelector(".paper .ProseMirror > p"); const letter = getComputedStyle(p, "::first-letter"); return { float: letter.float, size: letter.fontSize, text: getComputedStyle(p).fontSize }; })()`);
check("no big first letter", cap.float === "none" && cap.size === cap.text, JSON.stringify(cap));
const width = await page.run(`(() => { const paper = document.querySelector(".paper").getBoundingClientRect().width; const text = document.querySelector(".paper .ProseMirror").getBoundingClientRect().width; return { paper: Math.round(paper), text: Math.round(text) }; })()`);
check("the page is wider than the old 600px sheet", width.paper >= 700 && width.text >= 620, JSON.stringify(width));
await page.shoot(`${shots}page-1500.png`);

// A Heading 2 at the end starts a new chapter once it is named and left, and the page follows into it.
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h2");
await sleep(400);
check("an empty Heading 2 starts nothing yet", (await chapterNames()).length === 2, JSON.stringify(await chapterNames()));
await page.type("Fog on the Sava");
await sleep(400);
check("nor one still being named", (await chapterNames()).length === 2, JSON.stringify(await chapterNames()));
await page.key("Enter", "Enter", 13);
check("Enter after its name starts the new chapter", await until(`[...document.querySelectorAll(".sidebar .name, aside .name")].length === 3`), JSON.stringify(await chapterNames()));
await until(`(document.querySelector(".paper .ProseMirror > h2")?.textContent ?? "") === "Fog on the Sava"`);
await sleep(300);
await page.type("The fog came down at Zidani Most.");
await sleep(1200);
const names = await chapterNames();
check("the new chapter sits after the one it came from, named by its title line", JSON.stringify(names.slice(0, 2)) === JSON.stringify(["Welcome", "Fog on the Sava"]), JSON.stringify(names));
const newPage = await lines();
check("the new chapter's page has its title and its text", newPage[0] === "H2:Fog on the Sava" && newPage[1].startsWith("P:The fog came down"), newPage.join(" | "));
const count = await page.run(`document.querySelector(".statusbar")?.innerText ?? ""`);
check("the word count leaves out the title", /\b7 words\b/.test(count), count.replace(/\s+/g, " ").slice(0, 60));
const welcome = await page.run(`(() => { const db = [...window.__PV_HARNESS__.books.values()][0]; return null; })()`);
await page.run(`(() => { const name = [...document.querySelectorAll(".name")].find((el) => el.textContent.trim() === "Welcome"); (name.closest("button, [role=button], li") ?? name).click(); return true; })()`);
await sleep(800);
const back = await page.run(`document.querySelector(".paper .ProseMirror")?.innerText ?? ""`);
check("the first chapter no longer has the new chapter's text", !back.includes("Zidani Most") && back.includes("Delete this page"));

// A big screen gives a wider page, within reason.
await page.send("Emulation.setDeviceMetricsOverride", { width: 2560, height: 1400, deviceScaleFactor: 1, mobile: false });
await sleep(800);
const wide = await page.run(`(() => ({ paper: Math.round(document.querySelector(".paper").getBoundingClientRect().width), text: Math.round(document.querySelector(".paper .ProseMirror").getBoundingClientRect().width) }))()`);
check("a big screen gives a wider page", wide.paper >= 900 && wide.text >= 780, JSON.stringify(wide));
await page.shoot(`${shots}page-2560.png`);
await page.send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(500);

// Zen: one plain page with a quiet bar at the bottom.
await page.clickText(".statusbar button", "Zen");
await until(`!!document.querySelector(".zen-tools")`);
await sleep(600);
const zen = await page.run(`(() => {
  const writing = getComputedStyle(document.querySelector(".writing")).backgroundColor;
  const paper = getComputedStyle(document.querySelector(".paper")).backgroundColor;
  const under = document.querySelector(".sheet-under") ? getComputedStyle(document.querySelector(".sheet-under")).display : "none";
  const shadow = getComputedStyle(document.querySelector(".paper")).boxShadow;
  return { writing, paper, under, shadow, sparks: !!document.querySelector("canvas") && getComputedStyle(document.querySelector("canvas")).display !== "none" };
})()`);
check("Zen is the paper's colour from edge to edge", zen.writing === zen.paper && zen.under === "none" && zen.shadow === "none", JSON.stringify(zen));
await page.shoot(`${shots}zen-1500.png`);
await page.selectWords("Zidani Most") === "missing" && (await toEnd());
await page.clickText(".paper .ProseMirror", "");
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); return true; })()`);
await page.selectWords("Delete this page");
await sleep(300);
await page.click('.zen-tools button[aria-label="Bold"]');
check("Zen's bar makes the selection bold", await until(`[...document.querySelectorAll(".paper .ProseMirror strong")].some((el) => el.textContent.includes("Delete this page"))`));
await page.key("Escape", "Escape", 27);
check("Esc leaves Zen", await until(`!document.querySelector(".zen-tools") && !!document.querySelector(".statusbar")`));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
