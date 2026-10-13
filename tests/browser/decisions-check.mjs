// Checks the owner's 6 October decisions: Home's greeting names the chapter Continue opens (HOME-10),
// four view tabs (WIN-2), no chapter status (8 October). Usage: node decisions-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1500, height: 900 });
await page.harness();
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const greeting = () => page.run(`document.querySelector(".home h1.greeting")?.textContent.trim() ?? ""`);
const running = () => page.run(`document.querySelector(".home .sheet .running span")?.textContent.trim() ?? ""`);
const hello = /^(Good morning|Good afternoon|Good evening|Late again), Eva\./;
const toHome = async () => {
  await page.click(".mark");
  await until(`!!document.querySelector(".home .continue")`);
  await sleep(500);
};

// A new book opens on its welcome page: the greeting names no chapter, and a verse sits under it
// (the owner brought the verse back on 6 October).
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
const first = await greeting();
check("Home greets her with a few words of encouragement, never the chapter waiting (13 October)", hello.test(first) && first.replace(hello, "").trim().length > 8 && !first.includes("waiting"), first);
check("the verse comes first, beside the mark", await page.run(`(document.querySelector(".home .hero blockquote.verse")?.textContent.trim().length ?? 0) > 15`));

// The example novel: the greeting names the chapter Continue opens.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.clickText(".project", "The Lantern series");
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("letter")`);
await toHome();
const named = await greeting();
// The strip shows "1 The Letter": its number, then the title.
const current = (await page.run(`document.querySelector(".chapter-name.current")?.textContent.trim() ?? ""`)).replace(/^\d+\s+/, "");
check("the greeting still has no chapter in it; the Continue card names it", hello.test(named) && !named.includes("waiting") && (await running()) === "The Lantern House · Ch. I", `${named} | ${await running()} | ${JSON.stringify(current)}`);
await page.shoot(`${shots}home-greeting.png`, { x: 0, y: 60, width: 900, height: 260 });

// Four tabs; To-dos come through the Notes switch, and Notes stays lit.
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
const tabs = await page.run(`[...document.querySelectorAll(".titlebar [role=tab]")].map((tab) => tab.textContent.trim())`);
check("the title bar has the designed four tabs, and Ideas since 13 October", JSON.stringify(tabs) === JSON.stringify(["Write", "Outline", "Book", "Notes", "Ideas"]), tabs.join(" · "));
await page.clickText(".titlebar [role=tab]", "Notes");
await until(`!!document.querySelector(".search input")`);
await page.clickText("button", "To-dos");
await until(`!!document.querySelector(".desk") && (document.querySelector(".desk")?.innerText ?? "").includes("Decide which key opens the trunk")`);
const lit = await page.run(`[...document.querySelectorAll(".titlebar [role=tab][aria-selected=true]")].map((tab) => tab.textContent.trim())`);
check("To-dos open from the Notes switch, with Notes lit", lit.length === 1 && lit[0] === "Notes", lit.join(","));
await page.shoot(`${shots}tabs-todos.png`, { x: 0, y: 0, width: 1500, height: 120 });

// No chapter status for now (owner, 8 October): no dots or legend in the chapter list, no choice in the Outline.
await page.clickText("[role=tab]", "Write");
await until(`!!document.querySelector(".paper .ProseMirror")`);
const statusShown = await page.run(`({ legend: !!document.querySelector(".legend"), dots: document.querySelectorAll(".sidebar .dot").length })`);
check("the chapter list shows no status", !statusShown.legend && statusShown.dots === 0, JSON.stringify(statusShown));
await page.clickText("[role=tab]", "Outline");
await until(`(document.querySelector(".alt")?.innerText ?? "").length > 0`);
const outline = await page.run(`[...document.querySelectorAll(".alt option, .alt select")].map((el) => el.textContent.trim()).join(" | ")`);
check("the Outline has no status choice", outline === "", outline.slice(0, 80));

// An untitled chapter goes by its number.
await page.clickText("[role=tab]", "Write");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await page.run(`(() => { const name = [...document.querySelectorAll(".name")].find((el) => el.textContent.trim() === "Untitled"); (name.closest("button, [role=button], li") ?? name).click(); return true; })()`);
await sleep(800);
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.type("The ferry came at dusk.");
await sleep(2500);
await toHome();
const untitled = await greeting();
check("an untitled chapter goes by its number on the card", hello.test(untitled) && (await running()) === "The Lantern House · Ch. V", `${untitled} | ${await running()}`);

// Slovenian: the greeting, and no legend there either.
await page.click(".home .lang");
await sleep(600);
const sl = await greeting();
check("Slovenian greeting", /^(Dobro jutro|Dober dan|Dober večer|Spet pozno), Eva\. \S.*[.!]$/.test(sl) && !sl.includes("čaka") && (await running()) === "The Lantern House · Pogl. V", sl);
await page.clickText(".home button", "Nadaljuj s pisanjem");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(400);
const slLegend = await page.run(`(() => { const legend = document.querySelector(".legend"); return { text: legend?.innerText.replace(/\\s+/g, " ").trim(), lines: legend ? Math.round(legend.getBoundingClientRect().height) : 0, fits: legend ? legend.scrollWidth <= legend.clientWidth + 1 : false }; })()`);
check("no status legend in Slovenian either", slLegend.lines === 0, JSON.stringify(slLegend));
await page.click(".mark");
await until(`!!document.querySelector(".home .continue")`);
await page.click(".home .lang");
await sleep(400);

// Late at night: a fresh start in a time zone where it is between 23:00 and 05:00.
const zones = ["America/Los_Angeles", "Pacific/Honolulu", "America/New_York", "Europe/Ljubljana", "Asia/Tokyo", "Pacific/Auckland", "Asia/Kolkata", "America/Sao_Paulo"];
const late = zones.find((zone) => {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour >= 23 || hour < 5;
});
await page.send("Emulation.setTimezoneOverride", { timezoneId: late });
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
const night = await greeting();
check("late at night it says Late again, and then a word of encouragement", night.startsWith("Late again, Eva. ") && night.length > 25, `${night} in ${late}`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
