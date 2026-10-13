// Checks her files in the library: listed in library folders and in the open project's "Files", picked with
// a click and opened in their own program with a double click or Enter, programs refused, shown in
// Explorer, and a Word file brought in as a new writing. Also the library's "+" menu, said in words.
// Usage: node files-check.mjs [port]
import { readFileSync } from "node:fs";
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

const KINDS = ["folder", "project", "wfolder", "writing", "part", "chapter", "notes", "group", "note", "todos", "deleted", "elsewhere", "files", "pfolder", "file"];
const rows = () =>
  page.run(`[...document.querySelectorAll(".library button.tree-row")].map((el) => {
    const kind = ${JSON.stringify(KINDS)}.find((name) => el.classList.contains(name)) ?? "page";
    return (el.classList.contains("current") ? "*" : "") + kind + ":" + (el.querySelector(".name")?.textContent.trim() ?? "");
  })`);
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row${kind ? `.${kind}` : ""}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const depthOf = (kind, name) => page.run(`(() => { const el = ${rowSel(kind, name)}; return el ? Number(el.style.getPropertyValue("--depth")) : -1; })()`);
const on = (kind, name, type) =>
  page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; el.dispatchEvent(new MouseEvent(${JSON.stringify(type)}, { bubbles: true, cancelable: true, detail: ${type === "dblclick" ? 2 : 1} })); return true; })()`);
const menuOn = (kind, name) =>
  page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
const menuItems = () => page.run(`[...document.querySelectorAll(".tree-menu button .label")].map((el) => el.textContent.trim())`);
const choose = async (label) => {
  await until(`!!document.querySelector(".tree-menu")`);
  return page.run(`(() => { const el = [...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`);
};
const typeName = async (text) => {
  await until(`!!document.activeElement?.closest(".tree-input")`);
  await page.type(text);
  await page.key("Enter", "Enter", 13);
};
const title = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);
const opened = () => page.run(`[...window.__PV_HARNESS__.opened]`);
const pageNotice = () => page.run(`document.body.innerText`);

const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const FIRST = `${LIBRARY}\\My first project`;
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const DOCX = readFileSync(new URL("./fixtures/example-novel-word.docx", import.meta.url)).toString("base64");
const seeded = {
  [`${LIBRARY}\\Gradivo\\zemljevid.png`]: PNG,
  [`${LIBRARY}\\Gradivo\\Stari rokopis.docx`]: DOCX,
  [`${LIBRARY}\\Gradivo\\setup.exe`]: "eA==",
  [`${LIBRARY}\\Gradivo\\~$ari rokopis.docx`]: "eA==",
  [`${FIRST}\\naslovnica.jpg`]: PNG,
  [`${FIRST}\\Slike\\reka.png`]: PNG,
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(
  `window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library" })), localStorage.setItem("pv-files", ${JSON.stringify(JSON.stringify(seeded))}), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(700);

// The library's "+" says in words what it makes.
await page.click(".sidebar-head .add");
check("the library's + says in words what it makes", JSON.stringify(await menuItems()) === JSON.stringify(["New writing", "New project", "New folder", "Open another project…"]), JSON.stringify(await menuItems()));
await choose("New folder");
await typeName("Osnutki");
await until(`!!(${rowSel("folder", "Osnutki")})`);
check("New folder makes a folder at the library's top", (await depthOf("folder", "Osnutki")) === 0, JSON.stringify(await rows()));

// A folder holding only her files starts folded; unfolded, it lists them by name (Word's lock file isn't one of hers).
check("a folder holding only files starts folded", (await rows()).includes("folder:Gradivo") && !(await rows()).includes("file:zemljevid.png"), JSON.stringify(await rows()));
await on("folder", "Gradivo", "click");
await until(`!!(${rowSel("file", "zemljevid.png")})`);
const all = await rows();
const inGradivo = all.slice(all.indexOf("folder:Gradivo") + 1).filter((row) => row.startsWith("file:")).slice(0, 4);
check("a library folder lists her files", JSON.stringify(inGradivo) === JSON.stringify(["file:setup.exe", "file:Stari rokopis.docx", "file:zemljevid.png"]), JSON.stringify(all));
check("each a level in, with a picture's icon or a page's", (await depthOf("file", "zemljevid.png")) === (await depthOf("folder", "Gradivo")) + 1);

// The open project's own files, in its Files group.
check("the open project has a Files group, folded", all.includes("files:Files") && !all.includes("file:naslovnica.jpg"), JSON.stringify(all));
await on("files", "Files", "click");
await until(`!!(${rowSel("file", "naslovnica.jpg")})`);
check("unfolded, it shows the project's folders and files", (await rows()).includes("pfolder:Slike") && (await rows()).includes("file:naslovnica.jpg"), JSON.stringify(await rows()));
await on("pfolder", "Slike", "click");
await until(`!!(${rowSel("file", "reka.png")})`);
check("and a folder of the project unfolds to its files", (await depthOf("file", "reka.png")) === (await depthOf("pfolder", "Slike")) + 1);

// One click picks a file; a double click or Enter opens it in its own program.
await on("file", "zemljevid.png", "click");
await sleep(300);
check("one click picks a file and opens nothing", (await opened()).length === 0 && (await page.run(`(${rowSel("file", "zemljevid.png")}).classList.contains("picked")`)));
await on("file", "zemljevid.png", "dblclick");
await sleep(300);
check("a double click opens it in its own program", JSON.stringify(await opened()) === JSON.stringify([`${LIBRARY}\\Gradivo\\zemljevid.png`]), JSON.stringify(await opened()));
await page.run(`(() => { const el = ${rowSel("file", "naslovnica.jpg")}; el.focus(); el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); return true; })()`);
await sleep(300);
check("so does Enter", (await opened()).includes(`${FIRST}\\naslovnica.jpg`), JSON.stringify(await opened()));
await on("file", "setup.exe", "dblclick");
await until(`document.body.innerText.includes("Pensieve doesn't start programs")`);
check("a program is never started from the library", !(await opened()).some((path) => path.endsWith("setup.exe")) && (await pageNotice()).includes("Pensieve doesn't start programs"));

// Its menu: open, show in Explorer; a Word file also comes in as a writing.
await menuOn("file", "zemljevid.png");
check("a file's menu opens it or shows it in Explorer", JSON.stringify(await menuItems()) === JSON.stringify(["Open", "Show in Explorer"]), JSON.stringify(await menuItems()));
await choose("Show in Explorer");
await sleep(200);
check("Show in Explorer shows it there", JSON.stringify(await page.run(`window.__PV_HARNESS__.revealed`)) === JSON.stringify([`${LIBRARY}\\Gradivo\\zemljevid.png`]));
await menuOn("file", "Stari rokopis.docx");
check("a Word file's menu can bring it in as a writing", (await menuItems()).includes("Import as a new writing"), JSON.stringify(await menuItems()));
await choose("Import as a new writing");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "The Lantern House"`, 120);
await sleep(600);
const writings = await page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}\\pensieve.db`)}); const r = d.exec("SELECT p.title, COUNT(c.id) FROM projects p JOIN chapters c ON c.project_id = p.id GROUP BY p.id ORDER BY p.position"); return r[0] ? r[0].values : []; })()`);
check(
  "it comes in as a new writing of the open project, chapters and all, and opens",
  (await title()) === "The Lantern House" && writings.some(([name, count]) => name === "The Lantern House" && count === 5) && (await rows()).includes("*writing:The Lantern House"),
  `${await title()} ${JSON.stringify(writings)}`,
);
check("and the page says so", (await pageNotice()).includes("The Lantern House is a writing of this project now."));
check("the Word file itself stays as it was", (await page.run(`window.__PV_HARNESS__.files.has(${JSON.stringify(`${LIBRARY}\\Gradivo\\Stari rokopis.docx`.toLowerCase())})`)));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
