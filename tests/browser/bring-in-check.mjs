// Word comes in where it acts (owner, 14 October): the library's + › New writing from Word adds documents she
// picks as writings of the open project; a writing's menu › Bring back from Word replaces its chapters with a
// document's after keeping an earlier version (a chapter of the same title keeping its place, a one-page
// writing staying one page); and documents dropped on Pensieve come in: on Home as a new project, in Write as
// new writings, each window saying first what they hold. Other files are refused, and nothing comes in over
// a window. Usage: node bring-in-check.mjs [port]
import { readFileSync } from "node:fs";
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
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
const FIRST = `${LIBRARY}\\My first project\\pensieve.db`;
const DESK = "C:\\Users\\Eva\\Desktop";
const base64 = (text) => Buffer.from(text, "utf8").toString("base64");
const WORD = readFileSync(new URL("./fixtures/example-novel-word.docx", import.meta.url)).toString("base64");
const seeded = {
  [`${DESK}\\Reka.md`]: base64("# Reka\n\n## Izvir\n\nVoda je mrzla. Čaša, šola, žaba.\n\n## Ustje\n\nMorje.\n"),
  [`${DESK}\\Pismo.txt`]: base64("Draga Eva,\n\npišem ti s potovanja."),
  [`${DESK}\\Welcome back.md`]: base64("## Welcome\n\nThe page as Word has it now.\n\n## A chapter from Word\n\nWritten in Word.\n"),
  [`${DESK}\\Dve poglavji.md`]: base64("## Prvo\n\nEna.\n\n## Drugo\n\nDve.\n"),
  [`${DESK}\\Pismo nazaj.txt`]: base64("Draga Eva,\n\nspet sem doma."),
};

const query = (sql) =>
  page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}`)}); const r = d.exec(${JSON.stringify(sql)}); return r[0] ? r[0].values : []; })()`);
const writings = async () => (await query("SELECT title FROM projects WHERE deleted_at = '' ORDER BY position")).map((row) => row[0]);
const chaptersOf = async (writing) =>
  query(`SELECT c.id, c.title, c.content_json FROM chapters c JOIN projects p ON c.project_id = p.id WHERE p.title = '${writing}' ORDER BY c.position`);
const answer = (...paths) => page.run(`(window.__PV_HARNESS__.dialogAnswers = ${JSON.stringify(paths)}, true)`);
const windowTitle = () => page.run(`document.querySelector(".window header span")?.textContent.trim() ?? ""`);
const windowShown = () => page.run(`!!document.querySelector(".window")`);
const found = () => page.run(`document.querySelector(".window .found .sum")?.textContent.replace(/\\s+/g, " ").trim() ?? ""`);
const foundTitles = () => page.run(`[...document.querySelectorAll(".window .found li")].map((el) => el.textContent.trim())`);
const press = (label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(".window button")].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const pick = (label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(".window .choice")].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row.${kind}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const menuOn = (kind, name) =>
  page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
const menuItems = () => page.run(`[...document.querySelectorAll(".tree-menu button .label")].map((el) => el.textContent.trim())`);
const chooseInMenu = async (label) => {
  await until(`!!document.querySelector(".tree-menu")`);
  return page.run(`(() => { const el = [...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`);
};
const titleBar = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);
const pageNotice = () => page.run(`document.querySelector(".notice, .write-notice, [role=status]")?.textContent.trim() ?? document.body.innerText`);
// Files dropped from Explorer onto `target`, as the window gets them: names and bytes (base64).
const drop = (target, files, type = "drop") =>
  page.run(`(() => {
    const data = new DataTransfer();
    for (const [name, bytes] of ${JSON.stringify(files)}) data.items.add(new File([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))], name));
    const event = new DragEvent(${JSON.stringify(type)}, { dataTransfer: data, bubbles: true, cancelable: true });
    document.querySelector(${JSON.stringify(target)}).dispatchEvent(event);
    return ${JSON.stringify(type)} === "dragover" ? data.dropEffect + "/" + event.defaultPrevented : event.defaultPrevented;
  })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(
  `window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library" })), localStorage.setItem("pv-files", ${JSON.stringify(JSON.stringify(seeded))}), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(700);

// The library's + › New writing from Word: two documents, each its own writing, once she sees what they hold.
await answer([`${DESK}\\Reka.md`, `${DESK}\\Pismo.txt`]);
await page.click(".sidebar-head .add");
await chooseInMenu("New writing from Word…");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("writings")`);
check(
  "New writing from Word says what the documents hold first",
  (await windowTitle()) === "New writing from Word" && (await found()) === "2 writings · 13 words" && JSON.stringify(await foundTitles()) === JSON.stringify(["Pismo", "Reka"]),
  `${await windowTitle()} | ${await found()} | ${JSON.stringify(await foundTitles())}`,
);
check("each its own writing to start with", await page.run(`document.querySelector(".window input[type=radio][name=each]")?.checked === true`));
await page.shoot(`${shots}bring-in-add.png`);
await press("Add to “My first project”");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === "Pismo"`, 80);
await sleep(500);
check(
  "they become writings of the open project, the first opened",
  JSON.stringify(await writings()) === JSON.stringify(["Untitled", "Pismo", "Reka"]) && (await titleBar()) === "Pismo",
  `${JSON.stringify(await writings())} | ${await titleBar()}`,
);
check("and Pensieve says so", (await page.run(`document.body.innerText`)).includes("Pismo, Reka are writings of this project now."));
check("Reka keeps its chapters, at its headings", JSON.stringify((await chaptersOf("Reka")).map((row) => row[1])) === JSON.stringify(["Izvir", "Ustje"]));

// Bring back from Word on a writing of chapters: the document's chapters take their place, Welcome keeps its id.
const before = await chaptersOf("Untitled");
const snapshots = async () => (await query("SELECT count(*) FROM snapshots"))[0][0];
const snapshotsBefore = await snapshots();
await menuOn("writing", "Untitled");
await until(`!!document.querySelector(".tree-menu")`);
check("a writing's menu offers Bring back from Word", (await menuItems()).includes("Bring back from Word…"), JSON.stringify(await menuItems()));
await answer(`${DESK}\\Welcome back.md`);
await chooseInMenu("Bring back from Word…");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("chapters")`, 80);
check(
  "it opens the writing and says what changes, keeping an earlier version",
  (await titleBar()) === "Untitled" &&
    (await windowTitle()) === "Bring back from Word" &&
    (await page.run(`document.querySelector(".window .note")?.textContent.trim()`)).startsWith("The chapters of “Untitled” become the document's.") &&
    (await found()) === "2 chapters · 10 words",
  `${await titleBar()} | ${await windowTitle()} | ${await found()}`,
);
await page.shoot(`${shots}bring-in-replace.png`);
await press("Replace");
await until(`(document.querySelector(".paper .ProseMirror")?.textContent ?? "").includes("The page as Word has it now.")`, 80);
await sleep(500);
const after = await chaptersOf("Untitled");
check(
  "the writing's chapters are the document's, Welcome keeping its place and id",
  JSON.stringify(after.map((row) => row[1])) === JSON.stringify(["Welcome", "A chapter from Word"]) && after[0][0] === before.find((row) => row[1] === "Welcome")?.[0],
  JSON.stringify(after.map((row) => row[1])),
);
check("an earlier version was kept first", (await snapshots()) === snapshotsBefore + 1, `${snapshotsBefore} → ${await snapshots()}`);

// A one-page writing stays one page: the document's chapters become headings in it.
await menuOn("writing", "Pismo");
await answer(`${DESK}\\Dve poglavji.md`);
await chooseInMenu("Bring back from Word…");
// Replace waits until the document is read and the window says what it holds.
await until(`!!document.querySelector(".window .note") && (document.querySelector(".window .found .sum")?.textContent ?? "").includes("chapters")`, 80);
check("for one page it says the text becomes the document's", (await page.run(`document.querySelector(".window .note")?.textContent.trim()`)).startsWith("The text of “Pismo” becomes the document's, still one page."));
await press("Replace");
await until(`(document.querySelector(".paper .ProseMirror")?.textContent ?? "").includes("Dve.")`, 80);
await sleep(400);
const letter = await chaptersOf("Pismo");
const headings = JSON.parse(letter[0]?.[2] ?? "{}").content?.filter((node) => node.type === "heading").map((node) => node.content?.[0]?.text) ?? [];
check("a one-page writing stays one page, the chapters as headings in it", letter.length === 1 && JSON.stringify(headings).includes('"Prvo"') && JSON.stringify(headings).includes('"Drugo"'), `${letter.length} ${JSON.stringify(headings)}`);

// A one-page document brought back to a one-page writing is its page as it is, under the writing's title.
await menuOn("writing", "Pismo");
await answer(`${DESK}\\Pismo nazaj.txt`);
await chooseInMenu("Bring back from Word…");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("One page")`, 80);
await press("Replace");
await until(`(document.querySelector(".paper .ProseMirror")?.textContent ?? "").includes("spet sem doma.")`, 80);
await sleep(400);
const page2 = await chaptersOf("Pismo");
const nodes = JSON.parse(page2[0]?.[2] ?? "{}").content ?? [];
check(
  "a page brought back to a page keeps the writing's title, with no heading added",
  page2.length === 1 && page2[0][1] === "Pismo" && !nodes.some((node) => node.type === "heading" && node.content?.[0]?.text !== "Pismo") && JSON.stringify(nodes).includes("spet sem doma."),
  `${page2.length} ${page2[0]?.[1]} ${JSON.stringify(nodes.map((node) => node.type))}`,
);

// Dropped in Write: new writings of the open project, once she sees what they hold; Cancel brings nothing in.
// (A drag made here keeps its drop effect "none" whatever is set, so the cursor's copy or no-entry can't be
// seen: what can is that Pensieve takes the drag, so a file never opens in its place.)
const overWrite = await drop(".paper", [["Reka.md", seeded[`${DESK}\\Reka.md`]]], "dragover");
check("a file dragged over Write is Pensieve's to take", overWrite.endsWith("/true"), overWrite);
check("dropping it there is Pensieve's, not the window's", await drop(".paper", [["Reka.md", seeded[`${DESK}\\Reka.md`]]]));
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("chapters")`);
check(
  "documents dropped in Write open New writing from Word",
  (await windowTitle()) === "New writing from Word" && (await found()) === "2 chapters · 7 words",
  `${await windowTitle()} | ${await found()} | ${await page.run(`[...document.querySelectorAll(".window")].map((el) => el.querySelector(".chosen")?.textContent + " / " + (el.querySelector(".note")?.textContent ?? "")).join(" || ")`)} | open: ${await titleBar()}`,
);
const count = (await writings()).length;
await press("Cancel");
await sleep(300);
check("Cancel brings nothing in", !(await windowShown()) && (await writings()).length === count);

// Over a window nothing comes in; a picture is refused, and she is told.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
const overWindow = await drop(".window", [["Reka.md", seeded[`${DESK}\\Reka.md`]]], "dragover");
check("over a window too, so it can't open there", overWindow.endsWith("/true"), overWindow);
await drop(".window", [["Reka.md", seeded[`${DESK}\\Reka.md`]]]);
await sleep(300);
check("but a file dropped over a window doesn't come in", (await windowTitle()) === "Settings" && (await page.run(`document.querySelectorAll(".window").length`)) === 1);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await drop(".paper", [["slika.png", base64("x")]]);
await until(`document.body.innerText.includes("Pensieve brings in Word, text and Markdown files.")`, 30);
check("a picture is refused, and Pensieve says what it takes", (await page.run(`document.body.innerText`)).includes("Pensieve brings in Word, text and Markdown files.") && !(await windowShown()));

// Dropped on Home: a new project from a Word file, its chapters said before anything is made.
await page.click(".titlebar .home-link, .titlebar .mark");
await until(`!!document.querySelector(".home .right")`);
await sleep(400);
check("a Word file dropped on Home", await drop(".home", [["Stari rokopis.docx", WORD]]));
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("chapters")`, 80);
check(
  "opens New project from Word, named after it, saying its chapters",
  (await windowTitle()) === "New project" &&
    (await page.run(`document.querySelector(".window input[type=radio][value=word]")?.checked === true`)) &&
    (await page.run(`document.querySelector(".window .field input").value`)) === "Stari rokopis" &&
    (await found()).startsWith("5 chapters · "),
  `${await windowTitle()} | ${await found()}`,
);
await press("Create");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === "The Lantern House"`, 120);
check("Create makes the project and opens it", (await titleBar()) === "The Lantern House", await titleBar());

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
