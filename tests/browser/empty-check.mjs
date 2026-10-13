// Checks the empty places (owner, 13 October): with nothing in them yet, Home's to-dos, the panel's notes
// and to-dos, Notes, To-dos and Ideas show the owner's picture for the look on now, its ground fading into
// the window, a kind line and, where it helps, the button that makes the first one. Home keeps its height
// at 1366 × 768. Usage: node empty-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1366, height: 768 });
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
// An empty place as she sees it: its line, its button, its picture (and whether that is there), its fade.
const empty = (within) =>
  page.run(`(async () => {
    const box = document.querySelector(${JSON.stringify(`${within} .empty-state`)});
    if (!box) return null;
    const art = getComputedStyle(box.querySelector(".art"));
    const url = art.backgroundImage.match(/url\\("?([^")]+)"?\\)/)?.[1] ?? "";
    return {
      text: box.querySelector("p")?.textContent.trim() ?? "",
      button: box.querySelector("button")?.textContent.trim() ?? "",
      art: url.replace(/^.*\\/art\\/empty\\//, ""),
      there: url ? (await fetch(url)).status : 0,
      fades: (art.maskImage || art.webkitMaskImage || "").includes("radial-gradient"),
      width: Math.round(box.querySelector(".art").getBoundingClientRect().width),
    };
  })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(800);

// Home: the picture beside the words, and Home still fits the laptop's screen.
let info = await empty(".home .todos");
check("Home's to-dos: the picture beside a kind line", info?.text === "Nothing left to do. The page is all yours." && info.art === "empty-tasks-daylight.svg" && info.there === 200 && info.fades && info.width === 78, JSON.stringify(info));
const fits = await page.run(`(() => { const home = document.querySelector("section.home"); return { scroll: home.scrollHeight, room: home.clientHeight }; })()`);
check("Home still fits at 1366 × 768", fits.scroll <= fits.room, JSON.stringify(fits));
await page.shoot(`${shots}empty-home.png`);

// The panel beside the page.
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
await page.click('.ribbon button[title="Notes panel"]');
await until(`!!document.querySelector("aside.panel .empty-state")`);
info = await empty("aside.panel");
check("the panel's notes: a small picture and the line", info?.text === "No notes yet." && info.art === "empty-notes-daylight.svg" && info.there === 200 && info.width === 160, JSON.stringify(info));
await page.click('.ribbon button[title="To-dos panel"]');
await sleep(500);
info = await empty("aside.panel");
check("the panel's to-dos too", info?.text === "No to-dos yet. Add the first one above." && info.art === "empty-tasks-daylight.svg", JSON.stringify(info));

// Notes: its button makes the first note.
await page.clickText(".titlebar [role=tab]", "Notes");
await until(`!!document.querySelector(".notes .empty-state")`);
info = await empty(".notes");
check("Notes: the picture, a kind line and New note", info?.text === "No notes yet. Keep your characters, places and research here, close to the page." && info.button === "New note" && info.art === "empty-notes-daylight.svg" && info.width === 300, JSON.stringify(info));
await page.shoot(`${shots}empty-notes.png`);
await page.click(".notes .empty-state button");
check("New note makes the first one, and the picture goes", await until(`!!document.querySelector(".notes .card input.title") && !document.querySelector(".notes .empty-state")`));

// To-dos: the field above makes the first one.
await page.clickText("button", "To-dos");
await until(`!!document.querySelector(".board .empty-state")`);
info = await empty(".board");
check("To-dos: the picture and a kind line instead of three empty columns", info?.text === "Nothing to do yet. Write what comes next above, and tick it off when it's done." && info.art === "empty-tasks-daylight.svg" && !(await page.run(`!!document.querySelector(".board .columns")`)), JSON.stringify(info));
await page.run(`(() => { const input = document.querySelector(".board .quick input"); input.focus(); return true; })()`);
await page.type("Read the first chapter aloud");
await page.key("Enter", "Enter", 13);
check("the first to-do brings the columns back", await until(`!!document.querySelector(".board .columns") && !document.querySelector(".board .empty-state")`));

// Ideas, in Moonlit: its own pictures.
await page.run(`(document.documentElement.dataset.theme = "moonlit", true)`);
await page.clickText(".titlebar [role=tab]", "Ideas");
await until(`!!document.querySelector(".ideas-view .empty-state")`);
info = await empty(".ideas-view");
check("Ideas: the picture for the look on now, and New idea", info?.text === "No ideas yet. Even the smallest one is worth keeping." && info.button === "New idea" && info.art === "empty-notes-moonlit.svg" && info.there === 200, JSON.stringify(info));
await page.shoot(`${shots}empty-ideas-moonlit.png`);
await page.click(".ideas-view .empty-state button");
check("New idea makes the first one", await until(`!!document.querySelector(".ideas-view .card") && !document.querySelector(".ideas-view .empty-state")`));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
