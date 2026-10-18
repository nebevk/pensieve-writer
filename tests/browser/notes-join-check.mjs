// A note's chapters when chapters are joined (ARCH-13): its link to a chapter joined into the page moves to
// that page, and stays there when she then types in the note, open beside the page all along.
// Usage: node notes-join-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { UNFOLD } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1500, height: 900 });
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
const linked = async () => (await query("SELECT chapter_id FROM note_chapters WHERE note_id = 'ana'")).map((row) => row[0]);
const writingRow = `[...document.querySelectorAll(".library button.tree-row.writing")].find((el) => el.querySelector(".name")?.textContent.trim() === "Untitled")`;

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
// A character tied to the second chapter, as if written before.
const [[welcome], [second]] = await query("SELECT id FROM chapters ORDER BY position");
const projectId = (await query("SELECT project_id FROM shelf"))[0][0];
await page.run(`(() => {
  const now = new Date().toISOString();
  ${DB}.run("INSERT INTO notes (id, project_id, title, content_json, plain_text, category, tags, todo_state, fields_json, aliases, created_at, updated_at) VALUES ('ana', ?, 'Ana', ?, 'Hči mlinarja.', 'characters', '', NULL, '[]', '', ?, ?)",
    [${JSON.stringify(projectId)}, JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hči mlinarja." }] }] }), now, now]);
  ${DB}.run("INSERT INTO note_chapters (note_id, chapter_id) VALUES ('ana', ?)", [${JSON.stringify(second)}]);
  return true;
})()`);

await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
// Ana open in the panel beside the page.
await page.click('.ribbon button[title="Notes panel"]');
await until(`!!document.querySelector("aside.panel .row")`);
await page.run(`([...document.querySelectorAll("aside.panel .row")].find((row) => row.textContent.includes("Ana"))?.click(), true)`);
check("Ana opens beside the page", await until(`!!document.querySelector("aside.pane .ProseMirror")`));

// The writing's chapters joined into one page, from its menu in the library.
await page.run(UNFOLD);
await sleep(200);
await page.run(`(() => { const el = ${writingRow}; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 5 })); return true; })()`);
await until(`!!document.querySelector(".tree-menu")`);
await page.run(`([...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === "Split into chapters")?.click(), true)`);
await until(`!!document.querySelector(".tree-menu .question")`);
await page.run(`([...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === "Join")?.click(), true)`);
await until(`document.body.innerText.includes("The chapters are one page now.")`);
await sleep(800);
check("joined, Ana's chapter is the page it went into", JSON.stringify(await linked()) === JSON.stringify([welcome]), JSON.stringify(await linked()));

// She types on in Ana, still open beside the page.
await page.run(`(() => { const editor = document.querySelector("aside.pane .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.type(" Rada ima reko.");
await until(`JSON.stringify(${DB}.exec("SELECT plain_text FROM notes WHERE id = 'ana'")[0]?.values ?? []).includes("Rada ima reko.")`, 60);
await sleep(300);
check("typing in her afterwards keeps her chapter as the joined page", JSON.stringify(await linked()) === JSON.stringify([welcome]), JSON.stringify(await linked()));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
