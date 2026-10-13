// Checks that the list and quote shortcuts and typed "# " or "> " leave a chapter's title a title, in the
// built app with its real keymaps and input rules. Usage: node keys-check.mjs [port]
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
const top = () => page.run(`[...document.querySelectorAll(".paper .ProseMirror > *")].slice(0, 2).map((el) => el.tagName + ":" + el.textContent.trim())`);
const caret = async (offset) => {
  await page.run(`(() => {
    const editor = document.querySelector(".paper .ProseMirror");
    const text = document.createTreeWalker(editor.children[0], NodeFilter.SHOW_TEXT).nextNode();
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

for (const [label, key, code, keyCode] of [
  ["Ctrl+Shift+8 (bullets)", "*", "Digit8", 56],
  ["Ctrl+Shift+7 (numbers)", "/", "Digit7", 55],
  ["Ctrl+Shift+B (quote)", "B", "KeyB", 66],
]) {
  await caret(3);
  await page.key(key, code, keyCode, 2 | 8);
  await sleep(300);
  const after = await top();
  check(`${label} leaves the title a title`, after[0] === "H2:Welcome", after.join(" | "));
  if (await page.run(`!!document.querySelector(".window")`)) {
    await page.key("Escape", "Escape", 27);
    await sleep(300);
  }
}

await caret(0);
await page.type("#");
await page.type(" ");
await sleep(300);
const hashed = await top();
check('typed "# " stays text in the title', hashed[0] === "H2:# Welcome", hashed.join(" | "));
await page.key("z", "KeyZ", 90, 2);
await sleep(200);
await caret(0);
await page.type(">");
await page.type(" ");
await sleep(300);
const quoted = await top();
check('typed "> " stays text in the title', quoted[0] === "H2:> Welcome" || quoted[0] === "H2:>  Welcome".replace("  ", " "), quoted.join(" | "));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
