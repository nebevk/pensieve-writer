// Checks the new Oris (owner, 8 October), on the example stories at 1366 × 768: the chapters as cards or
// as a list (remembered), with their words, goals and synopses; dragged into a new order, or moved with
// the keyboard on their handle; renamed with a double click; opened in Write; a new chapter named where
// it appears; parts as headings. Usage: node outline-check.mjs
import { connect, sleep } from "./cdp.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shots = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] ?? 4176);
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
await page.harness();
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "Splošno");
await sleep(300);
await page.clickText(".window button", "Dodaj primere knjig");
await until(`document.body.innerText.includes("Primeri knjig so na domači strani.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.clickText(".home button", "Nadaljuj s pisanjem");
await until(`!!document.querySelector(".library")`);
await page.run(`(() => { const row = [...document.querySelectorAll(".library button.tree-row.project")].find((el) => el.querySelector(".name")?.textContent.trim() === "Zgodbe ob reki"); row?.click(); return !!row; })()`);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Zgodbe")`);
await sleep(800);
await page.clickText(".titlebar [role=tab]", "Oris");
await until(`!!document.querySelector(".outline .item")`);
await sleep(400);

const ITEMS = `[...document.querySelectorAll(".outline .item")].map((item) => ({
  num: item.querySelector(".num")?.textContent.trim(),
  title: item.querySelector(".title")?.textContent.trim() ?? item.querySelector(".title-field")?.value,
  words: item.querySelector(".words")?.textContent.trim().replace(/\\s+/g, " "),
  synopsis: item.querySelector(".synopsis")?.value ?? "",
  top: Math.round(item.getBoundingClientRect().top),
}))`;
const items = () => page.run(ITEMS);
const titles = async () => (await items()).map((item) => item.title);
const head = await page.run(`({ title: document.querySelector(".outline h1")?.textContent.trim(), about: document.querySelector(".outline .about p")?.textContent.trim() })`);
let list = await items();
check("Oris shows the writing's name, its chapters and words", head.title === "Zgodbe ob reki" && /^4 poglavja · \d+ besed/.test(head.about), JSON.stringify(head));
check("the chapters as cards, numbered, with their words toward their goals and their synopses", list.length === 4 && list[0].num === "1" && list[0].title === "Brod" && /besed \/ 400/.test(list[0].words) && list[0].synopsis.length > 10, JSON.stringify(list[0]));
check("cards share a row", new Set(list.map((item) => item.top)).size === 1, JSON.stringify(list.map((item) => item.top)));
await page.shoot(join(shots, "outline-grid.png"), { x: 0, y: 0, width: 1366, height: 768 });

// Drag the last chapter onto the first: it takes the first place.
const drag = (fromIndex, toIndex) =>
  page.run(`(async () => {
    const items = [...document.querySelectorAll(".outline .item")];
    const from = items[${fromIndex}], to = items[${toIndex}];
    const data = new DataTransfer();
    from.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data }));
    const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data });
    to.dispatchEvent(over);
    // The line is drawn once the page has caught up with the drag.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const line = to.classList.contains("drop-before") ? "before" : to.classList.contains("drop-after") ? "after" : "none";
    to.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
    return { accepted: over.defaultPrevented, line };
  })()`);
const dragged = await drag(3, 0);
await sleep(500);
check("a card dragged onto the first shows where it lands, and takes its place", dragged.accepted && dragged.line === "before" && JSON.stringify(await titles()) === JSON.stringify(["Zadnji vlak", "Brod", "Megla nad Savo", "Mlinarjeva hči"]), `${JSON.stringify(dragged)} ${JSON.stringify(await titles())}`);
const order = () => page.run(`(() => { const db = [...__PV_HARNESS__.books.entries()].find(([key]) => /reki/i.test(key))?.[1]; return db ? db.exec("SELECT c.title FROM chapters c JOIN projects p ON p.id = c.project_id WHERE p.title = 'Zgodbe ob reki' ORDER BY c.position")[0]?.values.map((row) => row[0]) : null; })()`);
await sleep(800);
check("and the new order is saved", JSON.stringify(await order()) === JSON.stringify(["Zadnji vlak", "Brod", "Megla nad Savo", "Mlinarjeva hči"]), JSON.stringify(await order()));
// Dragging from inside a synopsis selects words instead.
const fromSynopsis = await page.run(`(() => {
  const item = document.querySelectorAll(".outline .item")[1];
  item.querySelector(".synopsis").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const start = new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
  item.dispatchEvent(start);
  return start.defaultPrevented;
})()`);
check("a drag begun in a synopsis doesn't move the card", fromSynopsis);

// The keyboard, on a card's handle.
await page.run(`(() => { document.querySelectorAll(".outline .item")[0].querySelector(".grip").focus(); return true; })()`);
await page.key("ArrowDown", "ArrowDown", 40);
await sleep(500);
check("↓ on a card's handle moves it one place down, keeping the keyboard", JSON.stringify(await titles()) === JSON.stringify(["Brod", "Zadnji vlak", "Megla nad Savo", "Mlinarjeva hči"]) && (await page.run(`document.activeElement?.closest(".item")?.querySelector(".title")?.textContent.trim()`)) === "Zadnji vlak", JSON.stringify(await titles()));
await page.key("ArrowUp", "ArrowUp", 38);
await sleep(500);
check("and ↑ moves it back", (await titles())[0] === "Zadnji vlak", JSON.stringify(await titles()));

// Rename with a double click.
await page.run(`(() => { document.querySelectorAll(".outline .item .title")[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); return true; })()`);
await until(`document.activeElement?.classList.contains("title-field")`);
await page.run(`(() => { const field = document.activeElement; field.value = ""; field.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await page.type("Zadnji vlak domov");
await page.key("Enter", "Enter", 13);
await sleep(600);
check("a double click on a title renames the chapter", (await titles())[0] === "Zadnji vlak domov", JSON.stringify(await titles()));

// A synopsis written here is kept.
await page.run(`(() => { const area = document.querySelectorAll(".outline .item .synopsis")[0]; area.focus(); area.value = "Vlak odpelje brez Marte."; area.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
await sleep(800);
check("a synopsis written in Oris is kept", (await items())[0].synopsis === "Vlak odpelje brez Marte.");

// The list.
await page.mouse(".outline .switch button", "Seznam");
await sleep(400);
list = await items();
check("Seznam shows a row each, one under another", new Set(list.map((item) => item.top)).size === 4 && list[0].title === "Zadnji vlak domov", JSON.stringify(list.map((item) => item.top)));
check("and is remembered", (await page.run(`JSON.parse(localStorage.getItem("pensieve-prefs")).outlineLayout`)) === "list");
await page.shoot(join(shots, "outline-list.png"), { x: 0, y: 0, width: 1366, height: 768 });
const listDrag = await drag(0, 3);
await sleep(500);
check("rows are dragged into place too, the line after when moving down", listDrag.line === "after" && (await titles())[3] === "Zadnji vlak domov", `${JSON.stringify(listDrag)} ${JSON.stringify(await titles())}`);

// A new chapter, named where it appears.
await page.mouse(".outline .add", "");
check("Novo poglavje adds a chapter and asks for its name there", await until(`document.activeElement?.classList.contains("title-field")`));
await page.type("Epilog");
await page.key("Enter", "Enter", 13);
await sleep(700);
check("named, it is the last chapter", (await titles()).at(-1) === "Epilog" && (await items()).length === 5, JSON.stringify(await titles()));

// Open in Write.
await page.run(`(() => { const item = [...document.querySelectorAll(".outline .item")].find((el) => el.querySelector(".title")?.textContent.trim() === "Megla nad Savo"); item.querySelector(".open").click(); return true; })()`);
check("the arrow opens the chapter in Write", await until(`(document.querySelector(".paper .ProseMirror h2")?.textContent ?? "").includes("Megla nad Savo")`));

// Parts as headings, in a book that has them.
await page.run(`(() => { const row = [...document.querySelectorAll(".library button.tree-row.project")].find((el) => el.querySelector(".name")?.textContent.trim() === "The Lantern series"); row?.click(); return !!row; })()`);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Lantern")`);
await sleep(800);
await page.clickText(".titlebar [role=tab]", "Oris");
await until(`!!document.querySelector(".outline .item")`);
await sleep(300);
const parts = await page.run(`[...document.querySelectorAll(".outline .part")].map((el) => el.textContent.trim())`);
check("a book's parts are headings among its chapters", JSON.stringify(parts) === JSON.stringify(["Part One", "Part Two"]), JSON.stringify(parts));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
