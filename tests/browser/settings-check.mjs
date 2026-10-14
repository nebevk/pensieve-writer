// Settings at Eva's 1366 × 768 (LOOK-4): every section fits its window with no sideways scroll and nothing
// squeezed, in a light look in English and a dark one in Slovenian; the shortcuts listed are the ones there are; Ctrl+/ on a Slovenian
// keyboard opens them without touching the page; F5 and Ctrl+R never reload; a book target typed the
// Slovenian way is kept, Esc or not. Screenshots of each section land in shots/. Usage: node settings-check.mjs [port]
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
const write = async (button = "Continue writing") => {
  await until(`!!document.querySelector(".home .continue")`);
  await page.clickText(".home button", button);
  await until(`!!document.querySelector(".paper .ProseMirror")`);
  await sleep(600);
};
const settings = async (section) => {
  await page.click(".gear");
  await until(`!!document.querySelector(".window")`);
  await sleep(300);
  await page.clickText(".window nav button", section);
  await sleep(300);
};
const close = async () => {
  await page.key("Escape", "Escape", 27);
  await until(`!document.querySelector(".window")`);
  await sleep(200);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run("localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en' })), true");
await page.open(`http://127.0.0.1:${port}/`, 500);
await write();

const sections = async (look) => {
  await page.click(".gear");
  await until(`!!document.querySelector(".window")`);
  await sleep(400);
  const names = await page.run(`[...document.querySelectorAll(".window nav button")].map((button) => button.textContent.trim())`);
  for (const [index, name] of names.entries()) {
    await page.clickText(".window nav button", name);
    await sleep(300);
    // Squeezed: a control drawn smaller than what it holds, as the language switch once was.
    const fit = await page.run(`(() => {
      const pane = document.querySelector(".window .pane");
      const box = document.querySelector(".window").getBoundingClientRect();
      const squeezed = [...pane.querySelectorAll(".segment, .row, .actions, .split, .swatches, .fonts")]
        .filter((el) => el.scrollHeight > el.clientHeight + 1)
        .map((el) => el.className.split(" ")[0] + ": " + el.textContent.trim().slice(0, 30));
      return { sideways: pane.scrollWidth - pane.clientWidth, inside: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth, squeezed };
    })()`);
    check(`${look}: ${name} fits its window, nothing squeezed or to scroll sideways`, fit.sideways <= 0 && fit.inside && fit.squeezed.length === 0, JSON.stringify(fit));
    await page.shoot(`${shots}settings-${look}-${index + 1}-${name.toLowerCase().replace(/[^a-z]+/g, "-")}.png`);
  }
  await close();
};
await sections("daylight");

// The shortcuts, in groups, each key as it is printed.
await settings("Shortcuts");
const groups = await page.run(`[...document.querySelectorAll(".window .keys .lab")].map((el) => el.textContent.trim())`);
check("Shortcuts come in four groups", JSON.stringify(groups) === JSON.stringify(["On the page", "Finding", "Anywhere", "The library, chapters and lists"]), JSON.stringify(groups));
const listed = await page.run(`[...document.querySelectorAll(".window .keys .row")].map((row) => row.querySelector("span").textContent.trim() + " = " + [...row.querySelectorAll("kbd")].map((key) => key.textContent).join("+"))`);
for (const row of ["Bold = Ctrl+B", "Search everything = Ctrl+Shift+F", "Comment = Ctrl+Alt+M", "Quick idea = Ctrl+Shift+N", "This list = Ctrl+/", "Rename = F2", "Its menu, as with a right-click = Shift+F10", "Paste as plain text = Ctrl+Shift+V"]) {
  check(`Shortcuts list ${row}`, listed.includes(row));
}
check("…and not Ctrl+Shift+7, which on a Slovenian keyboard is Ctrl+/", !listed.some((row) => row.includes("Shift+7")), listed.join(" | "));
await close();

// Ctrl+/ as a Slovenian keyboard sends it (Ctrl+Shift+7), with the cursor in the text: the list opens and the
// paragraph stays a paragraph. On an English keyboard Ctrl+Shift+7 is still a numbered list.
const caretInText = () =>
  page.run(`(() => {
    const editor = document.querySelector(".paper .ProseMirror");
    const block = [...editor.children].find((el) => el.tagName === "P" && el.textContent.trim().length > 8);
    const text = document.createTreeWalker(block, NodeFilter.SHOW_TEXT).nextNode();
    editor.focus();
    const range = document.createRange();
    range.setStart(text, 2);
    range.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    return true;
  })()`);
const lists = () => page.run(`document.querySelectorAll(".paper .ProseMirror ol").length`);
await caretInText();
await sleep(200);
await page.key("/", "Digit7", 55, 2 | 8);
await until(`!!document.querySelector(".window")`, 20);
check(
  "Ctrl+/ on a Slovenian keyboard opens the shortcuts and leaves the paragraph as it was",
  (await page.run(`document.querySelector(".window nav button.active")?.textContent.trim()`)) === "Shortcuts" && (await lists()) === 0,
  `lists: ${await lists()}`,
);
await close();
await caretInText();
await sleep(200);
await page.key("&", "Digit7", 55, 2 | 8);
await sleep(300);
check("Ctrl+Shift+7 on an English keyboard is still a numbered list", (await lists()) === 1 && !(await page.run(`!!document.querySelector(".window")`)));
await page.key("z", "KeyZ", 90, 2);
await sleep(300);

// F5 and Ctrl+R would reload the window; in the built app they do nothing.
const prevented = (init, inside = ".paper .ProseMirror") =>
  page.run(`(() => { const event = new KeyboardEvent("keydown", { ...${JSON.stringify(init)}, bubbles: true, cancelable: true }); document.querySelector(${JSON.stringify(inside)}).dispatchEvent(event); return event.defaultPrevented; })()`);
check("F5 doesn't reload Pensieve", await prevented({ key: "F5", code: "F5" }));
check("nor Ctrl+R (Word's align right)", await prevented({ key: "r", code: "KeyR", ctrlKey: true }));
check("nor Ctrl+Shift+R", await prevented({ key: "R", code: "KeyR", ctrlKey: true, shiftKey: true }));
await settings("General");
check("nor either inside a window, which keeps the page's other keys", (await prevented({ key: "F5", code: "F5" }, ".window nav button")) && (await prevented({ key: "r", code: "KeyR", ctrlKey: true }, ".window nav button")));
await close();

// Import Word is a button like the others, which opens the file picker; the file field itself is out of sight.
await settings("Backup & export");
const picker = await page.run(`(() => {
  const input = document.querySelector(".window input[type=file]");
  let asked = false;
  input.click = () => { asked = true; };
  [...document.querySelectorAll(".window button")].find((button) => button.textContent.trim() === "Import Word")?.click();
  return { asked, hidden: input.hidden };
})()`);
check("Import Word is a button that opens the file picker", picker.asked && picker.hidden, JSON.stringify(picker));
await close();

// A book target typed the Slovenian way, then Enter; another, then Esc at once: both kept.
const goal = async (typed, end) => {
  await settings("Writing & goals");
  await page.run(`(() => { const input = document.querySelector("#settings-book-goal"); input.focus(); input.select(); return true; })()`);
  await page.type(typed);
  if (end === "Enter") {
    await page.key("Enter", "Enter", 13);
    await sleep(200);
  }
  await close();
  await settings("Writing & goals");
  const kept = await page.run(`document.querySelector("#settings-book-goal").value`);
  await close();
  return kept;
};
const first = await goal("80.000", "Enter");
check("a book target typed 80.000 and Enter is eighty thousand", first === "80000", first);
const second = await goal("95.500", "Escape");
check("one typed and left with Esc at once is kept too", second === "95500", second);

await page.run(`(() => {
  const prefs = JSON.parse(localStorage.getItem("pensieve-prefs"));
  localStorage.setItem("pensieve-prefs", JSON.stringify({ ...prefs, theme: "candlelit", uiLanguage: "sl" }));
  return true;
})()`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await write("Nadaljuj s pisanjem");
await sections("candlelit");

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
