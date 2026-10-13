// Checks the toolbar's font and size (TOOL-6), as in Word: they go on the selected words, or on what is typed
// next; their boxes show the font and size where the cursor is; the manuscript's own font or size takes the
// words' own away. Settings keep the manuscript's font and size, and changing them leaves words with sizes
// of their own as they were. Saved with the page. Usage: node fonts-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
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
const pick = (label, value) =>
  page.run(`(() => { const select = document.querySelector('.ribbon select[aria-label="${label}"]'); select.value = ${JSON.stringify(String(value))}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const boxes = () => page.run(`[document.querySelector('.ribbon select[aria-label="Font"]')?.value, document.querySelector('.ribbon select[aria-label="Text size"]')?.value]`);
const cursorIn = (words, at = 1) =>
  page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode())) { const index = node.data.indexOf(${JSON.stringify(words)}); if (index >= 0) { const range = document.createRange(); range.setStart(node, index + ${at}); range.collapse(true); editor.focus(); getSelection().removeAllRanges(); getSelection().addRange(range); return true; } } return false; })()`);
// Each word with a font or size of its own: its words, its own font or size, and how it is on screen.
const styled = () =>
  page.run(`[...document.querySelectorAll(".paper .ProseMirror span[data-font], .paper .ProseMirror span[data-size]")].map((el) => [el.textContent, el.dataset.font ?? "", el.dataset.size ?? "", getComputedStyle(el).fontFamily.split(",")[0].replaceAll('"', ""), Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100])`);
const saved = () => page.run(`JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}")`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Mala beseda, velika beseda, druga pisava.");
await sleep(300);
check("the boxes show the manuscript's font and size where nothing has its own", JSON.stringify(await boxes()) === JSON.stringify(["literata", "12"]), JSON.stringify(await boxes()));

// The size goes on the selected words.
await page.selectWords("velika beseda");
await pick("Text size", 16);
await sleep(300);
check("16 goes on the selected words: 21.33 px on screen", JSON.stringify(await styled()) === JSON.stringify([["velika beseda", "", "16", "Literata", 21.33]]), JSON.stringify(await styled()));

// The font too.
await page.selectWords("druga pisava");
await pick("Font", "garamond");
await sleep(300);
check("Garamond goes on the selected words", (await styled()).some((item) => item[0] === "druga pisava" && item[1] === "garamond" && item[3] === "EB Garamond"), JSON.stringify(await styled()));

// The boxes show what is where the cursor is.
await cursorIn("pisava", 2);
await sleep(300);
check("in those words, the boxes show Garamond", (await boxes())[0] === "garamond", JSON.stringify(await boxes()));
await cursorIn("velika", 2);
await sleep(300);
check("in the bigger words, 16", (await boxes())[1] === "16", JSON.stringify(await boxes()));
await cursorIn("Mala", 2);
await sleep(300);
check("in plain words, the manuscript's again", JSON.stringify(await boxes()) === JSON.stringify(["literata", "12"]), JSON.stringify(await boxes()));

// The manuscript's own font takes the words' own away.
await page.selectWords("druga pisava");
await pick("Font", "literata");
await sleep(300);
check("the manuscript's own font takes Garamond off again", !(await styled()).some((item) => item[0].includes("pisava")), JSON.stringify(await styled()));

// With no words selected, the size is for what is typed next.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await pick("Text size", 20);
await sleep(200);
await page.type(" Naprej večje.");
await sleep(300);
check("with nothing selected, 20 is for the words typed next", (await styled()).some((item) => item[0] === " Naprej večje." && item[2] === "20" && item[4] === 26.67), JSON.stringify(await styled()));

// The manuscript's font and size stay Settings' own; changing them there leaves words with their own size as they are.
const prefs = await saved();
check("the toolbar didn't change the manuscript's font or size", prefs.manuscriptFont === "literata" && prefs.manuscriptPt === 12, JSON.stringify({ font: prefs.manuscriptFont, size: prefs.manuscriptPt }));
await page.run(`(() => { const raw = JSON.parse(localStorage.getItem("pensieve-prefs")); return true; })()`);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "Appearance");
await sleep(300);
await page.run(`(() => { const label = [...document.querySelectorAll(".window .slider")].find((item) => item.textContent.includes("Text size")); const input = label.querySelector("input"); input.value = "14"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
await sleep(300);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
const page14 = await page.run(`Math.round(parseFloat(getComputedStyle(document.querySelector(".paper .ProseMirror")).fontSize) * 100) / 100`);
check("Settings' 14 pt makes the page 18.67 px, the 16 pt words still 21.33 px", page14 === 18.67 && (await styled()).some((item) => item[0] === "velika beseda" && item[4] === 21.33), JSON.stringify({ page: page14, styled: await styled() }));

// Saved with the page.
await page.key("s", "KeyS", 83, 2);
await until(`/^Saved/.test(document.querySelector(".titlebar .save")?.textContent.trim() ?? "")`);
const stored = await page.run(`(() => { const key = [...window.__PV_HARNESS__.books.keys()].find((name) => name.includes("My first project")); const r = window.__PV_HARNESS__.books.get(key).exec("SELECT content_json FROM chapters"); return r[0].values.map((row) => row[0]).join(" "); })()`);
check("the words' own sizes are saved with the page", stored.includes('"type":"fontSize","attrs":{"pt":16}') && stored.includes('"type":"fontSize","attrs":{"pt":20}'), stored.match(/"type":"fontSize","attrs":\{"pt":\d+\}/g)?.join(" "));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
