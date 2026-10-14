// Checks the New project window (owner, 12 October; two starts, 14 October): Home's "+ New", Home's new-project
// card, the library's + and a library folder's menu open it. A project starts from a blank page, or from Word:
// one or several Word, text or Markdown documents, read as they are chosen, the window saying what they hold
// (chapters, words, titles) before anything is made; several are each their own writing or one book with a
// chapter for each. A document that can't be read, or a taken name, is said in the window; Escape closes it
// with nothing made. The library's "Import as a new writing" says what a text file holds, then adds it. In
// English, then Slovenian. Usage: node --experimental-websocket new-project-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { clickFound } from "./tree-unfold.mjs";

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
const WRITING = "C:\\Users\\Eva\\Documents\\Pisanje";
const base64 = (text) => Buffer.from(text, "utf8").toString("base64");
const seeded = {
  [`${WRITING}\\Pod lipo.md`]: base64("# Pod lipo\n\n## 1. poglavje\n\nNika je odprla vrata. Čaša, šola, žaba.\n\n## 2. poglavje\n\nKonec **zgodbe**.\n"),
  [`${WRITING}\\Zgodbe\\1 Prva.txt`]: base64("Prva zgodba o reki.\n\nŠe en odstavek."),
  [`${WRITING}\\Zgodbe\\2 Druga.md`]: base64("# Druga\n\nDruga zgodba."),
  [`${WRITING}\\Zgodbe\\10 Deseta.txt`]: base64("Deseta zgodba."),
  [`${WRITING}\\Zgodbe\\~$skrito.docx`]: base64("x"),
  [`${WRITING}\\Zgodbe\\slika.png`]: base64("x"),
  [`${WRITING}\\Zgodbe\\Stari\\3 Tretja.txt`]: base64("Stara zgodba."),
  [`${LIBRARY}\\Romani\\beležke.txt`]: base64("Zapiski za roman."),
};

const query = (file, sql) =>
  page.run(`(() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${file}`)}); if (!d) return null; const r = d.exec(${JSON.stringify(sql)}); return r[0] ? r[0].values.map((row) => row[0]) : []; })()`);
const writings = (file) => query(file, "SELECT title FROM projects WHERE deleted_at = '' ORDER BY position");
const chapters = (file, writing) =>
  query(file, `SELECT c.title FROM chapters c JOIN projects p ON c.project_id = p.id WHERE p.title = '${writing}' ORDER BY c.position`);
const projectTitle = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);
const windowTitle = () => page.run(`document.querySelector(".window header span")?.textContent.trim() ?? ""`);
const windowShown = () => page.run(`!!document.querySelector(".window")`);
const answer = (...paths) => page.run(`(window.__PV_HARNESS__.dialogAnswers = ${JSON.stringify(paths)}, true)`);
const pick = (label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(".window .choice")].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const press = (label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(".window button")].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const nameField = () => page.run(`document.querySelector(".window .field input")?.value ?? null`);
const chosen = () => page.run(`document.querySelector(".window .chosen")?.textContent.trim() ?? ""`);
const start = (label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(".window .start")].find((item) => item.querySelector("b")?.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const found = () => page.run(`document.querySelector(".window .found .sum")?.textContent.replace(/\\s+/g, " ").trim() ?? ""`);
const foundTitles = () => page.run(`[...document.querySelectorAll(".window .found li")].map((el) => el.textContent.trim())`);
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row.${kind}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const menuOn = (kind, name) =>
  page.run(`(() => { const el = ${rowSel(kind, name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
const menuItems = () => page.run(`[...document.querySelectorAll(".tree-menu button .label")].map((el) => el.textContent.trim())`);
const chooseInMenu = async (label) => {
  await until(`!!document.querySelector(".tree-menu")`);
  return page.run(`(() => { const el = [...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`);
};
const opened = (name) => until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === ${JSON.stringify(name)}`, 80);
const goHome = async () => {
  await page.click(".titlebar .home-link, .titlebar .mark");
  await until(`!!document.querySelector(".home .right")`);
  await sleep(400);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(
  `window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight", sidebarView: "library" })), localStorage.setItem("pv-files", ${JSON.stringify(JSON.stringify(seeded))}), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .right")`);
await sleep(500);

// Home's New project button: a window over Home, not Write.
await page.clickText(".home .head button.new", "New project");
check(
  "Home's New project button opens the New project window over Home",
  (await until(`!!document.querySelector(".window")`)) && (await windowTitle()) === "New project" && (await page.run(`!!document.querySelector(".home .right") && !document.querySelector(".paper")`)),
  await windowTitle(),
);
check("its name field has the keyboard", await until(`!!document.activeElement?.matches(".window .field input")`));
const places = await page.run(`[...document.querySelectorAll(".window select option")].map((option) => option.textContent.trim())`);
check("Where lists the library and its folders", JSON.stringify(places) === JSON.stringify(["Library", "Romani"]), JSON.stringify(places));
const starts = await page.run(`[...document.querySelectorAll(".window .start .what")].map((el) => { const name = el.querySelector("b").textContent; return name + " | " + el.textContent.slice(name.length).trim(); })`);
check(
  "two starts, each saying what it makes, under a line saying what a project is",
  JSON.stringify(starts) === JSON.stringify(["A blank page | Start writing; add chapters as you go.", "From Word | Bring in what you have: its headings become chapters."]) &&
    (await page.run(`document.querySelector(".window .intro")?.textContent.trim()`)) === "A project keeps a book, or several stories, with their notes and ideas.",
  JSON.stringify(starts),
);
check("it starts with a blank page", await page.run(`document.querySelector(".window input[type=radio][value=empty]")?.checked === true`));
await page.shoot(`${shots}new-project-1366.png`);
await page.type("Zgodbe ob reki");
await page.key("Enter", "Enter", 13);
await opened("Zgodbe ob reki");
await sleep(500);
const EMPTY = `${LIBRARY}\\Zgodbe ob reki\\pensieve.db`;
check(
  "Enter makes an empty project and opens it in Write, the window gone",
  (await projectTitle()) === "Zgodbe ob reki" && !(await windowShown()) && (await page.run(`!!document.querySelector(".paper .ProseMirror")`)),
  await projectTitle(),
);
check("in its own folder in the library, with one writing named after it", JSON.stringify(await writings(EMPTY)) === JSON.stringify(["Zgodbe ob reki"]), JSON.stringify(await writings(EMPTY)));

// The library's "Import as a new writing" takes a text file too, once she sees what it holds.
await clickFound(page, rowSel("folder", "Romani"));
await until(`!!(${rowSel("file", "beležke.txt")})`);
await menuOn("file", "beležke.txt");
await until(`!!document.querySelector(".tree-menu")`);
check("a text file in the library offers Import as a new writing", (await menuItems()).includes("Import as a new writing"), JSON.stringify(await menuItems()));
await chooseInMenu("Import as a new writing");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("word")`);
check(
  "it says what the file holds first, in a window like New project",
  (await windowTitle()) === "New writing from Word" && (await found()) === "One page · 3 words",
  `${await windowTitle()} | ${await found()}`,
);
await press("Add to “Zgodbe ob reki”");
await until(`(${JSON.stringify(EMPTY)}, (() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${EMPTY}`)}); return d && d.exec("SELECT count(*) FROM projects")[0].values[0][0] === 2; })())`, 80);
await sleep(600);
check("and becomes a writing of the open project, opened", JSON.stringify(await writings(EMPTY)) === JSON.stringify(["Zgodbe ob reki", "beležke"]) && (await page.run(`document.querySelector(".paper .ProseMirror")?.textContent.includes("Zapiski za roman.")`)), JSON.stringify(await writings(EMPTY)));

// Home's new-project card, From Word with a Markdown file: the file names the project, its headings make
// chapters, and the window says so before anything is made.
await goHome();
await page.click(".home .grid .card.new");
await until(`!!document.querySelector(".window")`);
await start("From Word");
await until(`!!document.querySelector(".window .pick button")`);
check("Create waits for documents", await page.run(`document.querySelector(".window footer .primary")?.disabled === true`));
await answer(`${WRITING}\\Pod lipo.md`);
await press("Choose documents…");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("chapters")`);
check("a chosen document names the project", (await nameField()) === "Pod lipo" && (await chosen()) === "Pod lipo.md", `${await nameField()} | ${await chosen()}`);
check(
  "and the window says what it holds: its chapters and words, and their titles",
  (await found()) === "2 chapters · 9 words" && JSON.stringify(await foundTitles()) === JSON.stringify(["1. poglavje", "2. poglavje"]),
  `${await found()} ${JSON.stringify(await foundTitles())}`,
);
await page.shoot(`${shots}new-project-file.png`);
await press("Create");
await opened("Pod lipo");
await sleep(500);
const FROM_FILE = `${LIBRARY}\\Pod lipo\\pensieve.db`;
check(
  "a Markdown file becomes the project's writing, its chapters at its headings",
  JSON.stringify(await writings(FROM_FILE)) === JSON.stringify(["Pod lipo"]) && JSON.stringify(await chapters(FROM_FILE, "Pod lipo")) === JSON.stringify(["1. poglavje", "2. poglavje"]),
  `${JSON.stringify(await writings(FROM_FILE))} ${JSON.stringify(await chapters(FROM_FILE, "Pod lipo"))}`,
);
check(
  "with its č, š and ž, and its bold",
  (await page.run(`document.querySelector(".paper .ProseMirror")?.textContent.includes("Čaša, šola, žaba.")`)) &&
    JSON.stringify(await query(FROM_FILE, "SELECT content_json FROM chapters WHERE title = '2. poglavje'")).includes("bold"),
);

// The library's +, several documents as one book: a chapter for each, in the order Explorer shows them,
// whatever order they were picked in.
const STORIES = [`${WRITING}\\Zgodbe\\10 Deseta.txt`, `${WRITING}\\Zgodbe\\1 Prva.txt`, `${WRITING}\\Zgodbe\\2 Druga.md`];
await until(`!!document.querySelector(".sidebar-head .add")`);
await page.click(".sidebar-head .add");
await chooseInMenu("New project");
check("the library's + › New project opens the window", (await until(`!!document.querySelector(".window")`)) && (await windowTitle()) === "New project");
await start("From Word");
await answer(STORIES);
await press("Choose documents…");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("writings")`);
check("several chosen documents say how many, and name the project after their folder", (await chosen()) === "Zgodbe · 3 files" && (await nameField()) === "Zgodbe", `${await chosen()} | ${await nameField()}`);
check("each document its own writing is the first choice", await page.run(`document.querySelector(".window input[type=radio][name=each]")?.checked === true`));
await pick("One book, a chapter for each document");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("chapters")`);
check(
  "as one book, the window says its chapters, in Explorer's order",
  (await found()) === "3 chapters · 11 words" && JSON.stringify(await foundTitles()) === JSON.stringify(["1 Prva", "Druga", "10 Deseta"]),
  `${await found()} ${JSON.stringify(await foundTitles())}`,
);
await page.shoot(`${shots}new-project-folder.png`);
await press("Create");
await opened("Zgodbe");
await sleep(500);
const BOOK = `${LIBRARY}\\Zgodbe\\pensieve.db`;
check(
  "one book, a chapter for each document, 10 after 2",
  JSON.stringify(await writings(BOOK)) === JSON.stringify(["Zgodbe"]) && JSON.stringify(await chapters(BOOK, "Zgodbe")) === JSON.stringify(["1 Prva", "Druga", "10 Deseta"]),
  `${JSON.stringify(await writings(BOOK))} ${JSON.stringify(await chapters(BOOK, "Zgodbe"))}`,
);

// A library folder's New project goes in that folder; each document its own writing, under a name she gave.
await menuOn("folder", "Romani");
await chooseInMenu("New project");
await until(`!!document.querySelector(".window")`);
check("a folder's New project goes in that folder", (await page.run(`document.querySelector(".window select")?.value ?? ""`)) === `${LIBRARY}\\Romani`, await page.run(`document.querySelector(".window select")?.value ?? ""`));
await page.type("Kratke zgodbe");
await start("From Word");
await answer(STORIES);
await press("Choose documents…");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("writings")`);
check("a name she typed stays when she chooses documents", (await nameField()) === "Kratke zgodbe", await nameField());
await press("Create");
// The title bar names the open writing: a project of several opens on the first.
check("it opens on its first writing", await opened("1 Prva"), await projectTitle());
await sleep(500);
const EACH = `${LIBRARY}\\Romani\\Kratke zgodbe\\pensieve.db`;
check("each document its own writing, in order, in the folder asked for", JSON.stringify(await writings(EACH)) === JSON.stringify(["1 Prva", "Druga", "10 Deseta"]), JSON.stringify(await writings(EACH)));

// A document that can't be read, and a taken name: said in the window, which stays; Escape closes it.
const projectsBefore = await page.run(`window.__PV_HARNESS__.books.size`);
await page.click(".sidebar-head .add");
await chooseInMenu("New project");
await until(`!!document.querySelector(".window")`);
await start("From Word");
await answer(`${WRITING}\\Ni ga.docx`);
await press("Choose documents…");
await until(`!!document.querySelector(".window .found .problem")`);
check(
  "a document that can't be read says why, and Create waits",
  (await page.run(`document.querySelector(".window .found .problem")?.textContent.trim()`)) === "“Ni ga.docx” couldn't be read: That file isn't there any more" &&
    (await page.run(`document.querySelector(".window footer .primary").disabled`)),
  await page.run(`document.querySelector(".window .found .problem")?.textContent.trim()`),
);
await start("A blank page");
await page.run(`(() => { const input = document.querySelector(".window .field input"); input.focus(); input.value = "Zgodbe ob reki"; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await press("Create");
await until(`!!document.querySelector(".window [role=alert]")`);
check(
  "a name already there is refused in the window, saying why",
  (await windowShown()) && /already there/.test(await page.run(`document.querySelector(".window [role=alert]")?.textContent ?? ""`)),
  await page.run(`document.querySelector(".window [role=alert]")?.textContent ?? ""`),
);
await page.run(`document.querySelector(".window .field input").focus(), true`);
await page.key("Escape", "Escape", 27);
await sleep(300);
check(
  "Escape closes it, with nothing made",
  !(await windowShown()) && (await projectTitle()) === "1 Prva" && (await page.run(`window.__PV_HARNESS__.books.size`)) === projectsBefore,
  await projectTitle(),
);
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));

// In Slovenian.
await page.run(`(() => { const prefs = JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}"); prefs.uiLanguage = "sl"; localStorage.setItem("pensieve-prefs", JSON.stringify(prefs)); return true; })()`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .grid .card.new")`);
await sleep(400);
await page.click(".home .grid .card.new");
await until(`!!document.querySelector(".window")`);
await start("Iz Worda");
await answer(STORIES);
await press("Izberi dokumente …");
await until(`(document.querySelector(".window .found .sum")?.textContent ?? "").includes("besed")`);
const words = await page.run(`({
  title: document.querySelector(".window header span")?.textContent.trim(),
  intro: document.querySelector(".window .intro")?.textContent.trim(),
  labels: [...document.querySelectorAll(".window .field, .window legend")].map((el) => el.firstChild?.textContent.trim()),
  starts: [...document.querySelectorAll(".window .start b")].map((el) => el.textContent.trim()),
  choices: [...document.querySelectorAll(".window .choice")].map((el) => el.textContent.trim()),
  chosen: document.querySelector(".window .chosen")?.textContent.trim(),
  found: document.querySelector(".window .found .sum")?.textContent.replace(/\\s+/g, " ").trim(),
  buttons: [...document.querySelectorAll(".window footer button")].map((el) => el.textContent.trim()),
})`);
check(
  "in Slovenian: Nov projekt, what a project is, Ime, Kam, the two starts, the choices, what was found and the buttons",
  words.title === "Nov projekt" &&
    words.intro === "Projekt hrani knjigo ali več zgodb, skupaj z zapiski in idejami." &&
    JSON.stringify(words.labels) === JSON.stringify(["Ime", "Kam", "Kako želite začeti?"]) &&
    JSON.stringify(words.starts) === JSON.stringify(["Prazna stran", "Iz Worda"]) &&
    JSON.stringify(words.choices) === JSON.stringify(["Vsak dokument svoje besedilo", "Ena knjiga, vsak dokument svoje poglavje"]) &&
    words.chosen === "Zgodbe · 3 datoteke" &&
    words.found === "3 besedila · 11 besed" &&
    JSON.stringify(words.buttons) === JSON.stringify(["Prekliči", "Ustvari"]),
  JSON.stringify(words),
);
await page.shoot(`${shots}new-project-sl.png`);
await press("Prekliči");
await sleep(300);
check("Prekliči closes it", !(await windowShown()));

check("no errors on the page in Slovenian", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
