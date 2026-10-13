// Checks the search across every project (owner, 12 October; find's list since 13 October): Home's Search
// everything and Ctrl+Shift+F away from Write open its window; it reads every project (what she has just
// typed included), lists every place project by project with the words shown, and lets go of every other
// project's file; a chapter opens with find on the page at that match, a note opens beside the page; the
// arrow keys and Enter choose; in Write, Ctrl+Shift+F is find's own list through every project.
// Usage: node --experimental-websocket search-all-check.mjs [port]
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
const CTRL_SHIFT = 2 | 8;
const search = async (words) => {
  await until(`!!document.querySelector(".window .field input") && !document.querySelector(".window .status")?.textContent.includes("Reading")`, 120);
  await page.run(`(() => { const input = document.querySelector(".window .field input"); input.focus(); input.value = ${JSON.stringify(words)}; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await sleep(450);
};
const found = () =>
  page.run(`[...document.querySelectorAll(".window .results h3, .window .results .hit")].map((el) => el.tagName === "H3" ? "# " + el.querySelector(".name").textContent.trim() : el.querySelector(".where").textContent.trim() + " | " + el.querySelector("mark").textContent)`);
const title = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);
const goHome = async () => {
  await page.click(".titlebar .mark");
  await until(`!!document.querySelector(".home-header .find")`);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight", sidebarView: "library" })), true`);
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

// Words just typed in the open project are found, before autosave has had its turn.
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(700);
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Kolovratnik je prišel.");
await goHome();
await page.key("F", "KeyF", 70, CTRL_SHIFT);
check("Ctrl+Shift+F on Home opens the search across every project", (await until(`!!document.querySelector(".window .field input")`)) && (await page.run(`document.querySelector(".window header span")?.textContent.trim()`)) === "Search everything");
await search("kolovratnik");
check("what she has just typed is found, in the open project", JSON.stringify(await found()) === JSON.stringify(["# My first project", "Untitled · ch. 1 | Kolovratnik"]), JSON.stringify(await found()));
check("the open project is marked", (await page.run(`document.querySelector(".window .results h3 .open")?.textContent.trim()`)) === "Open");
await page.key("Escape", "Escape", 27);
check("Escape closes it", await until(`!document.querySelector(".window")`));

// From Home's button: a word in another project's chapter.
await page.click(".home-header .find");
await until(`!!document.querySelector(".window .field input")`);
await search("notary");
const notary = await found();
check("a word in another project's chapter: that project, the writing and its chapter, the words shown", JSON.stringify(notary) === JSON.stringify(["# The Lantern series", "The Lantern House · ch. 1 | notary"]), JSON.stringify(notary));
check("with the words around it", (await page.run(`document.querySelector(".window .results .hit .text")?.textContent`)).includes("It was from a notary in Krško"));
check("it says how many and where", (await page.run(`document.querySelector(".window .status")?.textContent.trim()`)) === "1 match in 1 project");
await page.shoot(`${shots}search-all.png`);
check("no other project's file is held open while she searches", JSON.stringify(await page.run(`[...window.__PV_HARNESS__.openPools]`)).split("pensieve.db").length - 1 === 1, JSON.stringify(await page.run(`[...window.__PV_HARNESS__.openPools]`)));
await page.run(`document.querySelector(".window .results .hit").click(), true`);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === "The Lantern House"`, 120);
check(
  "a chapter opens in Write, in its project, with find on the page at those words",
  (await until(`document.querySelector(".paper .pv-find-current")?.textContent.toLowerCase() === "notary"`, 80)) && (await page.run(`document.querySelector(".find-panel .field input")?.value`)) === "notary",
  await title(),
);

// A note in another project opens beside the page.
await page.key("Escape", "Escape", 27);
await goHome();
await page.key("F", "KeyF", 70, CTRL_SHIFT);
await until(`!!document.querySelector(".window .field input")`);
await search("ferryman");
const ferry = await found();
check("notes are searched too, by name and text", ferry.includes("Notes · The ferryman | ferryman"), JSON.stringify(ferry));
const index = await page.run(`[...document.querySelectorAll(".window .results .hit")].findIndex((el) => el.querySelector(".where").textContent.trim() === "Notes · The ferryman")`);
for (let step = 0; step < index; step += 1) await page.key("ArrowDown", "ArrowDown", 40);
check("the arrow keys move along the places", (await page.run(`document.querySelector(".window .results .hit.chosen .where")?.textContent.trim()`)) === "Notes · The ferryman");
await page.key("Enter", "Enter", 13);
check("Enter opens the chosen one: a note, beside the page", await until(`document.querySelector("aside.pane input.title")?.value === "The ferryman"`, 80));
check("a note doesn't open find on the page", !(await page.run(`!!document.querySelector(".find-panel")`)));

// Čšž kept apart, as Find does.
await goHome();
await page.key("F", "KeyF", 70, CTRL_SHIFT);
await until(`!!document.querySelector(".window .field input")`);
await search("Krško");
check("č, š and ž are found", (await found()).some((row) => row.endsWith("| Krško")));
await search("krsko");
check("and told apart from c, s and z, as Find does", (await page.run(`document.querySelector(".window .status")?.textContent.trim()`)) === "Nothing found.");
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);

// In Write, Ctrl+Shift+F is find's list through every project, not the window.
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await page.key("F", "KeyF", 70, CTRL_SHIFT);
check("in Write, Ctrl+Shift+F opens find's list through every project", (await until(`!!document.querySelector(".find-panel.listed")`)) && !(await page.run(`!!document.querySelector(".window")`)));
await page.key("Escape", "Escape", 27);

await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button", "Shortcuts");
await sleep(300);
check("Settings lists Ctrl+Shift+F", await page.run(`document.querySelector(".window .keys")?.textContent.includes("Search everything")`));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
