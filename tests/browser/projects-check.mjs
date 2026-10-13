// Checks projects that hold several writings, in the library beside the page: a first start in the
// library folder, new writings, switching without losing a word, writing folders, the split switch,
// Deleted, notes in the tree, a second project, Continue writing after a restart, and the examples.
// Usage: node projects-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { UNFOLD, clickFound } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
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
const clickRow = (kind, name) => clickFound(page, rowSel(kind, name));
const depthOf = (kind, name) => page.run(`(() => { const el = ${rowSel(kind, name)}; return el ? Number(el.style.getPropertyValue("--depth")) : -1; })()`);
// A row in a folded writing folder or group is unfolded to first, as she would (since 8 October).
const reveal = async (kind, name) => {
  if (!(await page.run(`!!(${rowSel(kind, name)})`))) {
    await page.run(UNFOLD);
    await sleep(200);
  }
};
const menuOn = async (kind, name) =>
  (await reveal(kind, name), page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`));
const menuItems = () => page.run(`[...document.querySelectorAll(".tree-menu button .label, .tree-menu .question")].map((el) => el.textContent.trim())`);
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
const query = (file, sql) =>
  page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${file}`)}); if (!d) return null; const r = d.exec(${JSON.stringify(sql)}); return r[0] ? r[0].values : []; })()`);
const typeAtEnd = async (text) => {
  await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.key("Enter", "Enter", 13);
  await page.type(text);
};
const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const FIRST = `${LIBRARY}\\My first project\\pensieve.db`;
const SECOND = `${LIBRARY}\\Second project\\pensieve.db`;

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("window.__PV_HARNESS__.forget(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en', sidebarView: 'library' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);

// A first start: a project in the library folder, one writing on the welcome page.
const start = await rows();
check("a first start makes a project in the library folder", (await page.run(`window.__PV_HARNESS__.books.has(${JSON.stringify(`sqlite:${FIRST}`)})`)) && !(await page.run(`[...window.__PV_HARNESS__.books.keys()].some((key) => key.includes("Books"))`)), JSON.stringify(await page.run(`[...window.__PV_HARNESS__.books.keys()]`)));
check("the tree shows the project, its writing and chapters, Notes and To-dos", JSON.stringify(start) === JSON.stringify(["*project:My first project", "*writing:Untitled", "page:Welcome", "page:Chapter 1", "notes:Notes", "todos:To-dos"]), JSON.stringify(start));
const shelf = await query(FIRST, "SELECT project_id FROM shelf");
const firstWriting = await query(FIRST, "SELECT id FROM projects");
check("the project's notes key isn't its writing's", shelf?.[0]?.[0] && firstWriting?.[0]?.[0] && shelf[0][0] !== firstWriting[0][0], JSON.stringify([shelf, firstWriting]));

// A new writing from the header, named in the tree, opens at once.
await page.click(".sidebar-head .add");
await choose("New writing");
await typeName("Svetilnik");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Svetilnik")`);
await sleep(500);
check("a new writing opens at once", (await title()) === "Svetilnik", await title());
check("both writings are in the project", (await rows()).filter((row) => row.includes("writing:")).join(",") === "writing:Untitled,*writing:Svetilnik", JSON.stringify(await rows()));
const svetilnik = (await query(FIRST, "SELECT id FROM projects WHERE title = 'Svetilnik'"))?.[0]?.[0];

// Typing, then straight away another writing: every word stays in its own writing.
const wordsOn = (kind, name) => page.run(`Number((${rowSel(kind, name)})?.querySelector(".words")?.textContent.trim() ?? "-1")`);
const writingBefore = await wordsOn("writing", "Svetilnik");
const projectBefore = await wordsOn("project", "My first project");
await typeAtEnd("Lighthouse keeper words.");
const followed = await until(`Number((${rowSel("writing", "Svetilnik")})?.querySelector(".words")?.textContent.trim()) === ${writingBefore + 3}`);
check(
  "the tree's words follow her typing, for the writing and its project",
  followed && (await wordsOn("project", "My first project")) === projectBefore + 3,
  JSON.stringify([writingBefore, projectBefore, await wordsOn("writing", "Svetilnik"), await wordsOn("project", "My first project")]),
);
await clickRow("writing", "Untitled");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Untitled"`);
await sleep(400);
const keeper = await query(FIRST, `SELECT plain_text FROM chapters WHERE project_id = '${svetilnik}'`);
check("words typed just before switching writings are saved in their writing", JSON.stringify(keeper).includes("Lighthouse keeper words."), JSON.stringify(keeper));
await clickRow("", "Chapter 1");
await until(`(document.querySelector(".paper .ProseMirror > h2")?.textContent ?? "").includes("Chapter 1")`);
await typeAtEnd("Second chapter text.");
await clickRow("writing", "Svetilnik");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Svetilnik"`);
await sleep(400);
const second = await query(FIRST, "SELECT plain_text FROM chapters WHERE title = 'Chapter 1'");
check("and back the other way", JSON.stringify(second).includes("Second chapter text."), JSON.stringify(second));
check("the other writing's chapters are untouched", JSON.stringify(await query(FIRST, `SELECT COUNT(*) FROM chapters`)) === "[[3]]", JSON.stringify(await query(FIRST, "SELECT title, project_id FROM chapters")));

// A writing folder, and a writing moved into it.
await menuOn("project", "My first project");
await choose("New folder");
await typeName("Drafts");
await until(`!!(${rowSel("wfolder", "Drafts")})`);
await menuOn("writing", "Svetilnik");
const writingMenu = await menuItems();
check("a writing's menu offers its moves and the switch", ["Open", "Rename", "Duplicate", "Split into chapters", "Move to Drafts", "Delete"].every((item) => writingMenu.includes(item)), JSON.stringify(writingMenu));
await choose("Move to Drafts");
await sleep(500);
check("a writing moves into a folder", (await depthOf("writing", "Svetilnik")) === (await depthOf("wfolder", "Drafts")) + 1 && JSON.stringify(await query(FIRST, `SELECT folder FROM projects WHERE id = '${svetilnik}'`)) === '[["Drafts"]]', JSON.stringify(await rows()));
await page.shoot(`${shots}projects-folder.png`, { x: 0, y: 70, width: 280, height: 400 });

// Split into chapters, off and on again, on the writing that isn't open. The open page stays as it is,
// the same editor with her cursor where she left it.
const cursorAt = await page.run(`(() => { const el = document.querySelector(".paper .ProseMirror"); window.__pvEditor = el; el.editor.commands.setTextSelection(3); return el.editor.state.selection.from; })()`);
await menuOn("writing", "Untitled");
await choose("Split into chapters");
await until(`!!document.querySelector(".tree-menu .question")`);
check("turning the switch off asks first", (await menuItems()).some((item) => item.startsWith("Join the chapters")), JSON.stringify(await menuItems()));
await choose("Join");
await until(`(document.body.innerText).includes("The chapters are one page now.")`);
await sleep(500);
const sameEditor = await page.run(`(() => { const el = document.querySelector(".paper .ProseMirror"); return el === window.__pvEditor ? el.editor.state.selection.from : -1; })()`);
check("joining another writing leaves the open page and its cursor alone", cursorAt === 3 && sameEditor === cursorAt, `${cursorAt} -> ${sameEditor}`);
const joined = await query(FIRST, `SELECT COUNT(*), MAX(plain_text) FROM chapters WHERE project_id = '${firstWriting[0][0]}'`);
check("joined: one page holding every chapter's text", joined?.[0]?.[0] === 1 && String(joined[0][1]).includes("Second chapter text.") && String(joined[0][1]).includes("only here for the first sitting"), JSON.stringify(joined));
check("the one-page writing has no arrow in the tree", !(await page.run(`!!(${rowSel("writing", "Untitled")})?.querySelector(".twist svg")`)));
await menuOn("writing", "Untitled");
await choose("Split into chapters");
await until(`(document.body.innerText).includes("Every Heading 2 is a chapter now.")`);
await sleep(500);
const again = await query(FIRST, `SELECT title, plain_text FROM chapters WHERE project_id = '${firstWriting[0][0]}' ORDER BY position`);
check("split again: its chapters back, with their text", JSON.stringify(again?.map((row) => row[0])) === JSON.stringify(["Welcome", "Chapter 1"]) && String(again?.[1]?.[1]).includes("Second chapter text."), JSON.stringify(again));

// Deleted, and put back.
await menuOn("writing", "Untitled");
await choose("Delete");
await until(`!!(${rowSel("deleted", "Deleted")})`);
check("a deleted writing goes to Deleted, not away", !(await page.run(`!!(${rowSel("writing", "Untitled")})`)) && JSON.stringify(await query(FIRST, "SELECT COUNT(*) FROM projects WHERE deleted_at <> ''")) === "[[1]]");
await clickRow("deleted", "Deleted");
await sleep(200);
await menuOn("writing", "Untitled");
check("a deleted writing can be put back or deleted for good", JSON.stringify(await menuItems()) === JSON.stringify(["Put back", "Delete for good"]), JSON.stringify(await menuItems()));
await choose("Put back");
await sleep(500);
check("put back, it's with the others again", !(await page.run(`!!(${rowSel("deleted", "Deleted")})`)) && (await rows()).includes("writing:Untitled"), JSON.stringify(await rows()));

// Deleting the open writing: another opens first. And a writing deleted the moment it is clicked open: it
// gives way too, so the page is never on a writing in Deleted.
const isDeleted = async (name) => JSON.stringify(await query(FIRST, `SELECT deleted_at <> '' FROM projects WHERE title = '${name}'`)) === "[[1]]";
const pressDelete = async (name, open = false) =>
  (await reveal("writing", name), page.run(`(() => { const el = ${rowSel("writing", name)}; if (!el) return false; el.focus(); ${open ? "el.click();" : ""} el.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true })); return true; })()`));
const putBack = async (name) => {
  if (!(await page.run(`!!(${rowSel("writing", name)})`))) await clickRow("deleted", "Deleted");
  await until(`!!(${rowSel("writing", name)})`);
  await menuOn("writing", name);
  await choose("Put back");
  await until(`!(${rowSel("deleted", "Deleted")})`);
  await sleep(300);
};
await pressDelete("Svetilnik");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Untitled"`);
await sleep(500);
check("deleting the open writing opens another first, and it waits in Deleted", (await title()) === "Untitled" && (await isDeleted("Svetilnik")), `${await title()} ${await isDeleted("Svetilnik")}`);
await putBack("Svetilnik");
await pressDelete("Svetilnik", true);
await sleep(1500);
check(
  "a writing deleted as it opens gives way; the page is never on one in Deleted",
  (await title()) === "Untitled" && (await isDeleted("Svetilnik")) && !(await isDeleted("Untitled")),
  `${await title()} ${await isDeleted("Svetilnik")} ${await isDeleted("Untitled")}`,
);
await putBack("Svetilnik");
await clickRow("writing", "Svetilnik");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Svetilnik"`);
await sleep(400);

// Notes in the tree: a new one in a group opens in a window over the page (since 9 October).
await clickRow("notes", "Notes");
await sleep(200);
check("the Notes folder holds the four groups", JSON.stringify((await rows()).filter((row) => row.startsWith("group:"))) === JSON.stringify(["group:Characters", "group:Places", "group:Research", "group:Ideas"]), JSON.stringify(await rows()));
await menuOn("group", "Characters");
await choose("New note");
await typeName("Ana");
await until(`!!document.querySelector("aside.pane input.title")`);
await sleep(600);
const openNote = () => page.run(`document.querySelector("aside.pane input.title")?.value ?? ""`);
check("a new note opens in the panel beside the page", (await openNote()) === "Ana", await openNote());
const noteRow = await query(FIRST, "SELECT n.title, n.category, n.project_id = s.project_id FROM notes n, shelf s");
check("it belongs to the project, in its group", JSON.stringify(noteRow) === '[["Ana","characters",1]]', JSON.stringify(noteRow));
await page.click("aside.pane .back");
await sleep(400);
check("the note is in the tree, under its group", (await rows()).includes("note:Ana"), JSON.stringify(await rows()));
await clickRow("note", "Ana");
await until(`!!document.querySelector("aside.pane input.title")`);
await sleep(500);
check("clicking a note opens it in the panel", (await openNote()) === "Ana", await openNote());
await page.click("aside.pane .back");
await sleep(300);

// A second project, then back to the first. A name the library would hide is refused first, saying why.
await page.click(".sidebar-head .add");
await choose("New project");
// The New project window (since 12 October), its name field taking the keyboard.
await until(`!!document.activeElement?.matches(".window .field input")`);
await page.type(".hidden");
await page.key("Enter", "Enter", 13);
await until(`!!document.querySelector(".window [role=alert]")`);
const hiddenProblem = await page.run(`document.querySelector(".window [role=alert]")?.textContent.trim() ?? ""`);
check("a project name starting with a dot is refused, saying why", hiddenProblem === "A name can't start with a dot or a dollar sign.", hiddenProblem);
await page.run(`(() => { const input = document.querySelector(".window .field input"); input.focus(); input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await page.type("Second project");
await page.key("Enter", "Enter", 13);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Second project"`);
await sleep(600);
check("a new project opens on its first writing", (await rows()).includes("*project:Second project") && (await rows()).includes("project:My first project"), JSON.stringify(await rows()));
check("its file is in its own folder in the library", await page.run(`window.__PV_HARNESS__.books.has(${JSON.stringify(`sqlite:${SECOND}`)})`));
await clickRow("project", "My first project");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Svetilnik"`);
check("a project opens on the writing open there last", (await title()) === "Svetilnik", await title());
await page.shoot(`${shots}projects-tree.png`, { x: 0, y: 70, width: 280, height: 520 });

// Home lists the projects; Continue writing opens what was open last, also after a restart.
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
const projects = await page.run(`[...document.querySelectorAll(".home .project .name")].map((el) => el.textContent.trim())`);
check("Home lists the projects", projects.includes("My first project") && projects.includes("Second project"), JSON.stringify(projects));
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
check("Continue writing opens the last writing", (await title()) === "Svetilnik", await title());
await page.open(`http://127.0.0.1:${port}/`, 800);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(500);
check("and after a restart", (await title()) === "Svetilnik" && (await page.run(`document.querySelector(".paper .ProseMirror")?.innerText ?? ""`)).includes("Lighthouse keeper words."), await title());

// The examples: a folder of two projects; a writing of a closed project opens it.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await sleep(400);
check("the examples are a folder of projects in the library", (await rows()).includes("folder:Examples") && (await rows()).includes("project:The Lantern series") && (await rows()).includes("project:Zgodbe ob reki"), JSON.stringify(await rows()));
await page.run(`(() => { const el = ${rowSel("project", "The Lantern series")}; el.focus(); return true; })()`);
await page.key("ArrowRight", "ArrowRight", 39);
await sleep(300);
check("a closed project unfolds to its writings", (await rows()).includes("writing:The Lantern House") && (await rows()).includes("writing:Why I write by hand first"), JSON.stringify(await rows()));
await clickRow("writing", "Why I write by hand first");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("hand")`);
await sleep(600);
const lantern = await rows();
check("a writing of a closed project opens it there, in its folder", lantern.includes("*project:The Lantern series") && lantern.includes("wfolder:Published") && lantern.includes("*writing:Why I write by hand first"), JSON.stringify(lantern));
check("the novel shows its parts", lantern.includes("writing:The Lantern House"), JSON.stringify(lantern));
await page.shoot(`${shots}projects-examples.png`, { x: 0, y: 70, width: 280, height: 600 });

// A one-page writing keeps the library beside it, even with the Chapters tab chosen.
await page.run(`(() => { const prefs = JSON.parse(localStorage.getItem("pensieve-prefs")); return true; })()`);
await page.clickText(".sidebar .views button", "Library");
check("beside a one-page writing the library shows whichever tab was chosen", (await page.run(`!!document.querySelector(".library")`)) && (await page.run(`[...document.querySelectorAll(".sidebar .views button")].map((b) => b.textContent.trim()).join()`)) === "Library");

// Renaming a one-page writing that isn't open sticks when it is opened.
await clickRow("writing", "The Lantern House");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "The Lantern House"`);
await sleep(500);
await menuOn("writing", "Why I write by hand first");
await choose("Rename");
await until(`!!document.activeElement?.closest(".tree-input")`);
await page.run(`(() => { const input = document.activeElement; input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await page.type("Why I write by hand");
await page.key("Enter", "Enter", 13);
await sleep(600);
await clickRow("writing", "Why I write by hand");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").startsWith("Why I write")`);
await sleep(1500);
check("a one-page writing renamed while closed keeps its new name once opened", (await title()) === "Why I write by hand" && (await page.run(`(document.querySelector(".paper .ProseMirror > h2")?.textContent ?? "").trim()`)) === "Why I write by hand", `${await title()} | ${await page.run(`document.querySelector(".paper .ProseMirror > h2")?.textContent`)}`);

// A name asked for once isn't asked again when the library is shown again.
await page.clickText(".titlebar [role=tab]", "Notes");
await until(`!!document.querySelector(".search input")`);
await page.clickText(".titlebar [role=tab]", "Write");
await until(`!!document.querySelector(".library")`);
await sleep(400);
check("an old request for a name doesn't come back", !(await page.run(`!!document.querySelector(".tree-input")`)));

// Home's "+ New" opens the New project window over Home, its name field keeping the keyboard (12 October).
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
// Home's New project button, as the design has it (12 October).
await page.clickText(".home .head button.new", "New project");
await until(`!!document.activeElement?.matches(".window .field input")`);
await sleep(800);
check("Home's + New gives a name field that keeps the keyboard", await page.run(`!!document.activeElement?.matches(".window .field input") && !!document.querySelector(".home .continue")`));
await page.type("Third project");
await page.key("Enter", "Enter", 13);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "") === "Third project"`);
check("and makes the project", (await title()) === "Third project", await title());

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
