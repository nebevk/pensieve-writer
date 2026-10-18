// Moving a project into the library copies it safely (ARCH-6): SQLite writes the copy itself, inside the save queue,
// so the words she typed a moment before go along; a copy that won't open leaves her on the old file, saving there,
// and goes to the Recycle Bin. Usage: node move-library-check.mjs [port]
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
const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const textOf = (file) => page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${file}`)}); return d ? JSON.stringify(d.exec("SELECT plain_text FROM chapters")[0]?.values ?? []) : null; })()`);
const projectPath = () => page.run(`JSON.parse(localStorage.getItem("pensieve-prefs")).projectPath`);
const typeAtEnd = async (text) => {
  await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.key("Enter", "Enter", 13);
  await page.type(text);
};
/** Opens a project file from anywhere, as the sidebar's Open another project does. */
const openOutside = async (file, name) => {
  await page.run(`(window.__PV_HARNESS__.dialogAnswers = [${JSON.stringify(file)}])`);
  await page.click(".sidebar-head .add");
  await page.run(`([...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === "Open another project…")?.click(), true)`);
  await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === ${JSON.stringify(name)}`);
  await sleep(1000);
};
/** Settings → Backup & export → Move into the library. */
const moveIntoLibrary = async () => {
  await page.click(".gear");
  await until(`!!document.querySelector(".window")`);
  await page.clickText(".window nav button", "Backup & export");
  await until(`[...document.querySelectorAll(".window button")].some((b) => b.textContent.trim() === "Move into the library")`, 20);
  await page.clickText(".window button", "Move into the library");
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(1000);

// A project kept elsewhere, with words typed a moment before the move.
const OUTSIDE = "C:\\Users\\Eva\\Desktop\\Stari projekt\\pensieve.db";
await openOutside(OUTSIDE, "Stari projekt");
await typeAtEnd("Besede tik pred selitvijo: čšž.");
await moveIntoLibrary();
const MOVED = `${LIBRARY}\\Stari projekt\\pensieve.db`;
check("the project is now in the library, open there", await until(`JSON.parse(localStorage.getItem("pensieve-prefs")).projectPath === ${JSON.stringify(MOVED)}`, 60), await projectPath());
check("its copy has the words typed a moment before", String(await textOf(MOVED)).includes("Besede tik pred selitvijo: čšž."), await textOf(MOVED));
check("SQLite wrote the copy itself, beside where it went", await page.run(`window.__PV_HARNESS__.copies.includes(${JSON.stringify(`${LIBRARY}\\Stari projekt\\pensieve.db.writing`)})`));
check("the old file stays where it was", (await textOf(OUTSIDE)) !== null);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await typeAtEnd("Po selitvi.");
check("and she writes on in the library", await until(`String(${JSON.stringify("")} + (window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${MOVED}`)}).exec("SELECT plain_text FROM chapters")[0]?.values ?? "")).includes("Po selitvi.")`, 60));

// A copy that won't open: she stays on the old file, saving there, and the copy goes to the Recycle Bin.
const SECOND = "C:\\Users\\Eva\\Desktop\\Drugi zunaj\\pensieve.db";
await openOutside(SECOND, "Drugi zunaj");
await page.run(`(window.__PV_HARNESS__.failOpen = ${JSON.stringify(`${LIBRARY}\\Drugi zunaj`)})`);
await moveIntoLibrary();
check("a copy that won't open says so", await until(`(document.querySelector(".window")?.innerText ?? "").includes("can't reach this project's file")`, 60), await page.run(`document.querySelector(".window .hint[role=status]")?.innerText ?? ""`));
check("and the project stays where it was", (await projectPath()) === SECOND, await projectPath());
check("the copy goes to the Recycle Bin", await page.run(`(window.__PV_HARNESS__.trashed ?? []).includes(${JSON.stringify(`${LIBRARY}\\Drugi zunaj`)})`), JSON.stringify(await page.run(`window.__PV_HARNESS__.trashed ?? []`)));
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await typeAtEnd("Še vedno zunaj.");
check("she writes on, saved in the old file", await until(`JSON.stringify(window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${SECOND}`)}).exec("SELECT plain_text FROM chapters")[0]?.values ?? []).includes("Še vedno zunaj.")`, 60));
// Her notes too (ARCH-12): the project opened again is read again, so storage saves its notes as its own.
await page.click('.ribbon button[title="Notes panel"]');
await until(`!!document.querySelector('aside.panel button[title="New note"]')`);
await page.click('aside.panel button[title="New note"]');
await until(`!!document.querySelector("aside.pane input.title")`);
await sleep(300);
await page.type("Zapisek po selitvi");
check(
  "and a note she makes is saved there too",
  await until(`JSON.stringify(window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${SECOND}`)}).exec("SELECT title FROM notes")[0]?.values ?? []).includes("Zapisek po selitvi")`, 60),
  await page.run(`JSON.stringify(window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${SECOND}`)}).exec("SELECT title FROM notes")[0]?.values ?? [])`),
);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
