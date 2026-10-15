// Delete for good keeps a copy (ARCH-5): the writing as it was goes into Pensieve's own folder before it leaves
// the project, and nothing goes if the copy can't be written. Settings → Backup & export counts the kept copies,
// brings one back as a backup is restored, and removes them. Usage: node kept-copy-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { UNFOLD, clickFound } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
await page.harness({ keep: true });
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
const FIRST = "C:\\Users\\Eva\\Documents\\Pensieve\\My first project\\pensieve.db";
const DB = `window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}`)})`;
const query = (sql) => page.run(`(() => { const r = ${DB}.exec(${JSON.stringify(sql)}); return r[0] ? r[0].values : []; })()`);
const KEPT = `[...window.__PV_HARNESS__.keptCopies].filter(([key]) => key.startsWith("deleted/"))`;
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row.${kind}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const menuOn = async (kind, name) => {
  if (!(await page.run(`!!(${rowSel(kind, name)})`))) {
    await page.run(UNFOLD);
    await sleep(200);
  }
  return page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
};
const choose = async (label) => {
  await until(`!!document.querySelector(".tree-menu")`);
  return page.run(`(() => { const el = [...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
};
const question = () => page.run(`document.querySelector(".tree-menu .question")?.textContent.trim() ?? ""`);
/** A writing in the project's Deleted folder, as if put there before: one chapter, with č, š and ž. */
const seedDeleted = (id, title, text) =>
  page.run(`(() => {
    const now = new Date().toISOString();
    ${DB}.run("INSERT INTO projects (id, title, language, kind, word_goal, position, folder, deleted_at, created_at, updated_at) VALUES (?, ?, 'sl', 'novel', 0, 9, '', ?, ?, ?)", [${JSON.stringify(id)}, ${JSON.stringify(title)}, now, now, now]);
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Prvo poglavje" }] }, { type: "paragraph", content: [{ type: "text", text: ${JSON.stringify(text)} }] }] };
    ${DB}.run("INSERT INTO chapters (id, project_id, title, position, content_json, plain_text, updated_at) VALUES (?, ?, 'Prvo poglavje', 0, ?, ?, ?)", [${JSON.stringify(`${id}-c`)}, ${JSON.stringify(id)}, JSON.stringify(doc), ${JSON.stringify(text)}, now]);
    return true;
  })()`);
const write = async () => {
  await until(`!!document.querySelector(".home .continue, .paper .ProseMirror")`, 60);
  if (await page.run(`!!document.querySelector(".home .continue")`)) await page.clickText(".home button", "Continue writing");
  await until(`!!document.querySelector(".paper .ProseMirror")`, 60);
  await sleep(1200);
};
/** Deletes a writing in Deleted for good, from the tree, as she would; gives the question she was asked. */
const deleteForGood = async (title) => {
  if (!(await page.run(`!!(${rowSel("writing", title)})`))) await clickFound(page, rowSel("deleted", "Deleted"));
  await until(`!!(${rowSel("writing", title)})`);
  await menuOn("writing", title);
  await choose("Delete for good");
  await until(`!!document.querySelector(".tree-menu .question")`);
  const asked = await question();
  await choose("Delete for good");
  return asked;
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`, 60);
await seedDeleted("stara", "Stara zgodba", "Čaša, šola, žaba.");
await page.open(`http://127.0.0.1:${port}/`, 2500);
await write();

// Deleted for good: a copy first, then it leaves the project.
const asked = await deleteForGood("Stara zgodba");
check("deleting for good says a copy is kept", asked.includes("Pensieve keeps one copy of it in its own folder"), asked);
check("it leaves the project", await until(`${DB}.exec("SELECT COUNT(*) FROM projects WHERE id = 'stara'")[0].values[0][0] === 0`, 40));
const kept = await page.run(`${KEPT}.map(([key, copy]) => [key, copy.contents])`);
check("a copy of it is kept, named by its title and when", kept.length === 1 && /^deleted\/Stara zgodba \d{4}-\d\d-\d\d \d\d-\d\d-\d\d\.json$/.test(kept[0][0]), JSON.stringify(kept.map(([key]) => key)));
check("with its words, č, š and ž", kept[0]?.[1].includes("Čaša, šola, žaba."));

// Settings counts it, and brings it back as a backup is restored.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button", "Backup & export");
check("Settings counts the kept copies", await until(`(document.querySelector(".window")?.innerText ?? "").includes("1 kept copy")`, 20));
const copyPath = await page.run(`window.__PV_HARNESS__.keptCopies && "C:\\\\Users\\\\Eva\\\\AppData\\\\Roaming\\\\com.pensieve.app\\\\Kept copies\\\\Deleted writings\\\\" + ${KEPT}[0][0].slice("deleted/".length)`);
await page.run(`(window.__PV_HARNESS__.dialogAnswers = [${JSON.stringify(copyPath)}])`);
await page.clickText(".window button", "Bring one back…");
check("bringing one back asks as a restore does, by the writing's name", await until(`(document.querySelector(".window .offer")?.innerText ?? "").includes("Restore “Stara zgodba”")`, 40), await page.run(`document.querySelector(".window .offer")?.innerText ?? ""`));
await page.clickText(".window .offer button", "Restore");
check("the writing is back in the project, out of Deleted", await until(`(${DB}.exec("SELECT deleted_at FROM projects WHERE id = 'stara'")[0]?.values ?? []).length === 1`, 60), JSON.stringify(await query("SELECT title, deleted_at FROM projects")));
check("with its words", JSON.stringify(await query("SELECT plain_text FROM chapters WHERE project_id = 'stara'")).includes("Čaša, šola, žaba."));

// Remove them: asked first, then gone.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button", "Backup & export");
await until(`(document.querySelector(".window")?.innerText ?? "").includes("1 kept copy")`, 20);
await page.clickText(".window button", "Remove them…");
check("removing them asks first", await until(`(document.querySelector(".window")?.innerText ?? "").includes("Remove 1 kept copy? It can't be brought back after that.")`, 20));
await page.clickText(".window .offer button", "Remove");
check("then they are gone", await until(`(document.querySelector(".window")?.innerText ?? "").includes("None yet") && ${KEPT}.length === 0`, 40));
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);

// A copy that can't be written (a full disk): nothing is deleted, and she is told why.
await seedDeleted("druga", "Druga zgodba", "Še ena zgodba.");
await page.open(`http://127.0.0.1:${port}/`, 2500);
await write();
await page.run(`(window.__PV_HARNESS__.failKept = true)`);
await deleteForGood("Druga zgodba");
check("with no copy, nothing is deleted, and she is told why", await until(`(document.querySelector(".statusbar .error")?.innerText ?? "").includes("Nothing was deleted")`, 40), await page.run(`document.querySelector(".statusbar .error")?.innerText ?? ""`));
check("the writing is still there", (await query("SELECT COUNT(*) FROM projects WHERE id = 'druga'"))[0][0] === 1);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
