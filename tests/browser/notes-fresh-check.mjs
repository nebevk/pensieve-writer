// A note changed in the Notes tab keeps her words when Home's tree then renames, duplicates or opens it
// (ARCH-13, reproduced 14 October): the page acted on its own older copy of the notes and saved that over
// her newer words. In Home's list view, in English. Usage: node notes-fresh-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { UNFOLD } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
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
const FIRST = "C:\\Users\\Eva\\Documents\\Pensieve\\My first project\\pensieve.db";
const DB = `window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}`)})`;
const query = (sql) => page.run(`(() => { const r = ${DB}.exec(${JSON.stringify(sql)}); return r[0] ? r[0].values : []; })()`);
const noteText = async (title) => (await query(`SELECT plain_text FROM notes WHERE title = '${title}'`))?.[0]?.[0] ?? "";
const row = (name) => `[...document.querySelectorAll(".home .library button.tree-row.note")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library", homeLayout: "list" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
// Three notes, as if written before: Ana, Bor and Cene.
const projectId = (await query("SELECT project_id FROM shelf"))[0][0];
await page.run(`(() => {
  const now = new Date().toISOString();
  for (const [id, title] of [["ana", "Ana"], ["bor", "Bor"], ["cene", "Cene"]]) {
    ${DB}.run("INSERT INTO notes (id, project_id, title, content_json, plain_text, category, tags, todo_state, fields_json, aliases, created_at, updated_at) VALUES (?, ?, ?, ?, 'Staro besedilo.', 'characters', '', NULL, '[]', '', ?, ?)",
      [id, ${JSON.stringify(projectId)}, title, JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Staro besedilo." }] }] }), now, now]);
  }
  return true;
})()`);

// Write once, so the page holds its own copy of the notes.
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(1000);

/** New words at the end of a note, typed in the Notes tab and saved. */
const writeInNotesTab = async (title, words) => {
  // Home has no tabs: back to Write first, where they are.
  if (await page.run(`!!document.querySelector(".home .continue")`)) {
    await page.clickText(".home button", "Continue writing");
    await until(`!!document.querySelector(".paper .ProseMirror")`);
    await sleep(500);
  }
  await page.clickText(".titlebar [role=tab]", "Notes");
  await until(`!!document.querySelector(".list button.row")`);
  await page.clickText(".list button.row", title);
  await until(`document.querySelector(".list button.row.active")?.textContent.includes(${JSON.stringify(title)})`);
  await sleep(300);
  await page.run(`(() => { const editor = document.querySelector(".card .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.type(words);
  return until(`JSON.stringify(${DB}.exec("SELECT plain_text FROM notes WHERE title = '${title}'")[0]?.values ?? []).includes(${JSON.stringify(words.trim())})`, 60);
};
/** Home, in the list, with the project's notes unfolded. */
const home = async () => {
  await page.click(".titlebar .home-link, .titlebar .mark");
  await until(`!!document.querySelector(".home .tree")`);
  await sleep(500);
  await page.run(`(() => { for (const el of document.querySelectorAll('.home .library button.tree-row.notes[aria-expanded="false"]')) el.click(); return true; })()`);
  await sleep(200);
  await page.run(UNFOLD);
  await sleep(200);
};

// Renamed on Home.
check("new words written in the Notes tab are saved", await writeInNotesTab("Ana", " NOVE BESEDE"));
await home();
await page.run(`(() => { const el = ${row("Ana")}; el.focus(); el.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true, cancelable: true })); return true; })()`);
await until(`!!document.activeElement?.closest(".tree-input")`, 20);
await page.run(`(document.activeElement.select?.(), true)`);
await page.type("Ana Novak");
await page.key("Enter", "Enter", 13);
await until(`JSON.stringify(${DB}.exec("SELECT title FROM notes")[0]?.values ?? []).includes("Ana Novak")`, 40);
await sleep(400);
check("renamed on Home, the note keeps those words", (await noteText("Ana Novak")) === "Staro besedilo. NOVE BESEDE", await noteText("Ana Novak"));

// Duplicated on Home.
check("Bor's new words are saved", await writeInNotesTab("Bor", " DRUGE BESEDE"));
await home();
await page.run(`(() => { const el = ${row("Bor")}; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
await until(`!!document.querySelector(".tree-menu")`);
await page.run(`([...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === "Duplicate")?.click(), true)`);
await until(`(${DB}.exec("SELECT count(*) FROM notes")[0]?.values[0][0] ?? 0) === 4`, 40);
const copies = await query("SELECT title, plain_text FROM notes WHERE title LIKE '%Bor%' ORDER BY title");
check("duplicated on Home, the copy has them too", copies.length === 2 && copies.every(([, text]) => text === "Staro besedilo. DRUGE BESEDE"), JSON.stringify(copies));

// Opened from Home and typed into beside the page.
check("Cene's new words are saved", await writeInNotesTab("Cene", " TRETJE BESEDE"));
await home();
await page.run(`(${row("Cene")}.click(), true)`);
await until(`!!document.querySelector(".paper .ProseMirror") && !!document.querySelector("aside.pane .ProseMirror")`, 60);
await sleep(500);
const shown = await page.run(`document.querySelector("aside.pane .ProseMirror")?.textContent ?? ""`);
check("opened from Home, the panel shows them", shown.includes("TRETJE BESEDE"), shown);
await page.run(`(() => { const editor = document.querySelector("aside.pane .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.type("!");
await until(`JSON.stringify(${DB}.exec("SELECT plain_text FROM notes WHERE title = 'Cene'")[0]?.values ?? []).includes("!")`, 40);
check("and a key typed there keeps them", (await noteText("Cene")) === "Staro besedilo. TRETJE BESEDE!", await noteText("Cene"));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
