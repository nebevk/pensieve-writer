// Checks the calmer chapter panel: one list at a time, notes as plain rows that open in the panel (12 October).
// Usage: node panel-one-check.mjs [port]
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
const panel = () =>
  page.run(`(() => {
    const aside = document.querySelector("aside.panel");
    if (!aside) return null;
    return {
      heading: aside.querySelector(".heading h3")?.textContent.trim(),
      rows: [...aside.querySelectorAll(".row")].map((row) => ({ name: row.querySelector(".name")?.textContent.trim(), times: row.querySelector(".times")?.textContent.trim() ?? "", open: row.getAttribute("aria-expanded") === "true" })),
      todos: [...aside.querySelectorAll(".items")].map((items) => items.innerText).join(" "),
      details: aside.querySelector(".details")?.innerText ?? "",
      extras: { kinds: aside.querySelectorAll(".kind").length, cards: aside.querySelectorAll(".open-note, .mini").length },
    };
  })()`);
// The panel's three; Find has the same look beside them since 13 October.
const toggles = () => page.run(`[...document.querySelectorAll(".panel-toggle")].filter((button) => button.textContent.trim() !== "Find").map((button) => button.getAttribute("aria-pressed"))`);

// Settings from before, with both halves of the panel on, open the notes.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight", panelTodos: true, panelNotes: true, toolsExpanded: false })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
const migrated = await panel();
check("old settings with both halves on open the notes", migrated?.heading === "Notes", JSON.stringify(migrated?.heading));

// The example novel: notes as plain rows, nothing else.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".project", "The Lantern series");
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("letter")`);
await page.run(`(() => { const name = [...document.querySelectorAll(".name")].find((el) => el.textContent.trim() === "The Letter"); (name.closest("button, [role=button], li") ?? name).click(); return true; })()`);
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("twelve years")`);
await sleep(600);
const notes = await panel();
check("the notes list has plain rows", notes?.heading === "Notes" && notes.rows.length >= 3 && notes.extras.kinds === 0 && notes.extras.cards === 0, notes?.rows.map((row) => `${row.name} ${row.times}`).join(" | "));
check("no note is open at first", await page.run(`!document.querySelector("aside.pane")`));
const vera = notes?.rows.find((row) => row.name === "Vera, her mother");
check("a row shows how often the chapter mentions the note", vera?.times === "5×", vera?.times);
check("Notes is the pressed toolbar button", JSON.stringify(await toggles()) === JSON.stringify(["false", "true", "false"]));

// A row opens its note in the panel; back goes to the list.
await page.clickText("aside.panel .row", "Vera, her mother");
await until(`document.querySelector("aside.pane input.title")?.value === "Vera, her mother"`);
check("clicking a note shows it in the panel, with Open in Notes", (await page.run(`document.querySelector("aside.pane .open")?.textContent.trim()`)) === "Open in Notes");
await page.shoot(`${shots}panel-notes.png`, { x: 1150, y: 40, width: 350, height: 520 });
await page.click("aside.pane .back");
check("back goes to the list", await until(`!document.querySelector("aside.pane") && !!document.querySelector("aside.panel .row")`));

// The To-dos button switches the panel to the to-dos; pressing it again closes the panel.
await page.run(`document.querySelectorAll(".panel-toggle")[0].click(), true`);
await until(`(document.querySelector("aside.panel .heading h3")?.textContent ?? "") === "To-dos"`);
const todos = await panel();
check("To-dos replaces the notes", todos?.heading === "To-dos" && todos.rows.length === 0 && todos.todos.includes("Check the ending of chapter 1"), todos?.todos.replace(/\s+/g, " ").slice(0, 60));
check("To-dos is the pressed toolbar button", JSON.stringify(await toggles()) === JSON.stringify(["true", "false", "false"]));
await page.shoot(`${shots}panel-todos.png`, { x: 1150, y: 40, width: 350, height: 300 });
await page.run(`document.querySelectorAll(".panel-toggle")[0].click(), true`);
check("pressing it again closes the panel", await until(`!document.querySelector("aside.panel")`));

// A linked name in the text opens its note in the panel.
await page.mouse(".paper .ProseMirror [data-note-id]", "Her grandmother");
await until(`!!document.querySelector("aside.pane input.title")`);
const linked = await page.run(`document.querySelector("aside.pane input.title")?.value`);
check("a linked name opens its note in the panel", linked === "Grandmother Marija", linked);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
