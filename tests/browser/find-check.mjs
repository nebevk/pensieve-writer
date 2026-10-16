// Checks Find (owner, 13 October): Ctrl+F opens it under the toolbar's lit Find; every match on the page is
// marked, the one she is at counted ("2 of 4") and selected; Enter, Shift+Enter and the arrows go round;
// Aa and ab; Ctrl+H's Replace and All, All taken back by one Ctrl+Z; This project and All projects list
// the places project by project, a place opening on that very match; This project's All replaces in
// every writing; the selection bar's Find lists the project; Escape closes it, marks and all.
// Usage: node --experimental-websocket find-check.mjs [port]
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
const CTRL = 2;
const SHIFT = 8;
const panel = () => page.run(`!!document.querySelector(".find-panel")`);
const counter = () => page.run(`document.querySelector(".find-panel .counter")?.textContent.trim() ?? ""`);
const marks = () => page.run(`[...document.querySelectorAll(".paper .pv-find")].map((el) => el.textContent)`);
const current = () => page.run(`[...document.querySelectorAll(".paper .pv-find-current")].map((el) => el.textContent).join("")`);
const pageText = () => page.run(`document.querySelector(".paper .ProseMirror")?.textContent ?? ""`);
const typeIn = async (selector, words) => {
  await page.run(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.focus(); input.select(); return true; })()`);
  await page.type(words);
};
const rows = () => page.run(`[...document.querySelectorAll(".find-panel .results h3, .find-panel .results .hit")].map((el) => el.tagName === "H3" ? "# " + el.querySelector(".name").textContent.trim() + " " + el.querySelector(".count").textContent.trim() : el.querySelector(".where").textContent.trim() + " | " + el.querySelector("mark").textContent)`);
const findButton = () => page.run(`(() => { const button = [...document.querySelectorAll(".ribbon button")].find((el) => el.getAttribute("aria-label") === "Find" || el.textContent.trim() === "Find"); return button ? button.getAttribute("aria-pressed") : "missing"; })()`);
const listed = (word) => until(`[...document.querySelectorAll(".find-panel .results .hit mark")].some((el) => el.textContent.toLowerCase() === ${JSON.stringify(word)})`, 120);
const title = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .right")`);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Reka je tekla. Ob reki je mlin. REKA je velika. Rekač ni reka.");
await page.key("Enter", "Enter", 13);
await sleep(600);
check("Find in the toolbar has its name, and isn't lit yet", (await findButton()) === "false", await findButton());

// Ctrl+F: the box under the toolbar, every match marked, the first counted and selected.
await page.key("f", "KeyF", 70, CTRL);
check("Ctrl+F opens find, the keyboard in its field", (await until(`!!document.querySelector(".find-panel")`)) && (await until(`!!document.activeElement?.closest(".find-panel .field")`)));
check("and lights Find in the toolbar", (await findButton()) === "true", await findButton());
await page.type("reka");
await until(`document.querySelectorAll(".paper .pv-find").length === 4`, 40);
check("every match on the page is marked, in any case, words partly the same too", JSON.stringify(await marks()) === JSON.stringify(["Reka", "REKA", "Reka", "reka"]), JSON.stringify(await marks()));
check("the first is the one she is at, counted", (await counter()) === "1 of 4" && (await current()) === "Reka", `${await counter()} ${await current()}`);
await page.shoot(`${shots}find-chapter.png`, { x: 300, y: 0, width: 1066, height: 420 });
await page.key("Enter", "Enter", 13);
check("Enter goes to the next", (await counter()) === "2 of 4" && (await current()) === "REKA", `${await counter()} ${await current()}`);
await page.key("Enter", "Enter", 13, SHIFT);
check("Shift+Enter to the one before", (await counter()) === "1 of 4", await counter());
await page.key("Enter", "Enter", 13, SHIFT);
check("round the page from the first to the last", (await counter()) === "4 of 4" && (await current()) === "reka", `${await counter()} ${await current()}`);
await page.run(`document.querySelector('.find-panel button[aria-label="Next (Enter)"]').click(), true`);
check("the arrows go round too", (await counter()) === "1 of 4", await counter());
check("the keyboard stays in find's field", await page.run(`!!document.activeElement?.closest(".find-panel .field")`));

// Aa and ab.
await page.run(`document.querySelector('.find-panel button[aria-label="Match case"]').click(), true`);
await until(`document.querySelectorAll(".paper .pv-find").length === 1`, 30);
check("Aa: the capitals as typed", (await counter()) === "1 of 1" && JSON.stringify(await marks()) === JSON.stringify(["reka"]), `${await counter()} ${JSON.stringify(await marks())}`);
await page.run(`document.querySelector('.find-panel button[aria-label="Match case"]').click(), document.querySelector('.find-panel button[aria-label="Whole words only"]').click(), true`);
await until(`document.querySelectorAll(".paper .pv-find").length === 3`, 30);
check("ab: whole words only", JSON.stringify(await marks()) === JSON.stringify(["Reka", "REKA", "reka"]), JSON.stringify(await marks()));
await page.run(`document.querySelector('.find-panel button[aria-label="Whole words only"]').click(), true`);
await until(`document.querySelectorAll(".paper .pv-find").length === 4`, 30);

// Replace: Ctrl+H shows it; Replace takes the one she is at, All the rest, and one Ctrl+Z takes All back.
await page.key("h", "KeyH", 72, CTRL);
check("Ctrl+H shows Replace", await until(`!!document.querySelector(".find-panel .replace input")`, 20));
await typeIn(".find-panel .replace input", "potok");
const before = await current();
await page.clickText(".find-panel .replace button", "Replace");
await sleep(200);
check("Replace changes the one she is at and goes on round the page", (await counter()) === "1 of 3" && (await pageText()).includes("Rekač ni potok.") && before === "reka", `${await counter()} ${before}`);
await page.clickText(".find-panel .replace button", "All");
await sleep(300);
check("All changes the rest, and says how many", (await pageText()).includes("potok je tekla. Ob reki je mlin. potok je velika. potokč ni potok.") && (await page.run(`document.querySelector(".find-panel .status")?.textContent.trim()`)) === "Replaced: 3", await page.run(`document.querySelector(".find-panel .status")?.textContent.trim()`));
check("nothing left to find says so", (await counter()) === "No matches", await counter());
await page.key("Escape", "Escape", 27);
const closed = await until(`!document.querySelector(".find-panel")`);
const left = (await marks()).length;
const keyboard = await page.run(`document.activeElement?.closest(".paper .ProseMirror") ? "page" : document.activeElement?.outerHTML.slice(0, 80)`);
check("Escape closes find, its marks with it, and the page has the keyboard", closed && left === 0 && keyboard === "page", JSON.stringify({ closed, marks: left, keyboard }));
check("Find in the toolbar isn't lit any more", (await findButton()) === "false", await findButton());
await page.key("z", "KeyZ", 90, CTRL);
await sleep(300);
check("one Ctrl+Z takes All back", (await pageText()).includes("Reka je tekla. Ob reki je mlin. REKA je velika. Rekač ni potok."), (await pageText()).slice(-80));

// All projects: the places project by project; one opens on that very match.
await page.key("f", "KeyF", 70, CTRL | SHIFT);
check("Ctrl+Shift+F in Write opens find through every project", (await until(`!!document.querySelector(".find-panel.listed")`)) && (await page.run(`document.querySelector('.find-panel [role=radio][aria-checked=true]')?.textContent.trim()`)) === "All projects");
await page.run(`(() => { const input = document.querySelector(".find-panel .field input"); input.focus(); input.select(); return true; })()`);
await page.type("notary");
await listed("notary");
check("a place in another project: the project, the writing and chapter, the words in their sentence", JSON.stringify(await rows()) === JSON.stringify(["# The Lantern series 1", "The Lantern House · ch. 1 | notary"]), JSON.stringify(await rows()));
check("it says how many and where", (await counter()) === "1 in 1 project", await counter());
check("the keys are told at the foot", (await page.run(`document.querySelector(".find-panel .keys")?.textContent.replace(/\\s+/g, " ").trim()`)) === "↑↓ move Enter open Esc close");
check("no other project's file is held open", JSON.stringify(await page.run(`[...window.__PV_HARNESS__.openPools]`)).split("pensieve.db").length - 1 === 1);
await page.run(`(() => { const input = document.querySelector(".find-panel .field input"); input.select(); return true; })()`);
await page.type("the");
await listed("the");
const groups = await page.run(`[...document.querySelectorAll(".find-panel .results .group")].map((group) => group.querySelectorAll(".hit").length)`);
check("each project shows its first two places", groups.length >= 2 && groups.every((count) => count <= 2), JSON.stringify(groups));
await page.shoot(`${shots}find-all.png`, { x: 680, y: 0, width: 686, height: 768 });
const shownBefore = await page.run(`document.querySelectorAll(".find-panel .results .group")[0].querySelectorAll(".hit").length`);
await page.run(`document.querySelector(".find-panel .results .more").click(), true`);
await sleep(200);
check("its more opens more of them", (await page.run(`document.querySelectorAll(".find-panel .results .group")[0].querySelectorAll(".hit").length`)) > shownBefore);
await page.key("ArrowDown", "ArrowDown", 40);
check("the arrow keys move along the places", (await page.run(`[...document.querySelectorAll(".find-panel .results .hit")].findIndex((el) => el.classList.contains("chosen"))`)) === 1);
await page.run(`(() => { const input = document.querySelector(".find-panel .field input"); input.select(); return true; })()`);
await page.type("notary");
await until(`document.querySelectorAll(".find-panel .results .hit").length === 1`, 60);
await listed("notary");
await page.key("Enter", "Enter", 13);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === "The Lantern House"`, 120);
check(
  "Enter opens it: that project, that chapter, find on the page at that match",
  (await until(`document.querySelector(".paper .pv-find-current")?.textContent.toLowerCase() === "notary"`, 80)) && (await counter()) === "1 of 1" && !(await page.run(`!!document.querySelector(".find-panel.listed")`)),
  `${await title()} ${await counter()}`,
);

// This project: both of its writings; its All replaces in each, the names left as they are.
await page.clickText(".find-panel [role=radio]", "This project");
await page.run(`(() => { const input = document.querySelector(".find-panel .field input"); input.focus(); input.select(); return true; })()`);
await page.run(`document.querySelector('.find-panel button[aria-label="Whole words only"]').click(), true`);
await page.type("the");
await listed("the");
const lantern = await rows();
check("This project lists the project's places, all of them", lantern[0].startsWith("# The Lantern series") && lantern.length > 20, String(lantern.length));
const writings = new Set(lantern.filter((row) => !row.startsWith("#")).map((row) => row.split(" · ")[0]));
check("from every writing in it", writings.size >= 2, JSON.stringify([...writings]));
await page.run(`document.querySelector('.find-panel .replace-toggle').click(), true`);
await until(`!!document.querySelector(".find-panel .replace input")`, 20);
check("Replace there says what it changes", (await page.run(`document.querySelector(".find-panel .hint")?.textContent`)).startsWith("Replaces in this project's writings") && (await page.run(`[...document.querySelectorAll(".find-panel .replace button")].map((el) => el.textContent.trim()).join()`)) === "All");
await typeIn(".find-panel .replace input", "Beacon");
await page.clickText(".find-panel .replace button", "All");
await until(`(document.querySelector(".find-panel .status")?.textContent ?? "").startsWith("Replaced:")`, 120);
const replaced = await page.run(`document.querySelector(".find-panel .status")?.textContent.trim()`);
check("All replaces through the project, and says how many", /^Replaced: \d+$/.test(replaced) && Number(replaced.split(": ")[1]) > 2, replaced);
await page.run(`(() => { const input = document.querySelector(".find-panel .field input"); input.focus(); input.select(); return true; })()`);
await page.type("beacon");
await listed("beacon");
const beacon = new Set((await rows()).filter((row) => !row.startsWith("#")).map((row) => row.split(" · ")[0]));
check("in every writing of it", beacon.size >= 2, JSON.stringify([...beacon]));
check("the open page has it too", (await pageText()).includes("Beacon"));
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".find-panel")`);

// The selection bar's Find lists the project.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT); for (let node = walker.nextNode(); node; node = walker.nextNode()) { const at = node.textContent.indexOf("Beacon"); if (at >= 0) { editor.focus(); const range = document.createRange(); range.setStart(node, at); range.setEnd(node, at + 6); getSelection().removeAllRanges(); getSelection().addRange(range); return true; } } return false; })()`);
await until(`!!document.querySelector('.selection-bar button[aria-label="Find in this project"], button[aria-label="Find in this project"]')`, 40);
await page.run(`document.querySelector('button[aria-label="Find in this project"]').click(), true`);
check("the selection bar's Find lists the project's places", (await until(`!!document.querySelector(".find-panel.listed")`, 40)) && (await page.run(`document.querySelector(".find-panel .field input").value`)) === "Beacon" && (await page.run(`document.querySelector('.find-panel [role=radio][aria-checked=true]')?.textContent.trim()`)) === "This project");
await page.run(`[...document.querySelectorAll(".ribbon button")].find((el) => el.getAttribute("aria-pressed") === "true" && (el.getAttribute("aria-label") === "Find" || el.textContent.trim() === "Find")).click(), true`);
check("Find in the toolbar closes it again", await until(`!document.querySelector(".find-panel")`, 20));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
