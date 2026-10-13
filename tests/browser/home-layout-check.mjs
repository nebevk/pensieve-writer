// Checks Home as the owner asked on 12 October: on the left the greeting and stats, the Continue card
// (what she wrote last) and a short list of to-dos; on the right every project, as cards or as the
// library's tree, the choice remembered; no chapter strip, no progress bars, no recent notes. A card
// opens its project, the tree's chapters and notes open in Write. At 1366 and 1536 pixels wide.
// Usage: CDP_PORT=9334 node --experimental-websocket home-layout-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1366, height: 768 });
await page.harness({ keep: true });
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
const home = () =>
  page.run(`(() => {
    const left = document.querySelector(".home .left");
    const right = document.querySelector(".home .right");
    if (!left || !right) return null;
    const box = (el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width) }; };
    return {
      left: box(left),
      right: box(right),
      greeting: left.querySelector("h1")?.textContent.trim(),
      continueCard: !!left.querySelector(".continue .go"),
      todos: [...left.querySelectorAll(".todos .item")].map((item) => ({ text: item.querySelector(".text")?.textContent.trim(), meta: !!item.querySelector(".meta") })),
      cards: [...right.querySelectorAll(".grid .card:not(.new)")].map((card) => card.querySelector(".title")?.textContent.trim()),
      newCard: !!right.querySelector(".grid .card.new"),
      tree: !!right.querySelector(".library"),
      strip: !!document.querySelector(".home .strip, .home .bars"),
      bars: document.querySelectorAll(".home .bar").length,
      recentNotes: [...document.querySelectorAll(".home h2")].map((h) => h.textContent.trim()),
      overflowX: document.querySelector("section.home").scrollWidth > document.querySelector("section.home").clientWidth,
    };
  })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await sleep(800);

let shown = await home();
check("Home has a left column and a right one, side by side, with nothing spilling sideways", shown && shown.left.right < shown.right.left && !shown.overflowX, JSON.stringify(shown && { left: shown.left, right: shown.right }));
check("on the left: the greeting, the Continue card and a short to-do list, one line each", !!shown.greeting && shown.continueCard && shown.todos.length <= 5 && shown.todos.every((item) => !item.meta), JSON.stringify(shown.todos));
check("on the right: every project as a card, and one for a new project", shown.cards.length >= 3 && shown.newCard, shown.cards.join(" | "));
check("no chapter strip, no progress bars and no recent notes", !shown.strip && shown.bars === 0 && !shown.recentNotes.some((h) => /Recent notes/.test(h)), shown.recentNotes.join(" | "));
await page.shoot(`${shots}home-grid-1366.png`);

// The list: the library's tree, remembered.
await page.clickText(".home .right .switch button", "List");
await until(`!!document.querySelector(".home .right .library")`);
await sleep(400);
shown = await home();
check("List shows the library's tree in the projects' place", shown.tree && shown.cards.length === 0);
await page.shoot(`${shots}home-list-1366.png`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .right")`);
check("the choice is remembered", await until(`!!document.querySelector(".home .right .library")`));

// The tree opens what it picks in Write: a chapter of the open writing.
const chapter = await page.run(`(() => { const row = document.querySelector(".home .right .chapters .tree-row"); if (!row) return ""; const name = row.querySelector(".chapter-name")?.textContent.trim(); row.click(); return name; })()`);
check("a chapter in Home's tree opens in Write", !!chapter && (await until(`!!document.querySelector(".paper .ProseMirror")`)), chapter);
await page.click(".titlebar .home-link, .titlebar .mark");
await until(`!!document.querySelector(".home .right")`);
await sleep(400);

// Back to the cards; a card opens its project.
await page.clickText(".home .right .switch button", "Grid");
await until(`!!document.querySelector(".home .right .grid")`);
const other = await page.run(`(() => { const card = [...document.querySelectorAll(".home .grid .card:not(.new):not(.current)")][0]; if (!card) return ""; const name = card.querySelector(".title")?.textContent.trim(); card.click(); return name; })()`);
check("a card opens its project in Write", !!other && (await until(`!!document.querySelector(".paper .ProseMirror")`)) && (await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").length > 0`)), other);

// The laptop's other width.
await page.send("Emulation.setDeviceMetricsOverride", { width: 1536, height: 864, deviceScaleFactor: 1, mobile: false });
await page.click(".titlebar .home-link, .titlebar .mark");
await until(`!!document.querySelector(".home .right .grid")`);
await sleep(500);
shown = await home();
check("at 1536 wide, side by side, nothing spilling", shown && shown.left.right < shown.right.left && !shown.overflowX, JSON.stringify(shown && { left: shown.left, right: shown.right }));
await page.shoot(`${shots}home-grid-1536.png`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
