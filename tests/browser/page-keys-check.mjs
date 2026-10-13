// Checks the fixes from the review of the chapter page: keys on the title and part lines never split a
// chapter, a heading starts a chapter or part once it is named, the title line takes no comments, a page
// open while chapters are reordered keeps the parts, and Notes keep deleted notes deleted and new notes
// shown. Usage: node page-keys-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
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
const lines = () => page.run(`[...document.querySelectorAll(".paper .ProseMirror > *")].slice(0, 4).map((el) => el.tagName + ":" + el.textContent.trim().slice(0, 30))`);
const names = () => page.run(`[...document.querySelectorAll(".sidebar li:not(.part) button .name")].map((el) => el.textContent.trim())`);
const parts = () => page.run(`[...document.querySelectorAll(".sidebar li")].map((li) => li.classList.contains("part") ? "[" + li.textContent.trim() + "]" : li.querySelector(".name")?.textContent.trim()).filter(Boolean)`);
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
/** Puts the caret `offset` characters into block `index` of the page. */
const caret = async (index, offset) => {
  await page.run(`(() => {
    const editor = document.querySelector(".paper .ProseMirror");
    const block = editor.children[${index}];
    editor.focus();
    const text = document.createTreeWalker(block, NodeFilter.SHOW_TEXT).nextNode();
    const range = document.createRange();
    if (text) range.setStart(text, Math.min(${offset}, text.length)); else range.setStart(block, 0);
    range.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    return true;
  })()`);
  await sleep(150);
};
const setStyle = (value) => page.run(`(() => { const select = [...document.querySelectorAll("select")].find((el) => [...el.options].some((option) => option.value === "h2")); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const enter = () => page.key("Enter", "Enter", 13);
const backspace = () => page.key("Backspace", "Backspace", 8);
const openChapter = (name) => page.run(`(() => { const el = [...document.querySelectorAll(".sidebar li button")].find((b) => b.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)}); if (!el) return "missing"; el.click(); return "ok"; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
const before = await names();

// Enter at the start of the title opens an empty part line above it; nothing splits.
await caret(0, 0);
await enter();
await sleep(400);
const opened = await lines();
check("Enter at the start of the title opens a part line above it", opened[0] === "H1:" && opened[1] === "H2:Welcome", opened.join(" | "));
check("and starts no chapter", JSON.stringify(await names()) === JSON.stringify(before), JSON.stringify(await names()));
await page.type("Part One");
await sleep(2600);
check("a name typed there begins a part", JSON.stringify(await parts()).includes("[Part One]"), JSON.stringify(await parts()));
// Enter at the end of the part line goes on to the title line.
await caret(0, 8);
await enter();
await page.type("!");
await sleep(400);
const onTitle = await lines();
check("Enter on the part line goes on to the title", onTitle[0] === "H1:Part One" && onTitle[1] === "H2:Welcome!", onTitle.join(" | "));
await backspace();
// Emptied and Backspaced, the part line goes, and so does the part.
await caret(0, 8);
for (let key = 0; key < 9; key += 1) await backspace();
await sleep(300);
const gone = await lines();
check("Backspace in an empty part line takes it away", gone[0] === "H2:Welcome", gone.join(" | "));
await sleep(2600);
check("and the part with it", !JSON.stringify(await parts()).includes("[Part One]"), JSON.stringify(await parts()));
check("still no chapter added", JSON.stringify(await names()) === JSON.stringify(before), JSON.stringify(await names()));

// Enter in the middle of the title makes the rest a line of text; Undo puts it back.
await caret(0, 3);
await enter();
await sleep(300);
const split = await lines();
check("Enter mid-title makes the rest the first line of text", split[0] === "H2:Wel" && split[1] === "P:come", split.join(" | "));
check("without starting a chapter", JSON.stringify(await names()) === JSON.stringify(before), JSON.stringify(await names()));
await page.key("z", "KeyZ", 90, 2);
await sleep(300);
check("Undo puts the title back whole", (await lines())[0] === "H2:Welcome", (await lines()).join(" | "));
await sleep(500);

// A comment on the title line is turned away, with a word why.
await caret(0, 2);
await page.key("m", "KeyM", 77, 3);
await sleep(500);
const notice = await page.run(`document.querySelector(".write-notice")?.textContent ?? ""`);
check("a comment on the title is turned away", /not in the title/.test(notice) && !document_has_comment(await page.run(`document.querySelectorAll(".paper .ProseMirror .comment").length`)), notice);

// A Heading 1 at the end begins a part once named and left; its first chapter's title gets the keyboard.
await toEnd();
await enter();
await setStyle("h1");
await page.type("Part Two");
await sleep(500);
check("a Heading 1 being named starts nothing yet", (await names()).length === before.length, JSON.stringify(await names()));
await enter();
check("Enter after its name begins the part, with a new chapter", await until(`document.querySelectorAll(".sidebar li:not(.part) button .name").length === ${before.length + 1}`), JSON.stringify(await names()));
await until(`(document.querySelector(".paper .ProseMirror > h1")?.textContent ?? "") === "Part Two"`);
await sleep(400);
await page.type("Chapter Two");
await sleep(1200);
const partPage = await lines();
check("the new page has the part line and the title the keyboard went to", partPage[0] === "H1:Part Two" && partPage[1] === "H2:Chapter Two", partPage.join(" | "));
await sleep(2200);
const runParts = await parts();
check("the chapter list shows the part and the new chapter in it", JSON.stringify(runParts).includes(`"[Part Two]","Chapter Two"`), JSON.stringify(runParts));

// Reordering while a chapter mid-part is open keeps the parts.
const after = await names();
const middle = after[after.length - 1];
await openChapter(middle);
await until(`(document.querySelector(".paper .ProseMirror > h2")?.textContent ?? "") !== "Chapter Two"`);
await sleep(600);
const middleLines = await lines();
await page.run(`(() => {
  const find = (name) => [...document.querySelectorAll(".sidebar li button")].find((b) => b.querySelector(".name")?.textContent.trim() === name);
  const from = find(${JSON.stringify(middle)});
  const to = find("Chapter Two").closest("li");
  const data = new DataTransfer();
  from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
  to.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
  to.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: data }));
  from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
  return true;
})()`);
await sleep(2600);
const reordered = await parts();
check("reordering a chapter in a part, while it is open, keeps the part", JSON.stringify(reordered).includes(`"[Part Two]","${middle}","Chapter Two"`), `${middleLines.join(" | ")} -> ${JSON.stringify(reordered)}`);

// Notes: a new note stays shown, a deleted one stays deleted.
await page.clickText(".titlebar [role=tab], .titlebar button", "Notes");
await until(`!!document.querySelector(".add")`);
await sleep(600);
const noteRows = () => page.run(`[...document.querySelectorAll(".row .name")].map((el) => el.textContent.trim())`);
const start = await noteRows();
await page.clickText("button.add", "New note");
await sleep(900);
const made = await noteRows();
const card = await page.run(`!!document.querySelector("article.card")`);
check("a new note is listed and open", made.length === start.length + 1 && card, `${start.length} -> ${made.length}, card ${card}`);
await page.clickText("button.danger", "Delete note");
await sleep(200);
await page.clickText(".confirm button.danger", "Delete");
await sleep(1500);
const left = await noteRows();
check("a deleted note stays deleted", left.length === start.length, `${made.length} -> ${left.length}`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();

function document_has_comment(count) {
  return Number(count) > 0;
}
