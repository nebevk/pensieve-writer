// Settings' own work, as she does it there: the open writing exported as a Word file, as Markdown and as plain text
// where she chooses, copied as clean HTML, each said in Settings; and a word of her own added to the dictionary,
// kept in the project, and taken out again. Usage: node settings-work-check.mjs [port]
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
const OUT = "C:\\Users\\Eva\\Documents\\Izvoz";
const WORDS = "Mlinarjevka je šla čez žitno polje.";
// A file she has, as text, or its first two bytes.
const FILE = (path) => `window.__PV_HARNESS__.files.get(${JSON.stringify(path.toLowerCase())})`;
const fileText = (path) => page.run(`(() => { const file = ${FILE(path)}; return file ? new TextDecoder().decode(Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))) : null; })()`);
const fileStart = (path) => page.run(`(() => { const file = ${FILE(path)}; return file ? atob(file.base64).slice(0, 2) : null; })()`);
const answer = (...paths) => page.run(`(window.__PV_HARNESS__.dialogAnswers = ${JSON.stringify(paths)}, true)`);
const press = (label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(".window button")].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const STATUS = `(document.querySelector(".window p.hint[role=status]")?.textContent.trim() ?? "")`;
const section = async (name) => {
  await page.clickText(".window nav button", name);
  await sleep(300);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
// Words of her own on the page, with č, š and ž.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.type(` ${WORDS}`);
await sleep(300);

await page.click(".gear");
await until(`!!document.querySelector(".window nav")`);
await section("Backup & export");

// Exports, each where she chose: the words just typed are in it, saved first.
await answer(`${OUT}\\Knjiga.docx`);
await press("Export Word…");
check("Export Word… writes a Word file where she chose, and says so", (await until(`${STATUS}.startsWith("Saved")`)) && (await fileStart(`${OUT}\\Knjiga.docx`)) === "PK", await page.run(STATUS));
await answer(`${OUT}\\Knjiga.md`);
await press("Markdown…");
await until(`${STATUS}.includes("Knjiga.md")`);
const markdown = (await fileText(`${OUT}\\Knjiga.md`)) ?? "";
check("Markdown… writes the writing as Markdown, with what she just typed", markdown.startsWith("# ") && markdown.includes(WORDS), markdown.slice(0, 80));
await answer(`${OUT}\\Knjiga.txt`);
await press("Plain text…");
await until(`${STATUS}.includes("Knjiga.txt")`);
check("Plain text… writes it as plain text", ((await fileText(`${OUT}\\Knjiga.txt`)) ?? "").includes(WORDS));
await answer();
await press("Plain text…");
await sleep(600);
check("a save dialog closed without a name writes nothing", (await page.run(`[...window.__PV_HARNESS__.files.values()].filter((file) => file.path.startsWith(${JSON.stringify(OUT)})).length`)) === 3);

// Copy HTML: the clipboard, as the page hands it over.
await page.run(`(Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async (text) => void (window.__PV_COPIED__ = text) }), true)`);
await press("Copy HTML");
check(
  "Copy HTML puts the writing on the clipboard as clean HTML, and says so",
  await until(`(window.__PV_COPIED__ ?? "").includes(${JSON.stringify(WORDS)}) && /<h1>/.test(window.__PV_COPIED__) && ${STATUS} === "Copied clean HTML"`),
  await page.run(STATUS),
);

// The personal dictionary: a word of hers, kept in the project, then taken out.
await section("Language");
await page.run(`(() => {
  const form = document.querySelector(".window form.actions");
  const select = form.querySelector("select");
  select.value = "sl";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  const input = form.querySelector("input");
  input.value = "Mlinarjevka";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  form.requestSubmit();
  return true;
})()`);
const listed = `[...document.querySelectorAll(".window ul.words li")].map((li) => li.firstChild.textContent.trim() + ":" + li.querySelector(".tongue").textContent)`;
check("a word added to the dictionary is listed, as Slovenian", await until(`JSON.stringify(${listed}) === JSON.stringify(["Mlinarjevka:SL"])`), JSON.stringify(await page.run(listed)));
check("and kept in the project", JSON.stringify(await query("SELECT language, word FROM personal_words")) === JSON.stringify([["sl", "Mlinarjevka"]]));
await page.run(`(document.querySelector('.window ul.words li button[aria-label="Remove: Mlinarjevka"]')?.click(), true)`);
check("taken out, it goes from the list and the project", (await until(`${listed}.length === 0`)) && (await query("SELECT word FROM personal_words")).length === 0);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
