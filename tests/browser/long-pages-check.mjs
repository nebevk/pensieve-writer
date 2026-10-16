// Checks, with Windows animations off, the long test book on sheets (owner, 8 October: the pages flickered once): after a chapter opens,
// the breaks settle, then stay put while she does nothing, scrolls, or switches chapters and back; no
// line runs into a margin. Usage: node long-pages-check.mjs
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const page = await connect({ width: 1536, height: 864 });
// Windows with animations turned off (owner, 8 October: the flicker came from there).
await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const until = async (expression, tries = 120) => {
  for (let turn = 0; turn < tries; turn += 1) {
    if (await page.run(expression)) return true;
    await sleep(500);
  }
  return false;
};
await page.harness();
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", paper: "pages", paperSize: "a4" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".gear");
await sleep(800);
await page.clickText("nav button, [role=tab]", "General");
await sleep(500);
await page.clickText(".window button", "long test book");
check("the long test book is written", await until(`document.body.innerText.includes("The long test book is on Home.")`));
await page.key("Escape", "Escape", 27);
await sleep(800);
await page.clickText(".project", "Long test book");
await until(`(document.querySelector(".home .continue")?.innerText ?? "").length > 0 && /Long test book/.test(document.querySelector(".home")?.innerText ?? "")`, 60);
await sleep(800);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror") && document.querySelectorAll(".leaf").length > 1`, 60);
await sleep(2500);

// Watch every change to the breaks: new ones, and new heights for the ones there.
await page.run(`(() => {
  window.__PV_GAPS__ = { fresh: 0, resized: 0, leaves: 0 };
  const seen = new WeakSet([...document.querySelectorAll(".page-gap")]);
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target.classList?.contains("page-gap") && record.attributeName === "style") window.__PV_GAPS__.resized += 1;
      for (const node of record.addedNodes) {
        if (node.classList?.contains("page-gap") && !seen.has(node)) { seen.add(node); window.__PV_GAPS__.fresh += 1; }
        if (node.classList?.contains("leaf")) window.__PV_GAPS__.leaves += 1;
      }
    }
  }).observe(document.querySelector(".app") ?? document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
  return true;
})()`);
const counts = () => page.run(`({ ...window.__PV_GAPS__ })`);
const reset = () => page.run(`(window.__PV_GAPS__ = { fresh: 0, resized: 0, leaves: 0 }), true`);
const sheets = await page.run(`({ leaves: document.querySelectorAll(".leaf").length, gaps: document.querySelectorAll(".paper .page-gap").length, words: document.querySelector(".paper .ProseMirror").innerText.split(/\\s+/).length })`);
console.log("open chapter:", JSON.stringify(sheets));
await sleep(5000);
const idle = await counts();
check("doing nothing for 5 s, the breaks stay put", idle.fresh === 0 && idle.resized === 0 && idle.leaves === 0, JSON.stringify(idle));

await reset();
for (let step = 0; step < 20; step += 1) {
  await page.run(`document.querySelector(".stage").scrollTop += 600, true`);
  await sleep(150);
}
await sleep(1500);
const scrolled = await counts();
check("scrolling through the chapter, the breaks stay put", scrolled.fresh === 0 && scrolled.resized === 0 && scrolled.leaves === 0, JSON.stringify(scrolled));

// Another chapter and back: one settling pass each, then quiet.
const names = await page.run(`[...document.querySelectorAll(".sidebar .chapter-list li:not(.part) .name")].map((el) => el.textContent.trim())`);
await page.clickText(".sidebar .views button", "Chapters");
await sleep(400);
const openChapter = (name) => page.run(`(() => { const el = [...document.querySelectorAll(".sidebar li:not(.part) button")].find((b) => b.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)}); if (!el) return "missing"; el.click(); return "ok"; })()`);
const others = (await page.run(`[...document.querySelectorAll(".sidebar .chapter-list li:not(.part) .name")].map((el) => el.textContent.trim())`)) ?? names;
console.log("chapters:", others.length);
await openChapter(others[1]);
await sleep(3000);
await openChapter(others[0]);
await sleep(3000);
await page.run(`(() => { const seen = new WeakSet([...document.querySelectorAll(".page-gap")]); window.__PV_SEEN__ = seen; return true; })()`);
await reset();
await sleep(4000);
const back = await counts();
check("after switching chapters and back, the breaks settle and stay put", back.fresh === 0 && back.resized === 0, JSON.stringify(back));

// A key that leaves its paragraph as tall, in one no sheet ends in, moves no break: the page isn't measured again
// (ARCH-9). A new line in it is, and the breaks after it follow (the margins are checked at the end).
const placed = await page.run(`(() => {
  const pm = document.querySelector(".paper .ProseMirror");
  const paragraph = [...pm.querySelectorAll(":scope > p")].filter((p) => !p.querySelector(".page-gap") && p.textContent.length > 120)[8];
  if (!paragraph) return false;
  paragraph.scrollIntoView({ block: "center" });
  const range = document.createRange();
  range.setStart(document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode(), 10);
  range.collapse(true);
  pm.focus();
  getSelection().removeAllRanges();
  getSelection().addRange(range);
  return true;
})()`);
await sleep(1500);
await reset();
await page.type("a");
await sleep(150);
await page.key("Backspace", "Backspace", 8);
await sleep(1500);
const still = await counts();
check("a key that leaves its paragraph as tall has the page measured again not at all", placed && still.fresh === 0 && still.resized === 0, JSON.stringify(still));
await reset();
await page.type(" Nova vrstica, ki se razlije čez rob in doda v odstavek še eno, dve vrsti besedila, zato se vse pod njo premakne nižje.");
await sleep(1500);
const grown = await counts();
check("a new line in it has the breaks after it measured again", grown.resized > 0, JSON.stringify(grown));

// A text that keeps changing size by itself (owner, 8 October: flicker twice a second) is measured at
// most three times, then left alone until the next edit.
await page.run(`(() => {
  window.__PV_PASSES__ = 0;
  new MutationObserver((records) => {
    // One batch of changes to the breaks is one pass (they are all made in one go).
    if (records.some((r) => r.type === "attributes" && r.target.classList?.contains("page-gap"))) window.__PV_PASSES__ += 1;
  }).observe(document.querySelector(".paper .ProseMirror"), { subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  const pm = document.querySelector(".paper .ProseMirror");
  let on = false;
  const host = document.querySelector(".paper .editor-host");
  window.__PV_RESTLESS__ = setInterval(() => { on = !on; host.style.letterSpacing = on ? "0.02em" : ""; }, 450);
  return true;
})()`);
await sleep(5000);
await page.run(`clearInterval(window.__PV_RESTLESS__), document.querySelector(".paper .editor-host").style.letterSpacing = "", true`);
const restless = await page.run(`window.__PV_PASSES__`);
check("a text that keeps changing size by itself is measured at most three times", restless >= 1 && restless <= 3, `${restless} passes in 5 s`);
await sleep(800);
// An edit lets the breaks follow again.
await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`);
await page.run(`window.__PV_PASSES__ = 0, true`);
await page.type(" Še ena.");
await sleep(1200);
check("and the next edit has the breaks follow again", (await page.run(`window.__PV_PASSES__`)) >= 1, String(await page.run(`window.__PV_PASSES__`)));

// And the sheets are right: no line in a margin or between sheets.
const outside = await page.run(`(() => {
  const paper = document.querySelector(".paper");
  const origin = paper.getBoundingClientRect().top;
  const pitch = 1123 + 28;
  const pm = paper.querySelector(".ProseMirror");
  const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
  const bad = [];
  let lines = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width <= 1) continue;
      lines += 1;
      const top = r.top - origin, bottom = r.bottom - origin;
      const sheet = Math.floor(top / pitch);
      if (top < sheet * pitch + 94 - 6 || bottom > sheet * pitch + 1123 - 94 + 6) bad.push(Math.round(top));
    }
  }
  return { lines, bad: bad.slice(0, 5), count: bad.length };
})()`);
check("no line runs into a margin or between sheets", outside.count === 0 && outside.lines > 100, JSON.stringify(outside));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
