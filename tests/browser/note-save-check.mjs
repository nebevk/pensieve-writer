// A note whose save fails says so where the page's own save does (ARCH-1): she types in a note open beside the
// page while only the notes can't be written, and the window bar says Not saved and why, even once the page
// itself is saved, and Home does too; a rescue copy keeps the note's words. Once notes can be written again,
// the note is saved by itself, without another key, and the window bar and Home say nothing more.
// Usage: node note-save-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

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
const UNREACHABLE = "Pensieve can't reach this project's file.";
const BAR = `(document.querySelector(".titlebar .save")?.innerText ?? "")`;
const HOME = `(document.querySelector(".home-header .error")?.innerText ?? "")`;
const RESCUED = `[...window.__PV_HARNESS__.keptCopies].filter(([key]) => key.startsWith("rescue/")).map(([, copy]) => copy.contents)`;
const toEnd = (selector) =>
  page.run(`(() => { const editor = document.querySelector(${JSON.stringify(selector)}); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
// Ana, a character on the first chapter, as if written before.
const [[welcome]] = await query("SELECT id FROM chapters ORDER BY position");
const projectId = (await query("SELECT project_id FROM shelf"))[0][0];
await page.run(`(() => {
  const now = new Date().toISOString();
  ${DB}.run("INSERT INTO notes (id, project_id, title, content_json, plain_text, category, tags, todo_state, fields_json, aliases, created_at, updated_at) VALUES ('ana', ?, 'Ana', ?, 'Hči mlinarja.', 'characters', '', NULL, '[]', '', ?, ?)",
    [${JSON.stringify(projectId)}, JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hči mlinarja." }] }] }), now, now]);
  ${DB}.run("INSERT INTO note_chapters (note_id, chapter_id) VALUES ('ana', ?)", [${JSON.stringify(welcome)}]);
  return true;
})()`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
await page.click('.ribbon button[title="Notes panel"]');
await until(`!!document.querySelector("aside.panel .row")`);
await page.run(`([...document.querySelectorAll("aside.panel .row")].find((row) => row.textContent.includes("Ana"))?.click(), true)`);
check("Ana opens beside the page, and the window bar says Saved", (await until(`!!document.querySelector("aside.pane .ProseMirror")`)) && (await until(`${BAR}.trim() === "Saved"`)), await page.run(BAR));

// Only the notes can't be written now; she types on in Ana.
await page.run(`(window.__PV_HARNESS__.failQuery = "INSERT INTO notes", true)`);
await toEnd("aside.pane .ProseMirror");
await page.type(" Rada ima reko.");
check("a note that can't be saved says so in the window bar, and why", await until(`${BAR}.includes("Not saved") && ${BAR}.includes(${JSON.stringify(UNREACHABLE)})`, 40), await page.run(BAR));

// The page saves meanwhile, and the window bar still says the note isn't.
await toEnd(".paper .ProseMirror");
await page.type(" Pod mlinom je tekla reka.");
await until(`JSON.stringify(${DB}.exec("SELECT plain_text FROM chapters")[0]?.values ?? []).includes("Pod mlinom je tekla reka.")`, 60);
await sleep(500);
check("the page saved, the window bar still says Not saved for the note", (await page.run(BAR)).includes("Not saved"), await page.run(BAR));
check("a rescue copy keeps Ana's new words", await until(`${RESCUED}.some((words) => words.includes("Rada ima reko."))`, 80));
check("Ana's words aren't in the file yet", JSON.stringify(await query("SELECT plain_text FROM notes WHERE id = 'ana'")).includes("Rada ima reko.") === false);

// Home says it too.
await page.click(".titlebar .mark");
check("Home says it too", await until(`${HOME}.includes(${JSON.stringify(UNREACHABLE)})`), await page.run(HOME));

// Notes can be written again: Ana is saved without another key, and nothing is said any more.
await page.run(`(window.__PV_HARNESS__.failQuery = "", true)`);
check("once notes can be written, Ana is saved by itself", await until(`JSON.stringify(${DB}.exec("SELECT plain_text FROM notes WHERE id = 'ana'")[0]?.values ?? []).includes("Rada ima reko.")`, 60));
check("and Home says nothing more", await until(`${HOME} === ""`), await page.run(HOME));
check("the rescue copy goes, as the project has it all", await until(`${RESCUED}.length === 0`, 60), JSON.stringify(await page.run(`${RESCUED}.length`)));
await page.clickText(".home button", "Continue writing");
check("the window bar says Saved again", await until(`${BAR}.trim() === "Saved"`), await page.run(BAR));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
