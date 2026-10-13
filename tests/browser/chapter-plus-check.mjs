// Checks the "+" for chapters in the tree (owner, 9 October): the open book's row in the library has one
// that adds a chapter at its end; each part has one that adds a chapter at the part's end, in that part,
// unfolding it; both open the new chapter on the page, and the order survives a reload.
// Usage: node --experimental-websocket chapter-plus-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const page = await connect({ width: 1366, height: 768 });
const until = async (expression, tries = 80) => {
  for (let turn = 0; turn < tries; turn += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
// The open writing's chapters, in the Chapters tab: parts as "# name", the one on the page with "*".
const chapterList = () =>
  page.run(`[...document.querySelectorAll(".sidebar .chapter-list button.tree-row")].map((el) => (el.closest("li.part") ? "# " : "") + el.querySelector(".name")?.textContent.trim() + (el.classList.contains("active") ? " *" : ""))`);
const pageTitle = () => page.run(`document.querySelector(".paper .ProseMirror h2")?.textContent.trim() ?? ""`);
const toTab = async (name) => {
  await page.clickText(".sidebar .views button", name);
  await sleep(300);
};

await page.harness({ keep: true });
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".library")`);
await sleep(500);
await page.run(`[...document.querySelectorAll(".library button.tree-row.project")].find((el) => el.textContent.includes("The Lantern series"))?.click(), true`);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Lantern")`);
await sleep(800);
await toTab("Chapters");
const before = await chapterList();
await toTab("Library");

// The open book's row has a +, as the notes have.
const plus = await page.run(`(() => { const row = document.querySelector(".library .with-add > .tree-row.writing.current"); const add = row?.parentElement.querySelector(".row-add"); return row ? { name: row.querySelector(".name")?.textContent.trim(), label: add?.getAttribute("aria-label") } : null; })()`);
check("the open book's row in the library has a + for a new chapter", plus?.name === "The Lantern House" && plus.label === "New chapter", JSON.stringify(plus));
const others = await page.run(`[...document.querySelectorAll(".library .with-add > .tree-row.writing")].filter((row) => !row.classList.contains("current")).length`);
check("only the open book has one", others === 0, `${others} others`);
await page.run(`document.querySelector(".library .with-add > .tree-row.writing.current").parentElement.querySelector(".row-add").click(), true`);
await until(`(document.querySelector(".paper .ProseMirror h2")?.textContent ?? "").trim() === "Chapter ${before.filter((row) => !row.startsWith("# ")).length + 1}"`);
await sleep(600);
await toTab("Chapters");
let after = await chapterList();
const count = before.filter((row) => !row.startsWith("# ")).length;
check("it adds a chapter at the end, open on the page", after.at(-1) === `Chapter ${count + 1} *` && after.length === before.length + 1 && (await pageTitle()) === `Chapter ${count + 1}`, after.join(" | "));

// Each part has a +: a new chapter at the part's end, in the part.
await toTab("Library");
const partPlus = await page.run(`[...document.querySelectorAll(".library li.part .row-add")].map((add) => add.getAttribute("aria-label"))`);
check("each part has a + for a chapter at its end", partPlus.includes("New chapter at the end of “Part One”") && partPlus.includes("New chapter at the end of “Part Two”"), partPlus.join(" | "));
await page.run(`(() => { const part = [...document.querySelectorAll(".library li.part")].find((li) => li.querySelector(".name")?.textContent.trim() === "Part One"); part.querySelector(".row-add").click(); return true; })()`);
await until(`(document.querySelector(".paper .ProseMirror h2")?.textContent ?? "").trim() === "Chapter 3"`);
await sleep(600);
const partOne = await page.run(`(() => { const part = [...document.querySelectorAll(".library li.part")].find((li) => li.querySelector(".name")?.textContent.trim() === "Part One"); return part?.querySelector(".tree-row").getAttribute("aria-expanded"); })()`);
check("the part unfolds to show it", partOne === "true", partOne);
await page.shoot(`${shots}chapter-plus.png`, { x: 0, y: 90, width: 420, height: 420 });
await toTab("Chapters");
after = await chapterList();
const expected = ["# Part One", "The Letter", "Fog on the Sava", "Chapter 3 *", "# Part Two", "Grandmother's Keys", "The Attic"];
check("the new chapter comes after the part's last chapter, still in the part", JSON.stringify(after.slice(0, expected.length)) === JSON.stringify(expected), after.join(" | "));
check("the page shows it", (await pageTitle()) === "Chapter 3");

// After a reload, the order is kept.
await sleep(1500);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".sidebar")`);
await sleep(800);
await toTab("Chapters");
const kept = (await chapterList()).map((row) => row.replace(/ \*$/, ""));
check("after a reload the chapters are in the same order", JSON.stringify(kept) === JSON.stringify(after.map((row) => row.replace(/ \*$/, ""))), kept.join(" | "));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
