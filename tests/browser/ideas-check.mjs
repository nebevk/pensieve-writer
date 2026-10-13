// Checks the Ideas tab (owner, 13 October): Home no longer has an Ideas box; the tab lists the project's
// ideas as cards, newest first, with one open beside them to write in; New idea and Ctrl+Shift+N make one
// there; [[links]] between ideas show both ways; search finds them; All projects adds every other project's
// ideas, only to read, one opening in its own project; Open in Notes; delete asks first; all of it kept.
// Usage: node --experimental-websocket ideas-check.mjs [port]
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
const cards = () => page.run(`[...document.querySelectorAll(".ideas-view .card .title")].map((el) => el.textContent.trim())`);
const openTitle = () => page.run(`(document.querySelector(".ideas-view aside.idea input.title")?.value ?? document.querySelector(".ideas-view aside.idea h2.title")?.textContent ?? "").trim()`);
const linked = () => page.run(`[...document.querySelectorAll(".ideas-view aside.idea .linked button")].map((el) => el.textContent.trim())`);
const nameIdea = async (name) => {
  await until(`document.activeElement?.matches(".ideas-view aside.idea input.title")`);
  await page.type(name);
};
const writeIdea = async (text) => {
  await page.run(`(() => { const editor = document.querySelector(".ideas-view aside.idea .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.type(text);
  await sleep(300);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .right")`);
check("Home has no Ideas box any more", !(await page.run(`!!document.querySelector(".home .ideas, .home .capture")`)));
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);

// The tab, after Notes.
await page.click(".home .continue .go");
await until(`!!document.querySelector(".titlebar [role=tab]")`);
const tabs = await page.run(`[...document.querySelectorAll(".titlebar [role=tab]")].map((el) => el.textContent.trim())`);
check("the title bar has an Ideas tab after Notes", JSON.stringify(tabs) === JSON.stringify(["Write", "Outline", "Book", "Notes", "Ideas"]), JSON.stringify(tabs));
await page.clickText(".titlebar [role=tab]", "Ideas");
await until(`!!document.querySelector(".ideas-view")`);
await sleep(500);
check("it opens on this project's ideas, none yet", (await page.run(`document.querySelector(".ideas-view .empty-state p")?.textContent.trim()`)) === "No ideas yet. Even the smallest one is worth keeping.");

// New idea: a card, open beside with its name ready to be typed over.
await page.clickText(".ideas-view .new", "New idea");
await nameIdea("Stara hiša");
await writeIdea("Ob reki stoji. Zgradila jo je [[Čarovnica]].");
check("New idea makes a card and opens it beside, its name typed over", JSON.stringify(await cards()) === JSON.stringify(["Stara hiša"]) && (await openTitle()) === "Stara hiša", JSON.stringify(await cards()));
await page.run(`document.activeElement?.blur(), true`);
await page.key("N", "KeyN", 78, CTRL_SHIFT);
check("Ctrl+Shift+N in the tab makes the new idea right there, no window", (await until(`document.activeElement?.matches(".ideas-view aside.idea input.title")`)) && !(await page.run(`!!document.querySelector(".window")`)));
await page.type("Čarovnica");
await writeIdea("Živi pri mlinu.");
await sleep(400);
check("the newest first", JSON.stringify(await cards()) === JSON.stringify(["Čarovnica", "Stara hiša"]), JSON.stringify(await cards()));
check("a [[link]] shows on the idea it comes to", JSON.stringify(await linked()) === JSON.stringify(["← Stara hiša"]), JSON.stringify(await linked()));
await page.run(`[...document.querySelectorAll(".ideas-view .card")].find((card) => card.querySelector(".title").textContent.trim() === "Stara hiša").click(), true`);
await sleep(300);
check("and on the idea it goes from, with the count on its card", JSON.stringify(await linked()) === JSON.stringify(["→ Čarovnica"]) && (await page.run(`[...document.querySelectorAll(".ideas-view .card")].find((card) => card.querySelector(".title").textContent.trim() === "Stara hiša").querySelector(".links")?.textContent.trim()`)) === "· → 1", JSON.stringify(await linked()));
await page.shoot(`${shots}ideas-tab.png`);

// Search.
await page.run(`(() => { const input = document.querySelector(".ideas-view .search input"); input.value = "mlin"; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await sleep(200);
check("search finds an idea by its words", JSON.stringify(await cards()) === JSON.stringify(["Čarovnica"]), JSON.stringify(await cards()));
await page.run(`(() => { const input = document.querySelector(".ideas-view .search input"); input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);

// All projects: another project's idea, only to read; opened in its project to write.
await page.clickText(".ideas-view .switch button", "All projects");
await until(`[...document.querySelectorAll(".ideas-view .card .title")].some((el) => el.textContent.trim() === "The ferryman")`, 120);
const ferryCard = await page.run(`(() => { const card = [...document.querySelectorAll(".ideas-view .card")].find((el) => el.querySelector(".title").textContent.trim() === "The ferryman"); return card?.querySelector(".project")?.textContent.trim(); })()`);
check("All projects adds every other project's ideas, named by project", ferryCard === "The Lantern series", ferryCard);
check("no other project's file is held open", JSON.stringify(await page.run(`[...window.__PV_HARNESS__.openPools]`)).split("pensieve.db").length - 1 === 1, JSON.stringify(await page.run(`[...window.__PV_HARNESS__.openPools]`)));
await page.run(`[...document.querySelectorAll(".ideas-view .card")].find((el) => el.querySelector(".title").textContent.trim() === "The ferryman").click(), true`);
await sleep(300);
check("another project's idea opens to read, with Open in its project", (await openTitle()) === "The ferryman" && !(await page.run(`!!document.querySelector(".ideas-view aside.idea .ProseMirror")`)) && (await page.run(`!!document.querySelector(".ideas-view aside.idea footer .primary")`)));
await page.shoot(`${shots}ideas-all.png`);
await page.clickText(".ideas-view aside.idea footer button", "Open in its project");
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === "The Lantern House" || (document.querySelector(".titlebar .project")?.textContent ?? "").trim() === "Why I write by hand first"`, 120);
check("Open in its project opens that project, the Ideas tab and the idea, to write", (await until(`!!document.querySelector(".ideas-view aside.idea input.title")`, 80)) && (await openTitle()) === "The ferryman" && (await page.run(`document.querySelector(".titlebar [role=tab][aria-selected=true]")?.textContent.trim()`)) === "Ideas", await openTitle());

// Back in the first project: Open in Notes, and delete.
await page.clickText(".ideas-view .switch button", "All projects");
await until(`[...document.querySelectorAll(".ideas-view .card .title")].some((el) => el.textContent.trim() === "Stara hiša")`, 120);
await page.run(`[...document.querySelectorAll(".ideas-view .card")].find((el) => el.querySelector(".title").textContent.trim() === "Stara hiša").click(), true`);
await page.clickText(".ideas-view aside.idea footer button", "Open in its project");
await until(`!!document.querySelector(".ideas-view aside.idea input.title") && document.querySelector(".ideas-view aside.idea input.title").value === "Stara hiša"`, 120);
await page.clickText(".ideas-view aside.idea footer button", "Open in Notes");
check("Open in Notes shows it in Notes", await until(`document.querySelector(".titlebar [role=tab][aria-selected=true]")?.textContent.trim() === "Notes" && document.body.innerText.includes("Stara hiša")`, 60));
await page.clickText(".titlebar [role=tab]", "Ideas");
await until(`!!document.querySelector(".ideas-view .card")`);
await page.run(`[...document.querySelectorAll(".ideas-view .card")].find((el) => el.querySelector(".title").textContent.trim() === "Čarovnica").click(), true`);
await sleep(300);
await page.clickText(".ideas-view aside.idea footer button", "Delete");
check("delete asks first", await until(`!!document.querySelector(".ideas-view aside.idea footer .say")`, 10));
await page.clickText(".ideas-view aside.idea footer button", "Delete");
await sleep(500);
check("and then deletes", JSON.stringify(await cards()) === JSON.stringify(["Stara hiša"]), JSON.stringify(await cards()));

// Kept.
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".titlebar [role=tab]")`);
await page.clickText(".titlebar [role=tab]", "Ideas");
await until(`!!document.querySelector(".ideas-view .card")`);
check("the ideas are kept", JSON.stringify(await cards()) === JSON.stringify(["Stara hiša"]), JSON.stringify(await cards()));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
