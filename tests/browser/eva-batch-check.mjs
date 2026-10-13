// Checks the 6 October evening batch: Slovenian from the start, word goals in the list beside the page,
// a minimize button on both side lists, slim scrollbars, closer lines with paragraphs apart, and 12 pt
// text. Usage: node eva-batch-check.mjs [port]
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
const until = async (expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const toEnd = () =>
  page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
const saved = () => page.run(`JSON.parse(localStorage.getItem("pensieve-prefs") || "{}")`);
const toggles = () => page.run(`[...document.querySelectorAll(".panel-toggle")].map((button) => button.textContent.replace(/\\s+/g, " ").trim() + (button.getAttribute("aria-pressed") === "true" ? " (on)" : ""))`);
const setNumber = (selector, value) =>
  page.run(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) return "missing"; input.value = ${JSON.stringify(String(value))}; input.dispatchEvent(new Event("change", { bubbles: true })); return "ok"; })()`);
const goals = () =>
  page.run(`[...document.querySelectorAll("aside.panel .goal")].map((goal) => ({
    title: goal.querySelector("h4")?.textContent.trim(),
    aside: goal.querySelector(".aside")?.textContent.trim() ?? "",
    words: goal.querySelector(".words")?.textContent.replace(/\\s+/g, " ").trim(),
    bar: goal.querySelector(".bar span")?.style.width ?? "",
    reached: goal.classList.contains("reached"),
    target: goal.querySelector("input")?.value,
    label: goal.querySelector("label")?.textContent.trim(),
  }))`);

// A first start, with nothing saved: Pensieve speaks Slovenian.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
const fresh = await page.run(`({ lang: document.documentElement.lang, button: document.querySelector(".home .continue")?.textContent.trim(), tabs: [...document.querySelectorAll(".titlebar [role=tab], .titlebar .tab")].map((tab) => tab.textContent.trim()).join(" / ") })`);
check("a first start is in Slovenian", fresh.lang === "sl" && /Nadaljuj/.test(fresh.button ?? ""), JSON.stringify(fresh));
check("the language is saved as Slovenian", (await saved()).uiLanguage === "sl");

// From here on in English, as the other checks read English labels.
await page.run(`(() => { const prefs = JSON.parse(localStorage.getItem("pensieve-prefs") || "{}"); localStorage.setItem("pensieve-prefs", JSON.stringify({ ...prefs, uiLanguage: "en", panel: "", toolsExpanded: false })); return true; })()`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(400);

// The page: 12 pt text, lines 1.5 apart, a paragraph after another a little apart and not indented.
await toEnd();
await page.key("Enter", "Enter", 13);
await page.type("Prvi odstavek z besedami.");
await page.key("Enter", "Enter", 13);
await page.type("Drugi odstavek s še nekaj besedami.");
await sleep(1500);
const look = await page.run(`(() => {
  const editor = document.querySelector(".paper .ProseMirror");
  const paragraphs = [...editor.querySelectorAll(":scope > p")];
  const last = getComputedStyle(paragraphs.at(-1));
  const root = getComputedStyle(editor);
  return { size: root.fontSize, line: root.lineHeight, indent: last.textIndent, gap: last.marginTop, text: paragraphs.at(-1).textContent };
})()`);
check("the text is 12 pt, 16 px on screen", look.size === "16px", look.size);
check("lines are 1.5 apart", look.line === "24px", look.line);
check("a paragraph after another is not indented and sits a little apart", look.indent === "0px" && look.gap === "9.6px", `${look.indent}, ${look.gap}`);
await page.shoot(`${shots}eva-page.png`, { x: 230, y: 90, width: 900, height: 420 });

// The left list has no goal field any more, and a button of its own to fold it away.
const sidebar = await page.run(`({ inputs: document.querySelectorAll(".sidebar .chapter-actions input").length, actions: document.querySelector(".sidebar .chapter-actions")?.innerText.replace(/\\s+/g, " ").trim(), hide: document.querySelector(".sidebar-head .hide")?.getAttribute("aria-label") })`);
check("the chapter list has no goal field", sidebar.inputs === 0 && !/goal/i.test(sidebar.actions ?? ""), sidebar.actions);
check("the chapter list has a hide button", sidebar.hide === "Hide chapters", sidebar.hide);
await page.click(".sidebar-head .hide");
await sleep(500);
const folded = await page.run(`({ collapsed: document.querySelector(".shell").classList.contains("collapsed"), width: Math.round(document.querySelector(".sidebar").getBoundingClientRect().width), tab: document.querySelector(".show-chapters")?.getAttribute("aria-label") ?? "" })`);
check("hiding folds the chapter list away", folded.collapsed && folded.width === 0, JSON.stringify(folded));
check("a tab at the desk's edge brings it back", folded.tab === "Show chapters");
await page.shoot(`${shots}eva-folded.png`, { x: 0, y: 90, width: 700, height: 600 });
await page.click(".show-chapters");
await sleep(500);
const unfolded = await page.run(`({ collapsed: document.querySelector(".shell").classList.contains("collapsed"), width: Math.round(document.querySelector(".sidebar").getBoundingClientRect().width), tab: !!document.querySelector(".show-chapters") })`);
check("the tab unfolds the list again", !unfolded.collapsed && unfolded.width > 200 && !unfolded.tab, JSON.stringify(unfolded));

// The Goals list beside the page: words today toward the day's goal, and the chapter's goal.
check("the toolbar has a Goals button", (await toggles()).some((label) => /^Goals\s*\d/.test(label)), (await toggles()).join(" / "));
await page.run(`[...document.querySelectorAll(".panel-toggle")].find((button) => button.textContent.includes("Goals")).click(), true`);
await until(`(document.querySelector("aside.panel .heading h3")?.textContent ?? "") === "Goals"`);
const first = await goals();
check("Goals shows today and this chapter", first.length === 2 && first[0].title === "Today" && first[1].title === "This chapter", first.map((goal) => goal.title).join(" / "));
check("the day's goal starts at 500 words", first[0].target === "500" && /of 500 words/.test(first[0].words), first[0].words);
const today = Number((first[0].words.match(/^[\d,]+/)?.[0] ?? "0").replace(/,/g, ""));
check("words written today are counted", today >= 9, String(today));
check("Goals is the pressed toolbar button", (await toggles()).some((label) => label.startsWith("Goals") && label.endsWith("(on)")));
await page.shoot(`${shots}eva-goals.png`, { x: 1050, y: 80, width: 316, height: 420 });

await setNumber("aside.panel .goal:nth-of-type(1) input", today);
await sleep(300);
const reached = await goals();
check("reaching the day's goal says so", reached[0].reached && reached[0].aside === "Goal reached" && reached[0].bar === "100%", JSON.stringify(reached[0]));
check("the day's goal is saved", (await saved()).dailyGoal === today, String((await saved()).dailyGoal));
await setNumber("aside.panel .goal:nth-of-type(1) input", today * 4);
await sleep(300);
const quarter = await goals();
check("short of the goal shows how far", !quarter[0].reached && quarter[0].aside === "25%" && quarter[0].bar === "25%", JSON.stringify(quarter[0]));
await setNumber("aside.panel .goal:nth-of-type(1) input", 0);
await sleep(300);
const none = await goals();
check("no daily goal shows only the words", none[0].bar === "" && none[0].aside === "" && /^\d+ words?$/.test(none[0].words), none[0].words);

await setNumber("aside.panel .goal:nth-of-type(2) input", 2000);
await sleep(600);
const chapterGoal = await goals();
const count = await page.run(`document.querySelector(".sidebar li button.active .count")?.textContent.trim()`);
check("the chapter's goal is set from the Goals list", chapterGoal[1].target === "2000" && /of 2,000 words/.test(chapterGoal[1].words), chapterGoal[1].words);
check("the chapter list shows it", /\/2k$/.test(count ?? ""), count);
await setNumber("aside.panel .goal:nth-of-type(1) input", 500);
await sleep(300);

// The panel folds away with the same kind of button as the chapter list.
const hidePanel = await page.run(`document.querySelector("aside.panel .close")?.getAttribute("aria-label")`);
check("the panel's button hides it", hidePanel === "Hide panel", hidePanel);
await page.click("aside.panel .close");
check("hiding closes the panel", await until(`!document.querySelector("aside.panel")`));
check("no toolbar button stays pressed", (await toggles()).every((label) => !label.endsWith("(on)")), (await toggles()).join(" / "));

// Text size in points, as in Word: in Settings and in All tools.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "Appearance");
await sleep(300);
const sizeLabel = await page.run(`[...document.querySelectorAll(".window .slider span")].map((span) => span.textContent.replace(/\\s+/g, " ").trim()).find((text) => text.startsWith("Text size"))`);
const slider = await page.run(`(() => { const label = [...document.querySelectorAll(".window .slider")].find((item) => item.textContent.includes("Text size")); const input = label?.querySelector("input"); return input ? [input.min, input.max, input.step, input.value].join(" ") : ""; })()`);
check("Settings show the text size in points", sizeLabel === "Text size 12 pt" && slider === "10 18 0.5 12", `${sizeLabel}; ${slider}`);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.click(".ribbon .more");
await sleep(300);
const sizes = await page.run(`(() => { const select = document.querySelector('select[aria-label="Text size"]'); return select ? select.value + " | " + [...select.options].map((option) => option.textContent).join(" ") : ""; })()`);
check("All tools offer Word's sizes, 12 chosen", sizes === "12 | 10 11 12 13 14 16 18", sizes);
await page.run(`(() => { const select = document.querySelector('select[aria-label="Text size"]'); select.value = "14"; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
await sleep(300);
const bigger = await page.run(`getComputedStyle(document.querySelector(".paper .ProseMirror")).fontSize`);
check("14 pt is 18.67 px on screen", Math.abs(parseFloat(bigger) - 18.667) < 0.05, bigger);
check("the size is saved in points", (await saved()).manuscriptPt === 14 && !("manuscriptSize" in (await saved())));
await page.run(`(() => { const select = document.querySelector('select[aria-label="Text size"]'); select.value = "12"; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);

// Scrollbars: slim and rounded, from the app's own rules, which nothing switches off.
const scroll = await page.run(`(() => {
  const rules = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules]; } catch { return []; } });
  const thumb = rules.find((rule) => rule.selectorText === "::-webkit-scrollbar-thumb");
  const offenders = [...document.querySelectorAll("*")].filter((el) => { const style = getComputedStyle(el); return style.scrollbarWidth !== "auto" || style.scrollbarColor !== "auto"; }).length;
  return { thumb: thumb?.style.borderRadius ?? "", offenders };
})()`);
check("scrollbars have a rounded thumb", scroll.thumb === "999px", scroll.thumb);
check("nothing switches the slim scrollbars off", scroll.offenders === 0, String(scroll.offenders));

// A long page shows the slim scrollbar beside it.
await toEnd();
for (let line = 0; line < 30; line += 1) {
  await page.type(`Vrstica ${line + 1}, da se stran podaljša čez zaslon.`);
  await page.key("Enter", "Enter", 13);
}
await sleep(800);
await page.shoot(`${shots}eva-scrollbar.png`, { x: 1000, y: 90, width: 366, height: 640 });

// All tools has its own Goals button; the panel is the third column, after the list and the page.
await page.click(`button[aria-label="Goals panel"]`);
check("All tools open the Goals list too", await until(`(document.querySelector("aside.panel .heading h3")?.textContent ?? "") === "Goals"`));
const columns = await page.run(`getComputedStyle(document.querySelector(".shell")).gridTemplateColumns`);
check("the panel sits beside the page, the list on the other side", /^272px \d+(\.\d+)?px 300px$/.test(columns), columns);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
