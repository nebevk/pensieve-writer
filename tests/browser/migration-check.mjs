// Checks that a book file from before projects held several writings opens as a project with that one
// writing, with every chapter, note, to-do and earlier version where it was, and a copy of the file
// kept beside it first. The file is the long test book as an older Pensieve saved it (fixtures/long-book.db.gz).
// Usage: node migration-check.mjs [port]
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const OLD = String.raw`C:\Users\Eva\Documents\Pensieve\Old book\pensieve.db`;
const seed = { [`sqlite:${OLD}`]: gunzipSync(readFileSync(new URL("./fixtures/long-book.db.gz", import.meta.url))).toString("base64") };
const page = await connect({ width: 1500, height: 900 });
await page.harness({ seed });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 80) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const query = (sql) =>
  page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${OLD}`)}); if (!d) return null; const r = d.exec(${JSON.stringify(sql)}); return r[0] ? r[0].values : []; })()`);

// The old file, before this Pensieve opens it.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(
  `localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en', sidebarView: 'library', projectPath: ${JSON.stringify(OLD)}, knownProjects: [{ path: ${JSON.stringify(OLD)}, title: 'Long test book', summary: { kind: 'novel', language: 'en', words: 150000, target: 150000, chapters: 15, finished: 5, status: 'final', editedAt: '' } }] })), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 800);
await until(`!!document.querySelector(".home .continue")`);
await sleep(800);

const copies = await page.run(`window.__PV_HARNESS__.copies`);
check("a copy of the old file is kept beside it before anything changes", copies.includes(`${OLD}.before-projects`), JSON.stringify(copies));
check("the copy holds the book as it was", JSON.stringify(await page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${OLD}.before-projects`)}); return d ? d.exec("SELECT COUNT(*) FROM chapters")[0].values : null; })()`)) === "[[15]]");
const version = await query("SELECT version FROM schema_version");
check("the file is at the new version", JSON.stringify(version) === "[[4]]", JSON.stringify(version));
const shelf = await query("SELECT project_id, title FROM shelf");
const writing = await query("SELECT id, title, kind FROM projects");
// The book keeps its title; the project, being in the library, goes by its folder's name, as the tree shows it.
check(
  "its one book is the project's first writing, under the same id; the project goes by its folder's name",
  writing?.length === 1 && shelf?.[0]?.[0] === writing[0][0] && writing[0][1] === "Long test book" && shelf[0][1] === "Old book",
  JSON.stringify([shelf, writing]),
);
check("every chapter, note, to-do and earlier version is where it was", JSON.stringify(await query("SELECT (SELECT COUNT(*) FROM chapters), (SELECT COUNT(*) FROM notes), (SELECT COUNT(*) FROM tasks), (SELECT COUNT(*) FROM snapshots) >= 2")) === "[[15,10,40,1]]", JSON.stringify(await query("SELECT (SELECT COUNT(*) FROM chapters), (SELECT COUNT(*) FROM notes), (SELECT COUNT(*) FROM tasks), (SELECT COUNT(*) FROM snapshots)")));

// It opens, in chapters and parts, with its notes and to-dos.
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
const rows = await page.run(`[...document.querySelectorAll(".library button.tree-row")].map((el) => el.querySelector(".name")?.textContent.trim())`);
check("the library shows it as a project with its writing and parts", rows[0] === "Old book" && rows[1] === "Long test book" && rows.includes("Part One") && rows.includes("Notes") && rows.includes("To-dos"), JSON.stringify(rows.slice(0, 8)));
const notes = await page.run(`document.querySelector(".library button.tree-row.notes .words")?.textContent.trim() ?? ""`);
check("its notes are the project's", notes === "10", notes);

// Writing in it still saves, into its one writing.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Written after the change.");
await sleep(2800);
const saved = await query(`SELECT COUNT(*) FROM chapters WHERE plain_text LIKE '%Written after the change.%' AND project_id = '${writing?.[0]?.[0]}'`);
check("text typed now saves into it", JSON.stringify(saved) === "[[1]]", JSON.stringify(saved));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
