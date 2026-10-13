// Checks the notes and to-dos panel (owner, 12 October): notes open in the panel beside the page, never in
// a window; the list has the chapter's notes first, then all the others, and a search; a note shown there
// has back, previous and next, Open in Notes and close; a linked name, the library and the panel's + open
// notes there; to-dos are the chapter's or the whole project's in one list, which the library's To-dos
// opens; the toolbar has no New note or Add to-do; a note open in the panel survives the library renaming
// it, closes when it is deleted or when Write is left, and keeps what was typed after a reload.
// Usage: node --experimental-websocket notes-panel-check.mjs [port]
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
const list = () =>
  page.run(`[...document.querySelectorAll("aside.panel .eyebrow, aside.panel .row .name")].map((el) => (el.classList.contains("eyebrow") ? "# " : "") + el.textContent.trim())`);
const pane = () =>
  page.run(`(() => { const pane = document.querySelector("aside.pane"); if (!pane) return null; return { title: pane.querySelector("input.title")?.value, count: pane.querySelector(".count")?.textContent.trim() ?? "", previous: pane.querySelector('button[aria-label="Previous note"]')?.disabled ?? null, next: pane.querySelector('button[aria-label="Next note"]')?.disabled ?? null, body: pane.querySelector(".ProseMirror")?.innerText.trim() }; })()`);
const clickRow = (name) => page.run(`(() => { const row = [...document.querySelectorAll("aside.panel .row")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)}); row?.click(); return !!row; })()`);
const toEnd = (selector) =>
  page.run(`(() => { const body = document.querySelector(${JSON.stringify(selector)}); body.focus(); const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); return true; })()`);
const noWindow = `!document.querySelector(".scrim")`;
const treeRow = (kind, name) => `[...document.querySelectorAll(".library button.tree-row.${kind}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const unfoldNotes = async () => {
  await page.clickText(".sidebar [role=tab]", "Library");
  await sleep(300);
  if ((await page.run(`document.querySelector('.tree-row[data-key="notes"]')?.getAttribute("aria-expanded")`)) !== "true") await page.click('.tree-row[data-key="notes"]');
  await sleep(200);
  await page.run(`[...document.querySelectorAll(".library button.tree-row.group")].filter((el) => el.getAttribute("aria-expanded") === "false").forEach((el) => el.click()), true`);
  await sleep(300);
};
const menuOn = (name) =>
  page.run(`(() => { const el = ${treeRow("note", name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
const choose = async (label) => {
  await until(`!!document.querySelector(".tree-menu")`);
  return page.run(`(() => { const el = [...document.querySelectorAll(".tree-menu button")].reverse().find((b) => b.querySelector(".label")?.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`);
};
const openLantern = async () => {
  await page.clickText(".home button", "Continue writing");
  await until(`!!document.querySelector(".library")`);
  await sleep(500);
  // Continue writing may have opened it already; a click on the open project's row would fold it.
  if ((await page.run(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Lantern")`)) === false) {
    await page.run(`[...document.querySelectorAll(".library button.tree-row.project")].find((el) => el.textContent.includes("The Lantern series"))?.click(), true`);
  }
  await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Lantern")`);
  await sleep(1200);
};

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
await openLantern();

// The toolbar: Notes, To-dos, Goals and Link a note; no New note or Add to-do.
const tools = await page.run(`({ newNote: !!document.querySelector('.ribbon button[title="New note"]'), addTodo: !!document.querySelector('.ribbon button[title="Add to-do"]'), notes: !!document.querySelector('.ribbon button[title="Notes panel"]'), todos: !!document.querySelector('.ribbon button[title="To-dos panel"]'), link: !!document.querySelector('.ribbon button[title="Link a note"]') })`);
check("the toolbar has Notes, To-dos and Link a note, and no New note or Add to-do", !tools.newNote && !tools.addTodo && tools.notes && tools.todos && tools.link, JSON.stringify(tools));

// The list: the chapter's notes first, then all the others, by name.
await page.click('.ribbon button[title="Notes panel"]');
await until(`!!document.querySelector("aside.panel .search input")`);
await sleep(300);
const rows = await list();
const here = rows.slice(rows.indexOf("# This chapter") + 1, rows.indexOf("# Other notes"));
const others = rows.slice(rows.indexOf("# Other notes") + 1);
check("the chapter's notes first, then the other notes, by name", rows[0] === "# This chapter" && here.length > 0 && others.length > 0 && JSON.stringify(others) === JSON.stringify([...others].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))), rows.join(" | "));
await page.shoot(`${shots}notes-panel-list.png`, { x: 1000, y: 90, width: 366, height: 520 });

// A note in the panel: no window; back, previous and next.
await clickRow(here[0]);
await until(`!!document.querySelector("aside.pane input.title")`);
await sleep(400);
let shown = await pane();
const total = here.length + others.length;
check("a note opens in the panel, with the page beside it and no window", (await page.run(noWindow)) && shown.title === here[0] && (await page.run(`!!document.querySelector(".paper .ProseMirror")`)), JSON.stringify(shown));
check("it says where it is in the list; previous is off at the start", shown.count === `1 / ${total}` && shown.previous === true && shown.next === false, JSON.stringify(shown));
await page.click('aside.pane button[aria-label="Next note"]');
await until(`document.querySelector("aside.pane .count")?.textContent.trim() === "2 / ${total}"`);
shown = await pane();
check("next shows the list's next note", shown.title === (here[1] ?? others[0]) && shown.previous === false, JSON.stringify(shown));
await page.shoot(`${shots}notes-panel-note.png`, { x: 1000, y: 90, width: 366, height: 520 });
await page.click('aside.pane button[aria-label="Previous note"]');
await until(`document.querySelector("aside.pane input.title")?.value === ${JSON.stringify(here[0])}`);
await toEnd("aside.pane .ProseMirror");
await page.type(" Pisano v plošči.");
await sleep(300);
await page.click("aside.pane .back");
check("back goes to the list", await until(`!document.querySelector("aside.pane") && !!document.querySelector("aside.panel .search input")`));
await clickRow(here[0]);
await until(`!!document.querySelector("aside.pane input.title")`);
check("and the note keeps what was typed in it", (await pane()).body.endsWith("Pisano v plošči."), (await pane()).body);
await page.click("aside.pane .back");
await until(`!!document.querySelector("aside.panel .search input")`);

// Search through every note; Enter opens the first found.
await page.run(`(() => { const input = document.querySelector("aside.panel .search input"); input.focus(); return true; })()`);
await page.type("river");
await sleep(300);
const found = await list();
check("the search looks through every note, by name and text", found.length > 0 && !found.some((row) => row.startsWith("# ")), found.join(" | "));
await page.key("Enter", "Enter", 13);
await until(`!!document.querySelector("aside.pane input.title")`);
check("Enter opens the first one found", (await pane()).title === found[0], (await pane()).title);
await page.click("aside.pane .back");
await until(`!!document.querySelector("aside.panel .search input")`);
check("back, the search is still there", (await page.run(`document.querySelector("aside.panel .search input").value`)) === "river");
await page.run(`(() => { const input = document.querySelector("aside.panel .search input"); input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await sleep(200);

// A linked name on the page opens its note in the panel.
const linked = await page.run(`document.querySelector(".paper [data-note-id]")?.textContent ?? ""`);
await page.mouse(".paper [data-note-id]", "");
await until(`!!document.querySelector("aside.pane input.title")`);
check("a linked name on the page opens its note in the panel", !!linked && !!(await pane())?.title && (await page.run(noWindow)), `${linked} → ${(await pane())?.title}`);
await page.click("aside.pane .back");
await until(`!!document.querySelector("aside.panel .search input")`);

// The panel's +: a new note, named first, tied to the chapter.
await page.click('aside.panel button[title="New note"]');
await until(`!!document.querySelector("aside.pane input.title")`);
await sleep(300);
const named = await page.run(`(() => { const input = document.querySelector("aside.pane input.title"); return { focused: document.activeElement === input, value: input.value, selected: input.selectionEnd - input.selectionStart }; })()`);
check("+ makes a note, its name ready to be typed over", named.focused && named.value === "New note" && named.selected === "New note".length, JSON.stringify(named));
await page.type("Mlin ob reki");
await sleep(200);
await page.click("aside.pane .back");
await until(`!!document.querySelector("aside.panel .search input")`);
const after = await list();
check("it is among the chapter's notes", after.slice(0, after.indexOf("# Other notes")).includes("Mlin ob reki"), after.join(" | "));

// Open in Notes; back in Write, the panel lists its notes again.
await clickRow("Mlin ob reki");
await until(`!!document.querySelector("aside.pane .open")`);
await page.click("aside.pane .open");
await until(`!!document.querySelector("section.notes .card")`);
await sleep(600);
check("Open in Notes goes to Notes, on that note", (await page.run(`document.querySelector("section.notes .row.active .name")?.textContent`)) === "Mlin ob reki");
await page.clickText(".titlebar [role=tab]", "Write");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
check("back in Write, the panel lists the notes", await page.run(`!document.querySelector("aside.pane") && !!document.querySelector("aside.panel .search input")`));

// The library opens a note in the panel; the note's close folds the panel.
await page.click('.ribbon button[title="Notes panel"]');
await until(`!document.querySelector("aside.panel")`);
await unfoldNotes();
await page.run(`${treeRow("note", "The attic")}?.click(), true`);
await until(`document.querySelector("aside.pane input.title")?.value === "The attic"`);
check("a note picked in the library opens in the panel, which opens for it", (await page.run(noWindow)) && (await pane())?.title === "The attic");
await page.click("aside.pane .close");
check("the note's close folds the panel", await until(`!document.querySelector("aside.pane") && !document.querySelector("aside.panel")`));

// To-dos: the chapter's or the whole project's, in one list.
await page.click('.ribbon button[title="To-dos panel"]');
await until(`!!document.querySelector("aside.panel .scope")`);
const scope = await page.run(`[...document.querySelectorAll("aside.panel .scope button")].map((b) => b.textContent.trim() + (b.getAttribute("aria-selected") === "true" ? " *" : ""))`);
check("the to-dos panel shows the chapter's to-dos, with a switch to the whole project's", JSON.stringify(scope) === JSON.stringify(["This chapter *", "Whole project"]), scope.join(", "));
await page.run(`document.querySelector("aside.panel .add input").focus(), true`);
await page.type("Preveri datume");
await page.key("Enter", "Enter", 13);
await sleep(300);
const chapterItems = await page.run(`[...document.querySelectorAll("aside.panel .item")].map((item) => item.querySelector(".text").textContent.trim())`);
check("a to-do added there belongs to the chapter", chapterItems.includes("Preveri datume"), chapterItems.join(" | "));
await page.clickText("aside.panel .scope button", "Whole project");
await sleep(300);
const all = await page.run(`[...document.querySelectorAll("aside.panel .item")].map((item) => item.querySelector(".text").textContent.trim() + " · " + (item.querySelector(".meta")?.textContent.trim() ?? ""))`);
check("the whole project's list has every to-do, each saying where it belongs", all.length > chapterItems.length && all.some((line) => line.startsWith("Preveri datume · 1 · ")), all.slice(0, 4).join(" | "));
await page.run(`document.querySelector("aside.panel .add input").focus(), true`);
await page.type("Za ves projekt");
await page.key("Enter", "Enter", 13);
await sleep(300);
check("one added there is the whole project's", await page.run(`[...document.querySelectorAll("aside.panel .item")].some((item) => item.querySelector(".text").textContent.trim() === "Za ves projekt" && item.querySelector(".meta")?.textContent.trim() === "Whole project")`));
await page.shoot(`${shots}todos-panel.png`, { x: 1000, y: 90, width: 366, height: 520 });
await page.click("aside.panel .board");
check("its link goes to the board", await until(`!!document.querySelector("section.board")`));
await page.clickText(".titlebar [role=tab]", "Write");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(500);
await page.click('.ribbon button[title="To-dos panel"]');
await until(`!document.querySelector("aside.panel")`);
await page.clickText(".sidebar [role=tab]", "Library");
await sleep(300);
await page.click('.tree-row[data-key="todos"]');
await until(`!!document.querySelector("aside.panel .scope")`);
check("the library's To-dos opens the panel on the whole project's, no window", (await page.run(noWindow)) && (await page.run(`document.querySelector('aside.panel .scope button[aria-selected="true"]')?.textContent.trim()`)) === "Whole project");

// A note open in the panel and the library: renamed, deleted; leaving Write.
await unfoldNotes();
await page.run(`${treeRow("note", "Mlin ob reki")}?.click(), true`);
await until(`document.querySelector("aside.pane input.title")?.value === "Mlin ob reki"`);
await menuOn("Mlin ob reki");
await choose("Rename");
await until(`!!document.activeElement?.closest(".tree-input")`);
await page.run(`(() => { const input = document.activeElement; input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await page.type("Mlin");
await page.key("Enter", "Enter", 13);
check("renamed in the library, the note in the panel shows its new name", await until(`document.querySelector("aside.pane input.title")?.value === "Mlin"`));
await toEnd("aside.pane .ProseMirror");
await page.type("Kolo se še vrti.");
await sleep(300);
await menuOn("Mlin");
await choose("Delete");
await sleep(200);
await choose("Delete");
check("deleted in the library, it leaves the panel", await until(`!document.querySelector("aside.pane")`));
await unfoldNotes();
await page.run(`${treeRow("note", "The attic")}?.click(), true`);
await until(`document.querySelector("aside.pane input.title")?.value === "The attic"`);
await toEnd("aside.pane .ProseMirror");
await page.type(" Nihče ne gre gor.");
await sleep(300);
await page.clickText(".titlebar [role=tab]", "Notes");
await until(`!!document.querySelector("section.notes .card")`);
await page.clickText(".titlebar [role=tab]", "Write");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(500);
check("leaving Write, the note leaves the panel", await page.run(`!document.querySelector("aside.pane")`));

// After a reload: what was typed in the panel is kept, and the deleted note stays deleted.
await sleep(1200);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await openLantern();
await unfoldNotes();
const names = await page.run(`[...document.querySelectorAll(".library button.tree-row.note")].map((el) => el.querySelector(".name")?.textContent.trim())`);
check("after a reload the deleted note is still gone", names.includes("The attic") && !names.includes("Mlin") && !names.includes("Mlin ob reki"), names.join(" | "));
await page.run(`${treeRow("note", "The attic")}?.click(), true`);
await until(`document.querySelector("aside.pane input.title")?.value === "The attic"`);
await sleep(300);
const kept = (await pane())?.body ?? "";
check("and the note has what was typed in the panel", kept.endsWith("Nihče ne gre gor."), kept);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
