// Checks how the library beside the page looks and moves: the Chapters | Library switch, one-line rows
// drawn as a file explorer (indented by depth, guides, an arrow on what unfolds), a project's writings
// and a writing's parts and chapters, the arrow keys, a one-page writing, live word totals, renaming in
// the tree, and the choice remembered. Projects and their flows are in projects-check.mjs.
// Usage: node library-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { clickFound } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1500, height: 900 });
await page.harness();
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
// "kind:name words", with "*" for the open project or writing; the open writing's chapters are "page".
const tree = () =>
  page.run(`[...document.querySelectorAll(".library button.tree-row")].map((el) => {
    const kind = ${JSON.stringify(KINDS)}.find((name) => el.classList.contains(name)) ?? "page";
    const count = el.querySelector(".words, .count");
    return (el.classList.contains("current") ? "*" : "") + kind + ":" + (el.querySelector(".name")?.textContent.trim() ?? "") + (count ? " " + count.textContent.trim() : "");
  })`);
const tabs = () => page.run(`[...document.querySelectorAll(".sidebar .views button")].map((b) => b.textContent.trim() + (b.getAttribute("aria-selected") === "true" ? "*" : ""))`);
const head = () => page.run(`[...document.querySelectorAll(".sidebar-head > button")].map((b) => b.className.split(" ")[0])`);
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row${kind ? `.${kind}` : ""}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const nameLeft = (kind, name) => page.run(`Math.round((${rowSel(kind, name)})?.querySelector(".name").getBoundingClientRect().left ?? -1)`);
const clickRow = (kind, name) => clickFound(page, rowSel(kind, name));
const title = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);

// The example projects, so the library has something to show.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(500);

check("the list beside the page offers the Library, then Chapters", JSON.stringify(await tabs()) === JSON.stringify(["Library", "Chapters*"]), JSON.stringify(await tabs()));
check("the chapter list's head has its + and hide buttons", JSON.stringify(await head()) === JSON.stringify(["add", "hide"]), JSON.stringify(await head()));
await page.clickText(".sidebar .views button", "Library");
await until(`!!document.querySelector(".library")`);
await sleep(400);
const first = await tree();
check("the library shows its folders and projects, the open one unfolded", first[0] === "folder:Examples" && first.includes("project:The Lantern series 883") && first.some((row) => /^\*project:My first project \d+$/.test(row)) && first.some((row) => /^\*writing:Untitled \d+$/.test(row)), first.join(" | "));
check("the library's head has one + and the hide button", JSON.stringify(await head()) === JSON.stringify(["add", "hide"]), JSON.stringify(await head()));
await page.click(".sidebar-head .add");
await until(`!!document.querySelector(".tree-menu")`);
const plusMenu = await page.run(`[...document.querySelectorAll(".tree-menu button .label")].map((el) => el.textContent.trim())`);
check("its + says in words what it makes", JSON.stringify(plusMenu) === JSON.stringify(["New writing", "New writing from Word…", "New project", "New folder", "Open another project…"]), JSON.stringify(plusMenu));
await page.key("Escape", "Escape", 27);
await sleep(200);
const hideLabel = () => page.run(`document.querySelector(".sidebar .hide")?.getAttribute("title") ?? ""`);
check("its hide button says Hide library", (await hideLabel()) === "Hide library", await hideLabel());

// Drawn as a file explorer: one-line rows, each level further in, an arrow on what unfolds.
const look = await page.run(`(() => {
  const rows = [...document.querySelectorAll(".library button.tree-row")];
  return {
    heights: [...new Set(rows.map((row) => Math.round(row.getBoundingClientRect().height)))],
    arrows: rows.filter((row) => row.querySelector(".twist svg")).length,
    unfolding: rows.filter((row) => row.hasAttribute("aria-expanded")).length,
    guides: rows.every((row) => getComputedStyle(row).backgroundImage.includes("repeating-linear-gradient")),
  };
})()`);
check("every row is one compact line", look.heights.length === 1 && look.heights[0] >= 22 && look.heights[0] <= 26, JSON.stringify(look.heights));
check("an arrow on each row that unfolds, and only there", look.arrows === look.unfolding && look.arrows >= 3, `${look.arrows} arrows, ${look.unfolding} unfolding`);
check("rows draw their guides", look.guides);
const levels = [await nameLeft("folder", "Examples"), await nameLeft("project", "The Lantern series"), await nameLeft("project", "My first project"), await nameLeft("writing", "Untitled"), await nameLeft("", "Welcome")];
check("each level sits further in: folder, its project; project, writing, chapter", levels[0] < levels[1] && levels[2] < levels[3] && levels[3] < levels[4], JSON.stringify(levels));
await page.shoot(`${shots}library.png`, { x: 0, y: 70, width: 280, height: 360 });

// Another project opens from the library, on its first writing, with the library still open.
await clickRow("project", "The Lantern series");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Lantern")`);
await sleep(700);
const second = await tree();
check("a project opens from the library on its writing, and the page shows it", second.includes("*project:The Lantern series 883") && second.includes("*writing:The Lantern House 686") && (await page.run(`!!document.querySelector(".paper .ProseMirror")`)), second.join(" | "));
check("the library view stays", JSON.stringify(await tabs()) === JSON.stringify(["Library*", "Chapters"]));
check("the writing's parts are rows, with its chapters under them", second.includes("page:Part One") && second.includes("page:Part Two"), second.join(" | "));
// Only the part holding the chapter on the page starts unfolded (owner, 8 October).
check("only the part holding the open chapter starts unfolded", second.some((row) => /Letter/.test(row)) && !second.some((row) => /Attic/.test(row)), second.filter((row) => row.startsWith("page:")).join(" | "));
await page.clickText(".library ul.tree button.tree-row", "Part Two");
await sleep(300);
const indent = [await nameLeft("", "Part One"), await nameLeft("", "The Letter"), await nameLeft("", "The Attic"), await nameLeft("", "Untitled")];
check("a part's chapters sit further in than the part, the last one too", indent[1] > indent[0] && indent[2] === indent[3] && indent[2] === indent[1], JSON.stringify(indent));
check("the tree shows each chapter's words, not its goal", second.includes("page:The Letter 211") && !second.some((row) => row.includes("/")), second.filter((row) => row.startsWith("page:")).join(" | "));
const marked = await page.run(`(() => { const row = document.querySelector(".library ul.tree button.active"); const style = row && getComputedStyle(row); return style ? { name: row.querySelector(".name").textContent.trim(), background: style.backgroundColor, weight: style.fontWeight } : null; })()`);
check("the chapter on the page is marked in the tree", !!marked && marked.background !== "rgba(0, 0, 0, 0)" && Number(marked.weight) >= 600, JSON.stringify(marked));
await page.shoot(`${shots}library-parts.png`, { x: 0, y: 70, width: 280, height: 520 });

// A part folds and unfolds; the arrow keys move through the tree and fold it.
await page.clickText(".library ul.tree button.tree-row", "Part One");
await sleep(300);
const foldedPart = await tree();
check("a part folds away its chapters", foldedPart.includes("page:Part One") && !foldedPart.some((row) => /Letter|Fog on/.test(row)) && foldedPart.some((row) => /Attic/.test(row)), foldedPart.filter((row) => row.startsWith("page:")).join(" | "));
await page.clickText(".library ul.tree button.tree-row", "Part One");
await sleep(300);
check("and unfolds them again", (await tree()).some((row) => /Letter/.test(row)));
await page.run(`document.querySelector(".library .folder").focus(), true`);
await page.key("ArrowDown", "ArrowDown", 40);
await sleep(150);
check("down moves to the next row", (await page.run(`document.activeElement?.querySelector(".name")?.textContent.trim() ?? ""`)) === "The Lantern series");
await page.run(`document.querySelector(".library .folder").focus(), true`);
await page.key("ArrowLeft", "ArrowLeft", 37);
await sleep(300);
const leftFolded = await page.run(`document.querySelector(".library .folder").getAttribute("aria-expanded")`);
await page.key("ArrowRight", "ArrowRight", 39);
await sleep(300);
check("left folds a folder and right unfolds it", leftFolded === "false" && (await page.run(`document.querySelector(".library .folder").getAttribute("aria-expanded")`)) === "true");

// A chapter opens from the tree.
await page.run(`(() => { const name = [...document.querySelectorAll(".library ul.tree .name")].find((el) => /Attic/.test(el.textContent)); name?.closest("button")?.click(); return !!name; })()`);
await until(`(document.querySelector(".paper .ProseMirror > h2")?.textContent ?? "").includes("Attic")`);
check("a chapter opens from the tree", (await page.run(`document.querySelector(".paper .ProseMirror > h2")?.textContent ?? ""`)).includes("Attic"));

// A one-page writing keeps the library, without chapter rows or a Chapters tab; a writing in chapters brings them back.
await clickRow("writing", "Why I write by hand first");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("hand")`);
await sleep(700);
const article = await page.run(`({ tabs: [...document.querySelectorAll(".sidebar .views button")].map((b) => b.textContent.trim()), rows: document.querySelectorAll(".library ul.tree li").length, plus: document.querySelector(".sidebar-head .add")?.getAttribute("title") ?? "", arrow: !!(${rowSel("writing", "Why I write by hand first")})?.querySelector(".twist svg"), page: (document.querySelector(".paper .ProseMirror > h2")?.textContent ?? "").slice(0, 20) })`);
check("a one-page writing keeps the library, with its + and no chapter rows", JSON.stringify(article.tabs) === JSON.stringify(["Library"]) && article.rows === 0 && article.plus === "New writing, project or folder" && !article.arrow && /Why I/.test(article.page), JSON.stringify(article));
await clickRow("project", "Zgodbe ob reki");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Zgodbe")`);
await sleep(700);
check("a writing in chapters brings the Chapters tab and its rows back", JSON.stringify(await tabs()) === JSON.stringify(["Library*", "Chapters"]) && (await tree()).filter((row) => row.startsWith("page:")).length >= 2, (await tree()).join(" | "));

// The open writing's words are live: type, and its row climbs with the chapter row.
const wordsOf = () => page.run(`(${rowSel("writing", "Zgodbe ob reki")})?.querySelector(".words")?.textContent.trim()`);
const before = await wordsOf();
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Nekaj novih besed za knjigo tukaj.");
await sleep(1200);
check("the open writing's word total follows the typing", (await wordsOf()) !== before && !!before, `${before} -> ${await wordsOf()}`);

// Renaming a chapter in the tree, with a double click.
await page.run(`(() => { const button = [...document.querySelectorAll(".library ul.tree button.tree-row")].find((row) => /Brod/.test(row.textContent)); button?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); return !!button; })()`);
await until(`!!document.querySelector(".library ul.tree input")`);
const field = await page.run(`(() => { const input = document.querySelector(".library ul.tree input"); if (!input) return null; const box = input.getBoundingClientRect(); return { height: Math.round(box.height), left: Math.round(box.left), right: Math.round(box.right), width: input.closest(".library").getBoundingClientRect().right }; })()`);
check("renaming in the tree is one row, inside the tree", !!field && field.height <= 26 && field.left > 20 && field.right <= field.width, JSON.stringify(field));
await page.key("Escape", "Escape", 27);
await sleep(200);

// The choice remembered across a restart; Chapters comes back, its rows drawn like the library's (8 October).
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".sidebar .views")`);
await sleep(400);
check("the choice is remembered", JSON.stringify(await tabs()) === JSON.stringify(["Library*", "Chapters"]), JSON.stringify(await tabs()));
await page.clickText(".sidebar .views button", "Chapters");
await sleep(300);
check("Chapters comes back, without a status legend", !!(await page.run(`document.querySelector(".sidebar .chapter-list")`)) && !(await page.run(`document.querySelector(".sidebar .legend, .library")`)));
check("its hide button says Hide chapters again", (await hideLabel()) === "Hide chapters", await hideLabel());
const chapterRows = await page.run(`(() => { const row = document.querySelector(".sidebar .chapter-list li button"); return row ? { height: Math.round(row.getBoundingClientRect().height), tree: row.classList.contains("tree-row"), dots: document.querySelectorAll(".sidebar .dot").length } : null; })()`);
check("the chapter list's rows are the library's tree rows, with no status dots", !!chapterRows && chapterRows.tree && chapterRows.height === 24 && chapterRows.dots === 0, JSON.stringify(chapterRows));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
