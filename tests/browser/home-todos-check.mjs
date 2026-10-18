// Home's to-dos and the library's tree beside them are one list (ARCH-13): a to-do ticked done on Home leaves Home's
// list, the tree's "open" count goes down with it, and the file has it done. In English, in Home's list view.
// Usage: node home-todos-check.mjs [port]
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
const homeTodos = () => page.run(`JSON.stringify([...document.querySelectorAll(".home .item")].map((el) => el.textContent.trim()).filter((text) => /Preveri|Napiši/.test(text)))`);
const treeOpen = () => page.run(`document.querySelector(".home .library button.tree-row.todos .meta")?.textContent.trim() ?? ""`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", homeLayout: "list" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
// Two to-dos, as if written before; Home shows them when it opens again.
const projectId = (await query("SELECT project_id FROM shelf"))[0][0];
await page.run(`(() => {
  for (const [id, title] of [["t1", "Preveri letnico mlina"], ["t2", "Napiši konec"]]) {
    ${DB}.run("INSERT INTO tasks (id, project_id, title, todo_state, updated_at, chapter_id, note_id) VALUES (?, ?, ?, 'todo', ?, '', '')", [id, ${JSON.stringify(projectId)}, title, new Date().toISOString()]);
  }
  return true;
})()`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
await page.click(".titlebar .home-link, .titlebar .mark");
await until(`!!document.querySelector(".home .tree")`);
await sleep(600);
await page.run(UNFOLD);
await sleep(300);
check("Home lists both to-dos, and the tree says two are open", (await until(`/Napiši/.test(document.querySelector(".home")?.innerText ?? "")`)) && (await treeOpen()) === "2 open", `${await homeTodos()} · ${await treeOpen()}`);

// Ticked twice on Home: doing, then done.
for (let turn = 0; turn < 2; turn += 1) {
  await page.run(`([...document.querySelectorAll(".home .item")].find((el) => el.textContent.includes("Preveri letnico mlina"))?.querySelector("button.box")?.click(), true)`);
  await sleep(500);
}
check("done, it leaves Home's list", (await homeTodos()) === '["Napiši konec"]', await homeTodos());
check("and the tree beside it says one is open, at once", (await treeOpen()) === "1 open", await treeOpen());
check("and the file has it done", JSON.stringify(await query("SELECT todo_state FROM tasks WHERE id = 't1'")) === '[["done"]]', JSON.stringify(await query("SELECT todo_state FROM tasks WHERE id = 't1'")));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
