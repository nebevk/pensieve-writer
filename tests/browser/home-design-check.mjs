// Checks Home as the owner drew it on 13 October: a small still mark in the window bar and the search as a
// field with its shortcut; the large mark, moving, beside a greeting of two lines, the chapter waiting in
// the accent; the Continue card with the sound on it; the projects as a table (Ime, Besede, Urejeno),
// what each holds, the open one marked, chapters in Roman, a "⋯" with the row's menu; the tree beside the
// page as before. Usage: node --experimental-websocket home-design-check.mjs [port]
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
const rowText = (selector) => page.run(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((row) => [...row.children].map((cell) => cell.textContent.trim()).filter(Boolean).join(" | "))`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .right")`);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "Splošno");
await sleep(300);
await page.clickText(".window button", "Dodaj primere knjig");
await sleep(2500);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);

// The window bar.
const brand = await page.run(`(() => { const img = document.querySelector(".home-header .brand img"); return { width: img?.width, src: img?.getAttribute("src"), name: document.querySelector(".home-header .brand .name")?.textContent }; })()`);
check("the window bar's mark is small and still, with the name", brand.width === 22 && !brand.src.includes("anim") && brand.name === "Pensieve", JSON.stringify(brand));
const field = await page.run(`({ label: document.querySelector(".home-header .find .label")?.textContent.trim(), keys: document.querySelector(".home-header .find kbd")?.textContent.trim() })`);
check("the search is a field with its shortcut", field.label === "Išči po vsem" && field.keys === "Ctrl ⇧ F", JSON.stringify(field));

// The large mark and the greeting.
const hero = await page.run(`(() => { const img = document.querySelector(".home .hero .glow img"); return { width: img?.width, src: img?.getAttribute("src") }; })()`);
check("Home's large mark is beside the verse, and moves", hero.width === 136 && hero.src.includes("pensieve-mark-anim-"), JSON.stringify(hero));
// Writing in the second chapter makes it the one waiting.
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
const chapters = await page.run(`[...document.querySelectorAll(".sidebar .tree-row.chapter, .sidebar .chapters .tree-row")].map((el) => el.textContent.trim())`);
await page.run(`[...document.querySelectorAll(".sidebar .tree-row")].find((el) => el.textContent.includes("Poglavje 1"))?.click(), true`);
await sleep(800);
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.type("Reka je tekla mimo mlina.");
await sleep(500);
check("(the tree beside the page is the tree, not the table)", (await page.run(`!document.querySelector(".sidebar .library.table") && !document.querySelector(".sidebar .table-head")`)), JSON.stringify(chapters));
await page.click(".titlebar .mark");
await until(`!!document.querySelector(".home .right")`);
await sleep(400);
// Since the owner's word of 13 October: the verse first and large beside the mark, then the greeting small,
// with a few words of encouragement where the chapter waiting was.
const top = await page.run(`(() => { const verse = document.querySelector(".home .hero .verse p"); const h1 = document.querySelector(".home h1.greeting"); return { verse: verse?.textContent, verseSize: parseFloat(getComputedStyle(verse).fontSize), hello: h1?.querySelector("strong")?.textContent, rest: h1?.textContent.replace(h1.querySelector("strong").textContent, "").trim(), greetingSize: parseFloat(getComputedStyle(h1).fontSize), order: verse.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING }; })()`);
check("the verse comes first, large, beside the mark", top.verse.length > 10 && top.verseSize >= 23 && top.order > 0, `${top.verse} ${top.verseSize}px`);
check("then the greeting, small, with words of encouragement, not the chapter waiting", /^(Dober dan|Dober večer|Dobro jutro|Spet pozno), Eva\.$/.test(top.hello) && top.rest.length > 8 && !top.rest.includes("čaka") && top.greetingSize <= 18, JSON.stringify(top));
const edges = await page.run(`(() => { const left = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().left); const img = document.querySelector(".home .hero .glow img").getBoundingClientRect(); return { verse: left(".home .hero .verse p"), greeting: left(".home .hero h1.greeting"), basin: Math.round(img.left + img.width * 0.13), column: left(".home .left") }; })()`);
check("the greeting lines up with the verse, and the mark's basin with the column", edges.verse === edges.greeting && Math.abs(edges.basin - edges.column) <= 1, JSON.stringify(edges));

// The Continue card.
const card = await page.run(`({ running: [...document.querySelectorAll(".home .sheet .running span")].map((el) => el.textContent.trim()), line: document.querySelector(".home .sheet .excerpt")?.textContent.trim(), sound: document.querySelector(".home .sheet .foot .sound")?.textContent.replace(/\\s+/g, " ").trim() })`);
check("the card: the writing and its chapter, when it was written in", JSON.stringify(card.running) === JSON.stringify(["Brez naslova · Pogl. II", "Urejeno pravkar"]), JSON.stringify(card.running));
check("her last line, and the sound on the card", card.line === "Reka je tekla mimo mlina." && card.sound === "Ko začnete pisati, je tiho · Spremeni", JSON.stringify(card));

// The projects as a table.
await page.run(`[...document.querySelectorAll(".home .right .switch button")].find((el) => el.textContent.includes("Seznam")).click(), true`);
await until(`!!document.querySelector(".home .library.table")`);
await sleep(500);
check("List is a table naming its columns", JSON.stringify(await page.run(`[...document.querySelectorAll(".home .table-head span")].map((el) => el.textContent.trim())`)) === JSON.stringify(["Ime", "Besede", "Urejeno"]));
const table = await rowText(".home .library.table .tree-row");
console.log(table.join("\n"));
check("a folder says how many projects it holds", table.some((row) => row.startsWith("Primeri | 2 projekta")), table[0]);
check("a project: its writings, its words, when it was written in", table.some((row) => /^The Lantern series \| 2 besedili \| [\d.]+ \| Pravkar$/.test(row)));
check("the open one is marked open", table.some((row) => /^Moj prvi projekt \| Odprto \| 1 besedilo \| [\d.]+ \| Pravkar$/.test(row)), table.find((row) => row.startsWith("Moj prvi")));
check("its writing, with its chapters", table.some((row) => /^Brez naslova \| 2 poglavji \| [\d.]+ \| Pravkar$/.test(row)));
check("the chapters in Roman, each with its words and when", table.some((row) => /^I \| Dobrodošli \| [\d.]+ \| Pravkar$/.test(row)) && table.some((row) => /^II \| Poglavje 1 \| 5 \| Pravkar$/.test(row)), JSON.stringify(table.filter((row) => /^I+ /.test(row))));
check("the notes and to-dos, counted", table.includes("Zapiski | 0 zapiskov") && table.includes("Opravila | 0 odprtih"), JSON.stringify(table.slice(-2)));
check("the chapter waiting is lit", (await page.run(`document.querySelector(".home .library.table .tree-row.latest")?.textContent`)).includes("Poglavje 1"));
const columns = await page.run(`(() => { const right = new Set([...document.querySelectorAll(".home .library.table .col-words")].map((el) => Math.round(el.getBoundingClientRect().right))); const left = new Set([...document.querySelectorAll(".home .library.table .col-edited")].map((el) => Math.round(el.getBoundingClientRect().left))); const plus = new Set([...document.querySelectorAll(".home .library.table .row-add:not(.row-more)")].map((el) => Math.round(el.getBoundingClientRect().right))); return { right: [...right], left: [...left], plus: [...plus] }; })()`);
check("the columns line up, the header's too, and every +", columns.right.length === 1 && columns.left.length === 1 && columns.plus.length === 1, JSON.stringify(columns));
await page.shoot(`${shots}home-design.png`);

// The "⋯": the row's menu.
const lantern = await page.run(`(() => { const row = [...document.querySelectorAll(".home .library.table .with-add")].find((el) => el.textContent.includes("The Lantern series")); const more = row.querySelector(".row-more"); return { hidden: getComputedStyle(more).opacity, label: more.getAttribute("aria-label") }; })()`);
check("a row's ⋯ waits for the pointer", lantern.hidden === "0" && lantern.label === "Več: The Lantern series", JSON.stringify(lantern));
await page.run(`[...document.querySelectorAll(".home .library.table .with-add")].find((el) => el.textContent.includes("The Lantern series")).querySelector(".row-more").click(), true`);
check("and opens the row's menu", await until(`[...document.querySelectorAll(".tree-menu button, [role=menu] button, [role=menuitem]")].some((el) => el.textContent.includes("Odpri"))`, 20));
await page.key("Escape", "Escape", 27);
await sleep(300);

// Grid is as it was.
await page.run(`[...document.querySelectorAll(".home .right .switch button")].find((el) => el.textContent.includes("Mreža")).click(), true`);
check("Grid shows the cards again", (await until(`document.querySelectorAll(".home .grid .card.project").length >= 3`)) && !(await page.run(`!!document.querySelector(".home .library.table")`)));

// In Gentle mode the large mark is still.
await page.run(`(() => { const prefs = JSON.parse(localStorage.getItem("pensieve-prefs")); prefs.gentle = true; localStorage.setItem("pensieve-prefs", JSON.stringify(prefs)); return true; })()`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .hero")`);
check("in Gentle mode the large mark is still", !(await page.run(`document.querySelector(".home .hero .glow img")?.getAttribute("src")`)).includes("anim"));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
