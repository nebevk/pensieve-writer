// Checks the selection bar (owner, 12 October): it shows once a mouse selection is let go (not while
// dragging) or once Shift and the arrows stop, above the words; B, I, U and highlight work and it stays;
// typing or Escape puts it away; the floating bar counts the selected words; Make a note links a name to
// a new note or to the note of that name, and quotes a passage in a new one; Find looks through the book,
// and Ctrl+F takes the selected words; a title line has only Find; Zen only the formatting.
// Usage: node --experimental-websocket selection-check.mjs [port]
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
const until = async (expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const shown = `!!document.querySelector(".selection-bar.shown")`;
const buttons = () => page.run(`[...document.querySelectorAll(".selection-bar button")].map((b) => b.getAttribute("aria-label"))`);
// Where the words are on screen: the left middle of their first letter and the right middle of their last.
const spot = (words) =>
  page.run(`(() => {
    const root = document.querySelector(".paper .ProseMirror");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent.indexOf(${JSON.stringify(words)});
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + ${JSON.stringify(words)}.length);
      const rects = [...range.getClientRects()];
      const first = rects[0];
      const last = rects[rects.length - 1];
      return { x1: first.left + 1, y1: first.top + first.height / 2, x2: last.right - 1, y2: last.top + last.height / 2, top: first.top, left: first.left, right: last.right };
    }
    return null;
  })()`);
const mouse = (type, x, y, buttons = 0) => page.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" && !buttons ? "none" : "left", buttons, clickCount: 1 });
/** Drags across the words with the mouse; `release: false` stops before letting go. */
const drag = async (from, to = from, release = true) => {
  const start = await spot(from);
  const end = await spot(to);
  await mouse("mouseMoved", start.x1, start.y1);
  await mouse("mousePressed", start.x1, start.y1, 1);
  for (let step = 1; step <= 4; step += 1) {
    await mouse("mouseMoved", start.x1 + ((end.x2 - start.x1) * step) / 4, start.y1 + ((end.y2 - start.y1) * step) / 4, 1);
    await sleep(30);
  }
  if (release) await mouse("mouseReleased", end.x2, end.y2);
  return { start, end };
};
const text = () => page.run(`document.querySelector(".paper .ProseMirror").innerText`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await page.mouse(".home .continue .go", "");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(1200);

// A mouse selection: nothing while dragging, the bar once it's let go, above the words.
await drag("first sitting", "first sitting", false);
await sleep(400);
check("while she drags, no bar", !(await page.run(shown)));
const words = await spot("first sitting");
await mouse("mouseReleased", words.x2, words.y2);
check("let go, the bar shows", await until(shown, 20));
const box = await page.run(`(() => { const r = document.querySelector(".selection-bar").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })()`);
check("above the selected words, over them", box.bottom <= words.top && box.bottom > words.top - 40 && box.right > words.left && box.left < words.right, JSON.stringify({ box, words: { top: words.top, left: words.left, right: words.right } }));
check("with B, I, U, highlight, Comment, Make a note and Find", JSON.stringify(await buttons()) === JSON.stringify(["Bold", "Italic", "Underline", "Highlight", "Comment", "Make a note", "Find in this project"]), (await buttons()).join(", "));
const counted = await page.run(`[...document.querySelectorAll(".statusbar span")].map((span) => span.textContent.trim()).find((line) => / of \\d+ words$/.test(line)) ?? ""`);
check("the floating bar counts them: 2 of the chapter's words", /^2 of \d+ words$/.test(counted), counted);
await page.shoot(`${shots}selection-bar.png`, { x: 280, y: 120, width: 820, height: 260 });

// Formatting: the bar stays, its buttons follow.
await page.mouse(".selection-bar button.bold", "B");
await sleep(300);
check("B makes them bold, and the bar stays, B pressed", (await page.run(`[...document.querySelectorAll(".paper .ProseMirror strong")].some((el) => el.textContent === "first sitting")`)) && (await page.run(shown)) && (await page.run(`document.querySelector(".selection-bar button.bold").getAttribute("aria-pressed")`)) === "true");
await page.mouse('.selection-bar button[aria-label="Highlight"]', "");
await sleep(300);
check("highlight marks them", await page.run(`[...document.querySelectorAll(".paper .ProseMirror mark")].some((el) => el.textContent === "first sitting")`));
check("the keyboard stays in the page", await page.run(`!!document.activeElement?.closest(".paper .ProseMirror")`));

// Escape and typing put it away.
await page.key("Escape", "Escape", 27);
await sleep(200);
check("Escape puts it away", !(await page.run(shown)));
await drag("the desk");
await until(shown, 20);
await page.type("X");
await sleep(300);
check("typing over the selection puts it away", !(await page.run(shown)) && (await text()).includes("clears X."));
await page.key("z", "KeyZ", 90, 2);
await sleep(300);
check("and Ctrl+Z brings the words back", (await text()).includes("clears the desk."));

// Shift and the arrows: the bar once they stop.
const caret = await spot("Backups");
await mouse("mouseMoved", caret.x1, caret.y1);
await mouse("mousePressed", caret.x1, caret.y1, 1);
await mouse("mouseReleased", caret.x1, caret.y1);
await sleep(300);
for (let index = 0; index < 7; index += 1) await page.key("ArrowRight", "ArrowRight", 39, 8);
await sleep(80);
check("while Shift and the arrows go on, no bar yet", !(await page.run(shown)));
check("once they stop, it shows", await until(shown, 20));
await page.key("Escape", "Escape", 27);

// Make a note: a name becomes a note, linked; the same name again links to it.
await drag("Zen mode");
await until(shown, 20);
await page.mouse('.selection-bar button[aria-label="Make a note"]', "");
check("Make a note shows a note named by the words, in the panel beside the page", await until(`document.querySelector("aside.pane input.title")?.value === "Zen mode"`));
check("and the words link to it", await page.run(`[...document.querySelectorAll(".paper [data-note-id]")].some((el) => el.textContent === "Zen mode")`));
await sleep(300);
const end = await spot("one chapter.");
await mouse("mouseMoved", end.x2 + 2, end.y2);
await mouse("mousePressed", end.x2 + 2, end.y2, 1);
await mouse("mouseReleased", end.x2 + 2, end.y2);
await sleep(200);
await page.key("Enter", "Enter", 13);
await page.type("The zen mode again.");
await sleep(300);
await drag("zen mode");
await until(shown, 20);
await page.mouse('.selection-bar button[aria-label="Make a note"]', "");
await until(`!!document.querySelector("aside.pane input.title")`);
await sleep(300);
const again = await page.run(`({ title: document.querySelector("aside.pane input.title")?.value, links: [...document.querySelectorAll(".paper [data-note-id]")].map((el) => el.getAttribute("data-note-id")) })`);
check("the same name in other letters links to that note, not a new one", again.title === "Zen mode" && again.links.length === 2 && again.links[0] === again.links[1], JSON.stringify(again));

// A passage becomes a note quoting it, to be named.
await drag("Backups are", "Delete this page");
await until(shown, 20);
await page.mouse('.selection-bar button[aria-label="Make a note"]', "");
await until(`!!document.querySelector("aside.pane blockquote")`);
await sleep(400);
const quoted = await page.run(`(() => { const input = document.querySelector("aside.pane input.title"); return { title: input?.value, focused: document.activeElement === input, quote: document.querySelector("aside.pane blockquote")?.innerText.replace(/\\s+/g, " ").trim() }; })()`);
check("a passage is quoted in a new note, its title ready to be typed over", quoted.title?.endsWith("…") && quoted.focused && quoted.quote.startsWith("Backups are snapshot files") && quoted.quote.endsWith("Delete this page"), JSON.stringify(quoted));

// Find: through the whole book; Ctrl+F takes the selected words too.
await drag("chapters");
await until(shown, 20);
await page.mouse('.selection-bar button[aria-label="Find in this project"]', "");
await until(`document.querySelectorAll(".find-panel .results .hit").length > 0`, 120);
const found = await page.run(`({ query: document.querySelector(".find-panel .field input")?.value, scope: document.querySelector('.find-panel [role=radio][aria-checked=true]')?.textContent.trim(), hits: document.querySelectorAll(".find-panel .results .hit").length })`);
check("Find looks for the words through the whole project", found.query === "chapters" && found.scope === "This project" && found.hits > 0, JSON.stringify(found));
await page.key("Escape", "Escape", 27);
await sleep(300);
await drag("snapshot files");
await sleep(300);
await page.key("f", "KeyF", 70, 2);
await sleep(300);
check("Ctrl+F starts with the selected words, as in Word", (await page.run(`document.querySelector(".find-panel .field input")?.value`)) === "snapshot files");
await page.key("Escape", "Escape", 27);
await sleep(300);

// The title line keeps plain text: only Find.
await drag("Welcome");
await until(shown, 20);
check("on the title line, only Find", JSON.stringify(await buttons()) === JSON.stringify(["Find in this project"]), (await buttons()).join(", "));
await page.key("Escape", "Escape", 27);

// Zen: only the formatting.
await page.click(`.ribbon button[title*="Zen"]`);
await until(`document.querySelector(".app")?.classList.contains("zen")`);
await sleep(1200);
await drag("only here");
await until(shown, 20);
check("in Zen, only the formatting", JSON.stringify(await buttons()) === JSON.stringify(["Bold", "Italic", "Underline", "Highlight"]), (await buttons()).join(", "));
const zenCount = await page.run(`[...document.querySelectorAll(".zen-bar .words, .zenbar .words, [class*='zen'] .words")].map((el) => el.textContent.trim()).find((line) => / of /.test(line)) ?? ""`);
check("and the Zen bar counts the selected words", /^2 of \d+ words$/.test(zenCount), zenCount);
await page.key("Escape", "Escape", 27);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
