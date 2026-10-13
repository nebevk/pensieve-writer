// Checks the polish batch: example books (added, reset, with comments), theme previews, the chapter
// legend, untitled chapters in italics, other names counted beside the page, the Alignment menu and
// the lamp glow behind Notes. Usage: node polish-check.mjs [port]
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
const nav = ".window nav button, .window [role=tab]";
const openSettings = async (section) => {
  await page.click(".gear");
  await until(`!!document.querySelector(".window")`);
  await page.clickText(nav, section);
  await sleep(400);
};
const closeSettings = async () => {
  await page.key("Escape", "Escape", 27);
  await until(`!document.querySelector(".window")`);
};
const clickChapter = (title) =>
  page.run(`(() => { const name = [...document.querySelectorAll(".name")].find((el) => el.textContent.trim() === ${JSON.stringify(title)}); if (!name) return "missing"; (name.closest("button, [role=button], li") ?? name).click(); return "ok"; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en', toolsExpanded: false })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);

// Example books, from Settings.
await openSettings("General");
await page.clickText(".window button", "Add example books");
check("example books are written", await until(`document.body.innerText.includes("The example books are on Home.")`, 200));
const label = await page.run(`[...document.querySelectorAll(".window button")].map((b) => b.textContent.trim()).find((text) => /example books/i.test(text)) ?? ""`);
check("the button now offers to reset them", label === "Reset example books", label);

// Theme previews: each shows a page and its lamp glow.
await page.clickText(nav, "Appearance");
await sleep(400);
const previews = await page.run(`[...document.querySelectorAll(".window .mini")].map((mini) => ({ theme: mini.dataset.theme, glow: !!mini.querySelector(".glow"), lines: mini.querySelectorAll(".page i").length }))`);
check("theme previews show a page with its glow", previews.length >= 4 && previews.every((mini) => mini.glow && mini.lines === 3), previews.map((mini) => mini.theme).join(", "));
await page.clickText(".window button, .window label", "Candlelit");
await sleep(600);
await page.shoot(`${shots}settings-appearance.png`);
await closeSettings();

// Open the example novel and write in it.
await page.clickText(".project", "The Lantern series");
await until(`/The Letter|Fog on the Sava|Grandmother|The Attic/.test(document.querySelector(".home .continue")?.innerText ?? "")`);
await sleep(800);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await clickChapter("The Letter");
await sleep(800);
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("twelve years")`);

// Comments that came with the example.
await until(`document.querySelectorAll(".card").length > 0`);
const cards = await page.run(`[...document.querySelectorAll(".card textarea")].map((area) => area.value)`);
check("the example chapter shows its comments", cards.length >= 1, cards[0]?.slice(0, 40));

// The chapter list: no status legend (hidden since 8 October), and untitled chapters in italics.
const legend = await page.run(`document.querySelector(".legend")?.innerText ?? ""`);
check("the chapter list has no status legend", legend === "", legend.replace(/\s+/g, " "));
const untitled = await page.run(`(() => { const el = document.querySelector(".name.untitled"); return el ? { text: el.textContent.trim(), style: getComputedStyle(el).fontStyle } : null; })()`);
check("an untitled chapter's name is in italics", untitled?.style === "italic", JSON.stringify(untitled));

// Other names count beside the page: "her mother" counts for "Vera, her mother".
await sleep(600);
if (!(await page.run(`!!document.querySelector("aside.panel .row")`))) await page.run(`document.querySelectorAll(".panel-toggle")[1].click(), true`);
await until(`!!document.querySelector("aside.panel .row")`);
const panel = await page.run(`[...document.querySelectorAll("aside.panel .row")].map((row) => ({ title: row.querySelector(".name")?.textContent.trim(), meta: row.querySelector(".times")?.textContent.trim() ?? "" }))`);
const text = await page.run(`document.querySelector(".paper .ProseMirror").innerText`);
const count = (names) => {
  const sorted = [...names].sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.match(new RegExp(`(?<![\\p{L}\\p{N}])(?:${sorted.join("|")})(?![\\p{L}\\p{N}])`, "giu"))?.length ?? 0;
};
const withAlias = count(["Vera, her mother", "her mother", "Vera"]);
const without = count(["Vera, her mother", "Vera"]);
const vera = panel.find((note) => note.title === "Vera, her mother");
check(
  "other names count beside the page",
  !!vera && vera.meta.startsWith(`${withAlias}×`) && withAlias > without,
  `panel says ${vera?.meta ?? "nothing"}; ${withAlias} with "her mother", ${without} without`,
);
await page.shoot(`${shots}write-example.png`);

// The Alignment menu.
await page.selectWords("Not since the night");
await sleep(300);
await page.click('button[aria-label="Alignment"]');
check("Alignment opens its menu", await until(`!!document.querySelector(".align-menu")`));
await page.shoot(`${shots}align-menu.png`, { x: 300, y: 40, width: 900, height: 260 });
await page.click('.align-menu button[title="Align center"]');
await sleep(300);
const aligned = await page.run(`(() => { const p = [...document.querySelectorAll(".paper .ProseMirror p")].find((el) => el.textContent.includes("Not since the night")); return p ? getComputedStyle(p).textAlign : null; })()`);
check("choosing Center centres the paragraph", aligned === "center", aligned);
check("the menu closes after a choice", await until(`!document.querySelector(".align-menu")`, 10));
await page.click('button[aria-label="Alignment"]');
await until(`!!document.querySelector(".align-menu")`);
await page.key("Escape", "Escape", 27);
check("Escape closes the menu", await until(`!document.querySelector(".align-menu")`, 10));

// A to-do added beside the page, then Reset example books takes it away again.
await page.run(`document.querySelectorAll(".panel-toggle")[0].click(), true`);
await until(`!!document.querySelector("form.add input")`);
await page.run(`(() => { const input = document.querySelector("form.add input"); input.focus(); return true; })()`);
await page.type("Remove me on reset");
await page.key("Enter", "Enter", 13);
check("a to-do is added beside the page", await until(`document.body.innerText.includes("Remove me on reset")`));
await openSettings("General");
await page.clickText(".window button", "Reset example books");
check("example books are reset", await until(`document.body.innerText.includes("The example books are on Home.")`, 200));
await closeSettings();
await sleep(800);
await until(`!!document.querySelector(".paper .ProseMirror")`);
// The writings as they were before the reset wait in the project's Deleted folder, to be put back.
const lantern = String.raw`sqlite:C:\Users\Eva\Documents\Pensieve\Examples\The Lantern series\pensieve.db`;
const kept = await page.run(`(() => { const db = window.__PV_HARNESS__.books.get(${JSON.stringify(lantern)}); return db ? db.exec("SELECT COUNT(*) FROM projects WHERE deleted_at <> ''")[0].values[0][0] : -1; })()`);
check("the writings before the reset are kept in Deleted", kept >= 2, String(kept));
await page.clickText("[role=tab]", "Notes");
await until(`!!document.querySelector(".search input")`);
await page.clickText("button", "To-dos");
await until(`(document.querySelector(".desk")?.innerText ?? "").includes("Decide")`);
await sleep(600);
const todos = await page.run(`document.querySelector(".desk")?.innerText ?? ""`);
await page.shoot(`${shots}todos-board.png`);
check("the reset book has its own to-dos again", !todos.includes("Remove me on reset") && todos.includes("Decide which key opens the trunk"));

// The lamp glow behind the Notes desk.
await page.clickText("[role=tab]", "Notes");
await until(`!!document.querySelector(".desk")`);
await sleep(600);
const glow = await page.run(`getComputedStyle(document.querySelector(".desk")).backgroundImage`);
check("the Notes desk has the lamp glow", glow.includes("radial-gradient") && glow.includes("0.22)"), glow.slice(0, 120));
await page.shoot(`${shots}notes-desk.png`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
