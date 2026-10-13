// Checks the owner's 8 October tree wishes: what unfolds shows its own rows folded (writing folders, note
// groups, another writing's parts), except the way to the chapter on the page; the open writing's parts
// in the library show only the one holding that chapter, while the Chapters tab shows them all; Notes
// and each of its groups have a + that starts a new note there. Usage: node tree-fold-check.mjs
import { connect, sleep } from "./cdp.mjs";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const page = await connect({ width: 1536, height: 864 });
const until = async (expression, tries = 80) => {
  for (let turn = 0; turn < tries; turn += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const KINDS = ["folder", "project", "wfolder", "writing", "part", "chapter", "notes", "group", "note", "todos", "deleted", "elsewhere"];
const rows = () =>
  page.run(`[...document.querySelectorAll(".library button.tree-row")].map((el) => {
    const kind = ${JSON.stringify(KINDS)}.find((name) => el.classList.contains(name)) ?? (el.closest("li.part") ? "part" : "page");
    const open = el.getAttribute("aria-expanded");
    return kind + ":" + (el.querySelector(".name")?.textContent.trim() ?? "") + (open === "true" ? " v" : open === "false" ? " >" : "");
  })`);
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row${kind ? `.${kind}` : ""}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const clickRow = (kind, name) => page.run(`(() => { const el = ${rowSel(kind, name)}; el?.click(); return !!el; })()`);

await page.harness();
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".library")`);
await sleep(500);
await clickRow("project", "The Lantern series");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").includes("Lantern")`);
await sleep(800);

let tree = await rows();
check("the library tab comes first", (await page.run(`[...document.querySelectorAll(".sidebar .views button")].map((b) => b.textContent.trim()).join()`)) === "Library,Chapters");
check("a writing folder holding another writing starts folded", tree.includes("wfolder:Published >"), tree.join(" | "));
check("the open writing's parts: only the one holding the chapter on the page unfolds", tree.includes("part:Part One v") && tree.includes("part:Part Two >") && tree.some((row) => row.startsWith("page:The Letter")) && !tree.some((row) => /Attic/.test(row)), tree.filter((row) => /^(part|page):/.test(row)).join(" | "));
check("Notes starts folded", tree.includes("notes:Notes >"), tree.join(" | "));

// Unfolding Notes shows its groups folded.
await clickRow("notes", "Notes");
await sleep(300);
tree = await rows();
const groups = tree.filter((row) => row.startsWith("group:"));
check("unfolding Notes shows its groups, each folded", groups.length === 4 && groups.every((row) => !row.endsWith(" v")) && !tree.some((row) => row.startsWith("note:")), groups.join(" | "));

// Unfolding the writing folder shows its writings; another project's writing unfolded shows its parts folded.
await clickRow("wfolder", "Published");
await sleep(300);
check("unfolding the writing folder shows its writings", (await rows()).includes("writing:Why I write by hand first"), (await rows()).join(" | "));

// The Chapters tab shows every part unfolded.
await page.clickText(".sidebar .views button", "Chapters");
await sleep(300);
const chapters = await page.run(`[...document.querySelectorAll(".sidebar .chapter-list button.tree-row")].map((el) => el.querySelector(".name")?.textContent.trim() + (el.getAttribute("aria-expanded") === "false" ? " >" : ""))`);
check("the Chapters tab shows every part unfolded", chapters.includes("Part Two") && chapters.some((name) => /Attic/.test(name)), chapters.join(" | "));
await page.clickText(".sidebar .views button", "Library");
await until(`!!document.querySelector(".library")`);
await sleep(300);

// A + on Notes and on each group.
const pluses = await page.run(`[...document.querySelectorAll(".library .with-add")].filter((row) => row.querySelector(".row-add")?.getAttribute("aria-label")?.startsWith("New note")).map((row) => row.querySelector(".name")?.textContent.trim() + ":" + (row.querySelector(".row-add")?.getAttribute("aria-label") ?? ""))`);
await page.run(`(() => { const el = document.querySelector(".library .with-add .tree-row.group"); el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); return true; })()`);
await page.shoot(fileURLToPath(new URL("./shots/tree-plus.png", import.meta.url)), { x: 0, y: 80, width: 300, height: 480 });
check("Notes and each group have a +", pluses.length === 5 && pluses[0] === "Notes:New note" && pluses.includes("Places:New note in Places"), JSON.stringify(pluses));
await page.run(`(() => { const row = [...document.querySelectorAll(".library .with-add")].find((el) => el.querySelector(".name")?.textContent.trim() === "Places"); row.querySelector(".row-add").click(); return true; })()`);
check("the + on a group asks for the new note's name there", await until(`!!document.querySelector(".library .tree-input input")`));
await page.type("Bled");
await page.key("Enter", "Enter", 13);
check("the new note opens in the panel beside the page", await until(`document.querySelector("aside.pane input.title")?.value === "Bled"`));
await page.click("aside.pane .back");
await sleep(400);
tree = await rows();
const places = tree.indexOf("group:Places v");
check("and it is under Places in the tree", places >= 0 && tree.slice(places + 1).findIndex((row) => row === "note:Bled") >= 0 && tree.slice(places + 1, tree.indexOf("note:Bled") + 1).every((row) => row.startsWith("note:")), tree.join(" | "));

// The + on Notes itself makes an idea.
await page.run(`(() => { const row = [...document.querySelectorAll(".library .with-add")].find((el) => el.querySelector(".name")?.textContent.trim() === "Notes"); row.querySelector(".row-add").click(); return true; })()`);
await until(`!!document.querySelector(".library .tree-input input")`);
await page.type("A first idea");
await page.key("Enter", "Enter", 13);
await until(`!!document.querySelector("aside.pane input.title")`);
await page.click("aside.pane .back");
await sleep(400);
tree = await rows();
const ideas = tree.indexOf("group:Ideas v");
check("the + on Notes makes a note under Ideas", ideas >= 0 && tree.slice(ideas + 1).includes("note:A first idea"), tree.join(" | "));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
