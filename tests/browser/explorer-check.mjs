// Checks the library as a file explorer: a folder made from a right-click below the rows, the open project
// dragged into it and out again (its file let go and opened again where it went, typing still saved), the
// project and its folder renamed, an empty folder deleted and a full one kept, a folder that can't go inside
// itself, writings dragged into a writing folder, out of it and before another writing, a note dragged into
// another group, and all of it where it went after a restart. Usage: node explorer-check.mjs [port]
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

const KINDS = ["folder", "project", "wfolder", "writing", "part", "chapter", "notes", "group", "note", "todos", "deleted", "elsewhere"];
const rows = () =>
  page.run(`[...document.querySelectorAll(".library button.tree-row")].map((el) => {
    const kind = ${JSON.stringify(KINDS)}.find((name) => el.classList.contains(name)) ?? "page";
    return (el.classList.contains("current") ? "*" : "") + kind + ":" + (el.querySelector(".name")?.textContent.trim() ?? "");
  })`);
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row${kind ? `.${kind}` : ""}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const ROOT = `document.querySelector(".library")`;
const depthOf = (kind, name) => page.run(`(() => { const el = ${rowSel(kind, name)}; return el ? Number(el.style.getPropertyValue("--depth")) : -1; })()`);
const menuOn = (kind, name) =>
  page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
const menuItems = () => page.run(`[...document.querySelectorAll(".tree-menu button")].map((b) => (b.disabled ? "-" : "") + (b.querySelector(".label")?.textContent.trim() ?? ""))`);
const choose = async (label) => {
  await until(`!!document.querySelector(".tree-menu")`);
  return page.run(`(() => { const el = [...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`);
};
const typeName = async (text) => {
  await until(`!!document.activeElement?.closest(".tree-input")`);
  await page.type(text);
  await page.key("Enter", "Enter", 13);
};
const key = (kind, name, keyName) =>
  page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; el.focus(); el.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(keyName)}, bubbles: true, cancelable: true })); return true; })()`);
const title = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);
const books = () => page.run(`[...window.__PV_HARNESS__.books.keys()]`);
const hasBook = (file) => `window.__PV_HARNESS__.books.has(${JSON.stringify(`sqlite:${file}`)})`;
const query = (file, sql) =>
  page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${file}`)}); if (!d) return null; const r = d.exec(${JSON.stringify(sql)}); return r[0] ? r[0].values : []; })()`);
const savedPath = () => page.run(`JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}").projectPath ?? ""`);
const typeAtEnd = async (text) => {
  await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.key("Enter", "Enter", 13);
  await page.type(text);
};
const savedIn = (file, text) => until(`JSON.stringify((window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${file}`)})?.exec("SELECT plain_text FROM chapters")[0]?.values) ?? []).includes(${JSON.stringify(text)})`, 80);
/** Drags one row onto another (or onto the space below the rows) with the browser's own drag events. */
const drag = (fromSel, toSel) =>
  page.run(`(() => {
    const from = ${fromSel};
    const to = ${toSel};
    if (!from || !to) return "missing";
    const data = new DataTransfer();
    from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data }));
    const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data });
    to.dispatchEvent(over);
    if (!over.defaultPrevented) {
      from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
      return "refused";
    }
    to.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
    return "dropped";
  })()`);
const rootMenu = () =>
  page.run(`(() => { const el = ${ROOT}; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 40, clientY: r.bottom - 4 })); return true; })()`);

const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const FIRST = `${LIBRARY}\\My first project\\pensieve.db`;

await page.open(`http://127.0.0.1:${port}/`, 1500);
// Six folders deep already, as the library is read: nothing may be dropped below the sixth.
const DEEP = `${LIBRARY}\\L1\\L2\\L3\\L4\\L5\\L6`;
await page.run(
  `window.__PV_HARNESS__.forget(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en', sidebarView: 'library' })), localStorage.setItem('pv-folders', JSON.stringify([${JSON.stringify(DEEP)}])), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
check("a first start makes the first project", await page.run(hasBook(FIRST)), JSON.stringify(await books()));

// A folder at the library's top, from a right-click below the rows.
await rootMenu();
check("a right-click below the rows offers a new project and a new folder", JSON.stringify(await menuItems()) === JSON.stringify(["New project", "New folder"]), JSON.stringify(await menuItems()));
await choose("New folder");
await typeName("Drafts");
await until(`!!(${rowSel("folder", "Drafts")})`);
check("the folder is made at the library's top", (await depthOf("folder", "Drafts")) === 0, JSON.stringify(await rows()));

// The open project dragged into the folder: its file is let go, moved, and opened again there.
const IN_DRAFTS = `${LIBRARY}\\Drafts\\My first project\\pensieve.db`;
const dropped = await drag(rowSel("project", "My first project"), rowSel("folder", "Drafts"));
await until(hasBook(IN_DRAFTS));
await sleep(600);
check(
  "the open project dragged into a folder moves there on disk, and opens from there next time",
  dropped === "dropped" && (await page.run(hasBook(IN_DRAFTS))) && !(await page.run(hasBook(FIRST))) && (await savedPath()) === IN_DRAFTS,
  `${dropped} ${await savedPath()} ${JSON.stringify(await books())}`,
);
check("the tree shows it inside the folder", (await depthOf("project", "My first project")) === (await depthOf("folder", "Drafts")) + 1, JSON.stringify(await rows()));
await typeAtEnd("Written after the move.");
check("typing after the move is saved in the moved file", await savedIn(IN_DRAFTS, "Written after the move."));

// The project renamed with F2: its folder on disk, and its name in the file. The page stays open as it
// was, the same editor with the cursor where it was.
const RENAMED = `${LIBRARY}\\Drafts\\Prvi roman\\pensieve.db`;
const caret = await page.run(`(() => { const el = document.querySelector(".paper .ProseMirror"); window.__pvEditor = el; el.editor.commands.setTextSelection(3); return el.editor.state.selection.from; })()`);
await key("project", "My first project", "F2");
await typeName("Prvi roman");
await until(hasBook(RENAMED));
await sleep(500);
check("renaming the project renames its folder", (await page.run(hasBook(RENAMED))) && (await rows()).includes("*project:Prvi roman"), JSON.stringify(await rows()));
const kept = await page.run(`(() => { const el = document.querySelector(".paper .ProseMirror"); return el === window.__pvEditor ? el.editor.state.selection.from : -1; })()`);
check("the page stays open through it, the cursor where it was", caret === 3 && kept === 3, `${caret} -> ${kept}`);
// A row let go over the page types nothing into it.
const before = await page.run(`document.querySelector(".paper .ProseMirror").innerText`);
await drag(rowSel("project", "Prvi roman"), `document.querySelector(".paper .ProseMirror p")`);
await sleep(300);
check("a row let go over the page leaves its text alone", (await page.run(`document.querySelector(".paper .ProseMirror").innerText`)) === before);
// A file dragged in from Explorer is refused, so it can't open in Pensieve's place.
const fileRefused = await page.run(`(() => {
  const data = new DataTransfer();
  data.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
  const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data });
  document.querySelector(".sidebar-head").dispatchEvent(over);
  return over.defaultPrevented && data.dropEffect === "none";
})()`);
check("a file dragged in from Explorer is refused outside the page", fileRefused);
// Nothing lands deeper than the library is read. (Folders without projects start folded: open them first.)
for (const name of ["L1", "L2", "L3", "L4", "L5"]) {
  await page.run(`(() => { const el = ${rowSel("folder", name)}; if (el?.getAttribute("aria-expanded") === "false") el.click(); return true; })()`);
  await sleep(150);
}
check("a project can't be dropped below the sixth folder", (await drag(rowSel("project", "Prvi roman"), rowSel("folder", "L6"))) === "refused");
check("and the project's name in its file", JSON.stringify(await query(RENAMED, "SELECT title FROM shelf")) === '[["Prvi roman"]]', JSON.stringify(await query(RENAMED, "SELECT title FROM shelf")));

// The folder holding the open project renamed: the project opens again where it went.
const IN_OSNUTKI = `${LIBRARY}\\Osnutki\\Prvi roman\\pensieve.db`;
await key("folder", "Drafts", "F2");
await typeName("Osnutki");
await until(hasBook(IN_OSNUTKI));
await sleep(500);
check("renaming the folder the open project is in takes the project with it", (await savedPath()) === IN_OSNUTKI && (await rows()).includes("folder:Osnutki"), `${await savedPath()} ${JSON.stringify(await rows())}`);
await typeAtEnd("And after the folder's new name.");
check("typing still goes into the project's file", await savedIn(IN_OSNUTKI, "And after the folder's new name."));

// A folder with something in it can't be deleted; once empty, it can.
await menuOn("folder", "Osnutki");
check("a folder with something in it can't be deleted", (await menuItems()).includes("-Delete the folder"), JSON.stringify(await menuItems()));
await page.key("Escape", "Escape", 27);
await sleep(200);
// Out to the library's top again, dropped on the space below the rows.
const BACK = `${LIBRARY}\\Prvi roman\\pensieve.db`;
const out = await drag(rowSel("project", "Prvi roman"), ROOT);
await until(hasBook(BACK));
await sleep(500);
check("a project dropped below the rows goes to the library's top", out === "dropped" && (await savedPath()) === BACK && (await depthOf("project", "Prvi roman")) === 0, `${out} ${await savedPath()}`);
await key("folder", "Osnutki", "Delete");
await until(`!(${rowSel("folder", "Osnutki")})`);
check("an empty folder is deleted with the Delete key", !(await page.run(`!!(${rowSel("folder", "Osnutki")})`)), JSON.stringify(await rows()));

// A folder can't go inside itself.
await rootMenu();
await choose("New folder");
await typeName("Zbirka");
await until(`!!(${rowSel("folder", "Zbirka")})`);
await menuOn("folder", "Zbirka");
await choose("New folder");
await typeName("Stare");
await until(`!!(${rowSel("folder", "Stare")})`);
check("a folder dragged onto a folder inside it stays where it is", (await drag(rowSel("folder", "Zbirka"), rowSel("folder", "Stare"))) === "refused");
check("but goes into another folder", (await drag(rowSel("folder", "Stare"), ROOT)) === "dropped" && (await until(`(${rowSel("folder", "Stare")})?.style.getPropertyValue("--depth") === "0"`)));

// Writings: into a writing folder, out of it onto the project, and before another writing.
await page.click(".sidebar-head .add");
await choose("New writing");
await typeName("Druga");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Druga"`);
await page.run(`(() => {
  window.__PV_INPUT__ = { seen: 0, blur: null, removed: 0 };
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) if (n.nodeType === 1 && (n.matches?.(".tree-input") || n.querySelector?.(".tree-input"))) window.__PV_INPUT__.seen += 1;
      for (const n of r.removedNodes) if (n.nodeType === 1 && (n.matches?.(".tree-input") || n.querySelector?.(".tree-input"))) window.__PV_INPUT__.removed += 1;
    }
  }).observe(document.body, { subtree: true, childList: true });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.(".tree-input")) window.__PV_INPUT__.blur = { to: (event.relatedTarget?.className ?? String(event.relatedTarget)), stack: new Error().stack.split(String.fromCharCode(10)).slice(1, 9).join(" | ") };
  }, true);
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (...args) { if (document.activeElement?.closest?.(".tree-input") && !this.closest(".tree-input")) window.__PV_INPUT__.focusCall = { on: this.className, stack: new Error().stack.split(String.fromCharCode(10)).slice(1, 9).join(" | ") }; return focus.apply(this, args); };
  return true;
})()`);
const menuOpened = await menuOn("project", "Prvi roman");
const menuShown = await menuItems();
const chosen = await choose("New folder");
const inputBefore = await page.run(`({ input: !!document.querySelector(".library .tree-input input"), focused: !!document.activeElement?.closest(".tree-input") })`);
await typeName("Objavljeno");
const madeFolder = await until(`!!(${rowSel("wfolder", "Objavljeno")})`);
if (!madeFolder) {
  console.log("NO FOLDER:", JSON.stringify({ menuOpened, menuShown, chosen, inputBefore, title: await title() }));
  console.log("  input:", JSON.stringify(await page.run(`window.__PV_INPUT__`)));
  console.log("  after typing:", JSON.stringify(await page.run(`({ input: document.querySelector(".library .tree-input input")?.value ?? null, problem: document.querySelector(".library .problem")?.textContent ?? null, active: document.activeElement?.tagName + "." + document.activeElement?.className })`)));
}
await sleep(400);
const folderOf = async (name) => JSON.stringify(await query(BACK, `SELECT folder FROM projects WHERE title = '${name}'`));
const treeNow = () => page.run(`[...document.querySelectorAll(".library button.tree-row")].map((el) => el.className.split(" ")[1] + ":" + (el.querySelector(".name")?.textContent.trim() ?? "")).join(" | ")`);
const treeBefore = await treeNow();
const dragResult = await drag(rowSel("writing", "Druga"), rowSel("wfolder", "Objavljeno"));
if (dragResult === "missing") console.log("MISSING; before:", treeBefore, " now:", await treeNow());
await until(`(${rowSel("writing", "Druga")})?.style.getPropertyValue("--depth") === "2"`);
// The tree shows it at once; the project's file is written a moment later, through the save queue.
for (let wait = 0; wait < 20 && (await folderOf("Druga")) !== '[["Objavljeno"]]'; wait += 1) await sleep(150);
check("a writing dragged onto a writing folder goes into it", (await folderOf("Druga")) === '[["Objavljeno"]]', `${dragResult}: ${await folderOf("Druga")}`);
await drag(rowSel("writing", "Druga"), rowSel("project", "Prvi roman"));
await until(`(${rowSel("writing", "Druga")})?.style.getPropertyValue("--depth") === "1"`);
check("dragged onto its project, it comes out of the folder", (await folderOf("Druga")) === '[[""]]', await folderOf("Druga"));
await drag(rowSel("writing", "Druga"), rowSel("writing", "Untitled"));
await sleep(600);
const order = await query(BACK, "SELECT title FROM projects WHERE deleted_at = '' ORDER BY position");
const treeOrder = (await rows()).filter((row) => row.includes("writing:"));
check("dragged onto another writing, it goes just before it", JSON.stringify(order) === '[["Druga"],["Untitled"]]' && treeOrder[0].endsWith("Druga"), `${JSON.stringify(order)} ${JSON.stringify(treeOrder)}`);

// A note dragged into another group.
await page.run(`(() => { const el = ${rowSel("notes", "Notes")}; if (el?.getAttribute("aria-expanded") === "false") el.click(); return true; })()`);
await menuOn("group", "Characters");
await choose("New note");
await typeName("Ana");
await until(`(document.querySelector(".titlebar [role=tab][aria-selected=true]")?.textContent ?? "").includes("Notes")`);
await sleep(500);
await page.clickText(".titlebar [role=tab]", "Write");
await until(`!!(${rowSel("note", "Ana")})`);
await drag(rowSel("note", "Ana"), rowSel("group", "Places"));
await until(`JSON.stringify(window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${BACK}`)}).exec("SELECT category FROM notes WHERE title = 'Ana'")[0]?.values) === '[["places"]]'`);
check("a note dragged onto another group moves there", JSON.stringify(await query(BACK, "SELECT category FROM notes WHERE title = 'Ana'")) === '[["places"]]');

// After a restart, everything is where it went.
await page.open(`http://127.0.0.1:${port}/`, 800);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
const after = await rows();
check(
  "after a restart the project opens from where it went, as it was left",
  (await title()) === "Druga" && after.includes("*project:Prvi roman") && after.includes("folder:Zbirka") && after.includes("folder:Stare") && !after.some((row) => row.includes("Osnutki")),
  `${await title()} ${JSON.stringify(after)}`,
);
const home = await page.run(`(() => { document.querySelector(".mark")?.click(); return true; })()`);
await until(`!!document.querySelector(".home .project .name")`);
const homeNames = await page.run(`[...document.querySelectorAll(".home .project .name")].map((el) => el.textContent.trim())`);
check("Home calls the project by its new name", home && homeNames.includes("Prvi roman") && !homeNames.includes("My first project"), JSON.stringify(homeNames));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
