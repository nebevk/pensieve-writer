// Checks the New project window (owner, 12 October): Home's "+ New", Home's new-project card, the library's
// + and a library folder's menu open it, instead of Write with a name to type in the tree. A project starts
// empty, from a Word, text or Markdown file, or from a folder of files (each its own writing, or one book
// with a chapter for each). A taken name is refused in the window; Escape closes it with nothing made.
// The library's "Import as a new writing" takes text files too. In English, then Slovenian.
// Usage: node --experimental-websocket new-project-check.mjs [port]
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
check("it starts with an empty page", await page.run(`document.querySelector(".window input[type=radio][value=empty]")?.checked === true`));
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

// The library's "Import as a new writing" takes a text file too.
await clickFound(page, rowSel("folder", "Romani"));
await until(`!!(${rowSel("file", "beležke.txt")})`);
await menuOn("file", "beležke.txt");
await until(`!!document.querySelector(".tree-menu")`);
check("a text file in the library offers Import as a new writing", (await menuItems()).includes("Import as a new writing"), JSON.stringify(await menuItems()));
await chooseInMenu("Import as a new writing");
await until(`(${JSON.stringify(EMPTY)}, (() => { const d = window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${EMPTY}`)}); return d && d.exec("SELECT count(*) FROM projects")[0].values[0][0] === 2; })())`, 80);
await sleep(600);
check("and becomes a writing of the open project, opened", JSON.stringify(await writings(EMPTY)) === JSON.stringify(["Zgodbe ob reki", "beležke"]) && (await page.run(`document.querySelector(".paper .ProseMirror")?.textContent.includes("Zapiski za roman.")`)), JSON.stringify(await writings(EMPTY)));

// Home's new-project card, from a Markdown file: the file names the project, its headings make chapters.
await goHome();
await page.click(".home .grid .card.new");
await until(`!!document.querySelector(".window")`);
await pick("A file");
await until(`!!document.querySelector(".window .pick button")`);
check("Create waits for a file", await page.run(`document.querySelector(".window footer .primary")?.disabled === true`));
await answer(`${WRITING}\\Pod lipo.md`);
await press("Choose a file…");
await until(`!!document.querySelector(".window .chosen")`);
check("a chosen file names the project", (await nameField()) === "Pod lipo" && (await chosen()) === "Pod lipo.md", `${await nameField()} | ${await chosen()}`);
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

// The library's +, from a folder, as one book: a chapter for each file, in the order Explorer shows them.
await until(`!!document.querySelector(".sidebar-head .add")`);
await page.click(".sidebar-head .add");
await chooseInMenu("New project");
check("the library's + › New project opens the window", (await until(`!!document.querySelector(".window")`)) && (await windowTitle()) === "New project");
await pick("A folder of files");
await answer(`${WRITING}\\Zgodbe`);
await press("Choose a folder…");
await until(`!!document.querySelector(".window .chosen")`);
check("a chosen folder says how many of its files come in, and names the project", (await chosen()) === "Zgodbe · 3 files" && (await nameField()) === "Zgodbe", `${await chosen()} | ${await nameField()}`);
await pick("One book, a chapter for each file");
await page.shoot(`${shots}new-project-folder.png`);
await press("Create");
await opened("Zgodbe");
await sleep(500);
const BOOK = `${LIBRARY}\\Zgodbe\\pensieve.db`;
check(
  "one book, a chapter for each file, 10 after 2, Word's lock file, pictures and inner folders left out",
  JSON.stringify(await writings(BOOK)) === JSON.stringify(["Zgodbe"]) && JSON.stringify(await chapters(BOOK, "Zgodbe")) === JSON.stringify(["1 Prva", "Druga", "10 Deseta"]),
  `${JSON.stringify(await writings(BOOK))} ${JSON.stringify(await chapters(BOOK, "Zgodbe"))}`,
);

// A library folder's New project goes in that folder; each file its own writing, under a name she gave.
await menuOn("folder", "Romani");
await chooseInMenu("New project");
await until(`!!document.querySelector(".window")`);
check("a folder's New project goes in that folder", (await page.run(`document.querySelector(".window select")?.value ?? ""`)) === `${LIBRARY}\\Romani`, await page.run(`document.querySelector(".window select")?.value ?? ""`));
await page.type("Kratke zgodbe");
await pick("A folder of files");
await answer(`${WRITING}\\Zgodbe`);
await press("Choose a folder…");
await until(`!!document.querySelector(".window .chosen")`);
check("a name she typed stays when she chooses a folder", (await nameField()) === "Kratke zgodbe", await nameField());
check("each file its own writing is the first choice", await page.run(`document.querySelector(".window input[type=radio][value=writing]")?.checked === true`));
await press("Create");
// The title bar names the open writing: a project of several opens on the first.
check("it opens on its first writing", await opened("1 Prva"), await projectTitle());
await sleep(500);
const EACH = `${LIBRARY}\\Romani\\Kratke zgodbe\\pensieve.db`;
check("each file its own writing, in order, in the folder asked for", JSON.stringify(await writings(EACH)) === JSON.stringify(["1 Prva", "Druga", "10 Deseta"]), JSON.stringify(await writings(EACH)));

// A folder with none of her files, and a taken name: said in the window, which stays; Escape closes it.
const projectsBefore = await page.run(`window.__PV_HARNESS__.books.size`);
await page.click(".sidebar-head .add");
await chooseInMenu("New project");
await until(`!!document.querySelector(".window")`);
await pick("A folder of files");
await answer("C:\\Users\\Eva");
await press("Choose a folder…");
await until(`!!document.querySelector(".window .more .problem")`);
check(
  "a folder without Word, text or Markdown files says so, and Create waits",
  (await page.run(`document.querySelector(".window .more .problem")?.textContent.trim()`)) === "This folder has no Word, text or Markdown files." &&
    (await page.run(`document.querySelector(".window footer .primary").disabled`)),
);
await pick("An empty page");
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
await pick("Mapa z datotekami");
await answer(`${WRITING}\\Zgodbe`);
await press("Izberi mapo …");
await until(`!!document.querySelector(".window .chosen")`);
const words = await page.run(`({
  title: document.querySelector(".window header span")?.textContent.trim(),
  labels: [...document.querySelectorAll(".window .field, .window legend")].map((el) => el.firstChild?.textContent.trim()),
  choices: [...document.querySelectorAll(".window .choice")].map((el) => el.textContent.trim()),
  chosen: document.querySelector(".window .chosen")?.textContent.trim(),
  buttons: [...document.querySelectorAll(".window footer button")].map((el) => el.textContent.trim()),
})`);
check(
  "in Slovenian: Nov projekt, Ime, Kam, Začetek, its choices and buttons",
  words.title === "Nov projekt" &&
    JSON.stringify(words.labels) === JSON.stringify(["Ime", "Kam", "Začetek"]) &&
    JSON.stringify(words.choices) === JSON.stringify(["Prazna stran", "Datoteka", "Mapa z datotekami", "Vsaka datoteka svoje besedilo", "Ena knjiga, vsaka datoteka svoje poglavje"]) &&
    words.chosen === "Zgodbe · 3 datoteke" &&
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
