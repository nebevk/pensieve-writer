// A note's "Appears in", in the Notes tab (ARCH-8): it follows the note's names, its other names among them, but
// typing in the note's own text doesn't count as a mention, nor search the book again. In English.
// Usage: node notes-appears-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

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
const appears = () => page.run(`JSON.stringify([...document.querySelectorAll("section.notes aside.context li")].map((li) => li.lastElementChild.textContent.trim()))`);
/** Puts the cursor at the end of a field or editor. */
const toEnd = (selector) =>
  page.run(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); if (el.setSelectionRange) { el.setSelectionRange(el.value.length, el.value.length); return true; } const range = document.createRange(); range.selectNodeContents(el); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
// A character, as if written before.
const projectId = (await query("SELECT project_id FROM shelf"))[0][0];
await page.run(`(() => {
  const now = new Date().toISOString();
  ${DB}.run("INSERT INTO notes (id, project_id, title, content_json, plain_text, category, tags, todo_state, fields_json, aliases, created_at, updated_at) VALUES ('ana', ?, 'Ana', ?, 'Hči mlinarja.', 'characters', '', NULL, '[]', '', ?, ?)",
    [${JSON.stringify(projectId)}, JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hči mlinarja." }] }] }), now, now]);
  return true;
})()`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
await toEnd(".paper .ProseMirror");
await page.key("Enter", "Enter", 13);
await page.type("Ana je šla do mlina. Ana je tiho čakala pri mlinu.");
await until(`JSON.stringify(${DB}.exec("SELECT plain_text FROM chapters")[0]?.values ?? []).includes("pri mlinu.")`, 60);

await page.clickText(".titlebar [role=tab]", "Notes");
await until(`!!document.querySelector("section.notes .row")`);
await page.clickText("section.notes .row", "Ana");
await until(`!!document.querySelector("section.notes .card .ProseMirror")`);
await sleep(400);
check("Appears in counts her name in the chapter", (await appears()) === '["2×"]', await appears());

// Her own text names her too: that is no mention in the book.
await toEnd("section.notes .card .ProseMirror");
await page.type(" Ana, Ana in Ana ob mlinu.");
await sleep(600);
check("typing in the note leaves it as it was", (await appears()) === '["2×"]', await appears());

// Another name she goes by counts at once.
await toEnd("section.notes .card input.aliases");
await page.type("mlinu");
await sleep(600);
check("an other name counts as soon as it is written", (await appears()) === '["3×"]', await appears());

// A new name of her own, which the book doesn't use: the other name still counts.
await page.run(`(() => { const input = document.querySelector("section.notes .card input.title"); input.focus(); input.select(); return true; })()`);
await page.type("Brina");
await sleep(600);
check("renamed, she appears where the names she now goes by do", (await appears()) === '["1×"]', await appears());

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
