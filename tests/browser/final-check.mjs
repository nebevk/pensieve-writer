// Checks the last review's fixes in the built app: the title keeps its style, a heading with a comment
// stays a heading, a split can be taken back, and a split made by saving leaves the find box its
// keyboard. Usage: node final-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1500, height: 900 });
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
const lines = () => page.run(`[...document.querySelectorAll(".paper .ProseMirror > *")].map((el) => el.tagName + ":" + el.textContent.trim().slice(0, 24))`);
const names = () => page.run(`[...document.querySelectorAll(".sidebar li button .name")].map((el) => el.textContent.trim())`);
const notice = () => page.run(`document.querySelector(".write-notice")?.textContent.replace(/\\s+/g, " ").trim() ?? ""`);
const toEnd = () => page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
const setStyle = (value) => page.run(`(() => { const select = [...document.querySelectorAll("select")].find((el) => [...el.options].some((option) => option.value === "h2")); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const caret = async (index, offset) => {
  await page.run(`(() => {
    const editor = document.querySelector(".paper .ProseMirror");
    const text = document.createTreeWalker(editor.children[${index}], NodeFilter.SHOW_TEXT).nextNode();
    editor.focus();
    const range = document.createRange();
    range.setStart(text, Math.min(${offset}, text.length));
    range.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    return true;
  })()`);
  await sleep(200);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
const start = await names();

// The title keeps its style.
await caret(0, 3);
await setStyle("p");
await sleep(300);
check("the style box leaves the title a title", (await lines())[0] === "H2:Welcome", (await lines())[0]);
check("and says why", /keep their style/.test(await notice()), await notice());

// A heading with a comment stays a heading, and says why.
await toEnd();
await page.key("Enter", "Enter", 13);
await page.type("The Storm");
await sleep(200);
await page.selectWords("The Storm");
await sleep(200);
await page.key("m", "KeyM", 77, 3);
await sleep(600);
await page.type("Move this?");
await sleep(300);
await page.selectWords("The Storm");
await sleep(200);
await setStyle("h2");
await sleep(300);
await toEnd();
await page.key("Enter", "Enter", 13);
await page.type("Rain.");
await sleep(800);
check("a heading with a comment starts no chapter", JSON.stringify(await names()) === JSON.stringify(start), JSON.stringify(await names()));
check("and the page says why", /stays a heading/.test(await notice()), await notice());
check("the comment is still there", await page.run(`[...document.querySelectorAll(".paper .ProseMirror h2 .comment")].some((el) => el.textContent.includes("Storm"))`));

// A split can be taken back for a few seconds.
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h2");
await page.type("Chapter Two");
await page.key("Enter", "Enter", 13);
check("a named heading left with Enter starts a chapter", await until(`document.querySelectorAll(".sidebar li button .name").length === ${start.length + 1}`), JSON.stringify(await names()));
const offered = await notice();
check("a notice offers to take it back", /starts a new chapter/.test(offered) && (await page.run(`!!document.querySelector(".notice-undo")`)), offered);
await page.click(".notice-undo");
check("Undo takes the new chapter back", await until(`document.querySelectorAll(".sidebar li button .name").length === ${start.length}`), JSON.stringify(await names()));
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("Chapter Two")`);
const back = await lines();
check("its heading is a line of text in the chapter again", back.some((line) => line === "P:Chapter Two") && back[0] === "H2:Welcome", back.slice(-3).join(" | "));

// A split made by saving, while she types in the find box, leaves the find box the keyboard.
await toEnd();
await page.key("Enter", "Enter", 13);
await setStyle("h2");
await page.type("Chapter Three");
await sleep(200);
await page.key("f", "KeyF", 70, 2);
await until(`document.activeElement?.closest?.(".find-panel") !== null && document.activeElement?.tagName === "INPUT"`);
await page.type("Sa");
await sleep(2800);
await page.type("va");
await sleep(300);
const find = await page.run(`({ value: document.querySelector(".find-panel .field input")?.value, focused: document.activeElement?.closest?.(".find-panel") !== null })`);
check("the save's split leaves the find box its keyboard", find.value === "Sava" && find.focused, JSON.stringify(find));
check("and the new chapter is in the list, named whole", (await names()).includes("Chapter Three"), JSON.stringify(await names()));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
