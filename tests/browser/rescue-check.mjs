// When saving fails (ARCH-1): her project's file out of reach (its folder renamed in Explorer, say), so every save
// fails. A rescue copy of the page's words goes to Pensieve's own folder at once; closing asks once, and closes;
// the next start offers the copy back, and bringing it back puts her words into the project, what was there kept
// in Earlier versions first. A copy put off is never written over or taken away by a later one, and when the
// writing has changed since, it comes back beside it, as a writing of its own. With no rescue copy either (a full
// disk), the window stays until her words are out another way, and a second ✕ meanwhile doesn't close it.
// Usage: node rescue-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

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
const SAVED = `JSON.stringify(${DB}.exec("SELECT plain_text FROM chapters")[0]?.values ?? [])`;
const COPIES = `[...window.__PV_HARNESS__.keptCopies].filter(([key]) => key.startsWith("rescue/")).map(([key, copy]) => [key.slice(7), copy.contents])`;
const DIALOG = `(document.querySelector(".window[role=dialog]")?.innerText ?? "")`;
const STATUS = `(document.querySelector(".statusbar .error")?.innerText ?? "")`;
const copies = () => page.run(COPIES);
/** Words of each writing, by its title. */
const byWriting = async () =>
  Object.fromEntries((await query("SELECT p.title, group_concat(c.plain_text, ' ') FROM chapters c JOIN projects p ON p.id = c.project_id GROUP BY p.id")).map(([title, text]) => [title, text]));
const buttons = () => page.run(`[...document.querySelectorAll(".window footer button")].map((b) => b.textContent.trim())`);
const press = (label) => page.run(`(() => { const el = [...document.querySelectorAll(".window footer button")].find((b) => b.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
const write = async () => {
  await until(`!!document.querySelector(".home .continue, .paper .ProseMirror")`, 60);
  if (await page.run(`!!document.querySelector(".home .continue")`)) await page.clickText(".home button", "Continue writing");
  await until(`!!document.querySelector(".paper .ProseMirror")`, 60);
  await sleep(1200);
};
/** Words typed while the project's file is out of reach: the save fails, and says why. */
const typeUnsaved = async (words) => {
  await page.run(`(window.__PV_HARNESS__.failSaves = true)`);
  await toEnd();
  await page.type(words);
  return until(`${STATUS}.includes("can't reach this project's file")`, 60);
};
const closeWindow = () => page.run(`(window.__PV_HARNESS__.emit("tauri://close-requested"), true)`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await write();

// Saving works: the first words are in the project.
await toEnd();
await page.key("Enter", "Enter", 13);
await page.type("Prva vrstica, shranjena.");
check("her first words are saved", await until(`${SAVED}.includes("Prva vrstica, shranjena.")`, 60));

// The project's file out of reach: the save fails, says why in plain words, and a rescue copy has the words at once.
check("a failed save says why, in plain words", await typeUnsaved(" Besede, ki jih datoteka ne dobi: čšž."), await page.run(STATUS));
check("a rescue copy has the words that couldn't be saved", await until(`${COPIES}.some(([, text]) => text.includes("ne dobi: čšž."))`, 40));
check("and they aren't in the project", !(await page.run(`${SAVED}.includes("ne dobi")`)));

// Closing: asked once, the words safe; Close Pensieve closes the window.
await closeWindow();
check("closing asks once, saying the words are safe in a rescue copy", await until(`${DIALOG}.includes("safe in a rescue copy")`, 40), await page.run(DIALOG));
check("and why the save failed", (await page.run(DIALOG)).includes("What went wrong: Pensieve can't reach this project's file"));
check("with Keep it open and Close Pensieve", JSON.stringify(await buttons()) === JSON.stringify(["Keep it open", "Close Pensieve"]), JSON.stringify(await buttons()));
await press("Close Pensieve");
check("Close Pensieve closes the window", await until(`window.__PV_HARNESS__.destroyed === true`, 40));

// The next start, the file back in reach: the copy is offered, and brought back over the writing.
await page.open(`http://127.0.0.1:${port}/`, 2500);
check("the next start offers the rescue copy back", await until(`${DIALOG}.includes("kept your words in a rescue copy")`, 60), await page.run(DIALOG));
check("over the writing, which hasn't changed since", (await page.run(DIALOG)).includes("kept first, in Earlier versions"));
await press("Bring them back");
check("bringing it back puts her words into the project", await until(`${SAVED}.includes("Besede, ki jih datoteka ne dobi: čšž.")`, 60), await page.run(SAVED));
check("what was there is kept in Earlier versions first", (await query("SELECT COUNT(*) FROM snapshots WHERE kind = 'before-restore'"))[0][0] === 1);
check("the page shows them", await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("ne dobi: čšž.")`, 40));
check("and the copy goes", await until(`${COPIES}.length === 0`, 20));

// Saving fails again, and she closes: a copy of this time's.
await sleep(800);
await typeUnsaved(" Druge izgubljene besede.");
await until(`${COPIES}.some(([, text]) => text.includes("Druge izgubljene besede."))`, 40);
await closeWindow();
await until(`${DIALOG}.includes("safe in a rescue copy")`, 40);
await press("Close Pensieve");
const putOff = (await copies())[0]?.[0] ?? "";

// The next start: put off. Saving fails again, then works: this time's copy comes and goes, the earlier one stays.
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`${DIALOG}.includes("kept your words in a rescue copy")`, 60);
await press("Not now");
await write();
await typeUnsaved(" Tretje besede.");
check("a copy put off isn't written over: this time has a copy of its own", await until(`${COPIES}.length === 2`, 40), JSON.stringify((await copies()).map(([name]) => name)));
check("and the earlier one still has its words", (await copies()).some(([name, text]) => name === putOff && text.includes("Druge izgubljene besede.")));
await page.run(`(window.__PV_HARNESS__.failSaves = false)`);
await toEnd();
await page.type(" Četrte besede, shranjene.");
check("once saving works, this time's copy goes, and the earlier one stays", await until(`JSON.stringify(${COPIES}.map(([name]) => name)) === ${JSON.stringify(JSON.stringify([putOff]))}`, 60), JSON.stringify((await copies()).map(([name]) => name)));

// The next start: the writing has changed since the copy, so it comes back beside it, as a writing of its own.
await page.open(`http://127.0.0.1:${port}/`, 2500);
check("a copy older than the writing's last save is offered beside it", await until(`${DIALOG}.includes("come back beside it")`, 60), await page.run(DIALOG));
await press("Bring them back");
await until(`${DB}.exec("SELECT COUNT(*) FROM projects WHERE title LIKE '%(rescue copy)'")[0].values[0][0] === 1`, 60);
const writings = await byWriting();
const rescued = Object.keys(writings).find((title) => title.endsWith("(rescue copy)")) ?? "";
check("it comes back as a writing of its own, with its words", String(writings[rescued] ?? "").includes("Druge izgubljene besede."), JSON.stringify(writings));
check("and the writing keeps the words saved since", Object.entries(writings).some(([title, text]) => title !== rescued && String(text).includes("Četrte besede, shranjene.")));
check("the copy goes", await until(`${COPIES}.length === 0`, 20));

// A full disk too: no rescue copy, so the window stays until her words are out another way, a Word file here.
await write();
await page.run(`(window.__PV_HARNESS__.failKept = true)`);
await typeUnsaved(" Zadnji stavek reši le Word.");
// A double click on ✕: the second while the first is still saving.
await page.run(`(window.__PV_HARNESS__.emit("tauri://close-requested"), window.__PV_HARNESS__.emit("tauri://close-requested"), true)`);
check("with no rescue copy, closing says so", await until(`${DIALOG}.includes("couldn't keep a rescue copy")`, 40), await page.run(DIALOG));
check("a second ✕ meanwhile doesn't close the window", (await page.run(`window.__PV_HARNESS__.destroyed === true`)) === false);
check("it offers to copy the text or save a Word file, but not to close yet", JSON.stringify(await buttons()) === JSON.stringify(["Copy the text", "Save as a Word file…", "Keep it open"]), JSON.stringify(await buttons()));
await page.run(`(window.__PV_HARNESS__.dialogAnswers = ["C:\\\\Users\\\\Eva\\\\Desktop\\\\Rešeno.docx"])`);
await press("Save as a Word file…");
check("the Word file is written where she chose, from the page", await until(`(window.__PV_HARNESS__.files.get("c:\\\\users\\\\eva\\\\desktop\\\\rešeno.docx")?.base64.length ?? 0) > 1000`, 60));
check("then Close Pensieve is there", await until(`[...document.querySelectorAll(".window footer button")].some((b) => b.textContent.trim() === "Close Pensieve")`, 20), JSON.stringify(await buttons()));
await press("Keep it open");
check("Keep it open goes back to the page", await until(`!document.querySelector(".window[role=dialog]")`, 20));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
