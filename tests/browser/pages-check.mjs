// Checks Pages (Settings → Paper, owner 8 October): the text lies on A4 or A5 sheets a desk's width apart,
// no line runs into a margin or the gap, each sheet's text starts at its top margin, the sheets are
// numbered, the breaks follow typing, Zen and the continuous page have no sheets, and undo and the
// arrow keys work across a break. Usage: node pages-check.mjs
import { connect, sleep } from "./cdp.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shots = join(dirname(fileURLToPath(import.meta.url)), "shots");

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const setPrefs = (patch) =>
  page.run(`(() => { const p = JSON.parse(localStorage.getItem("pensieve-prefs")); Object.assign(p, ${JSON.stringify(patch)}); localStorage.setItem("pensieve-prefs", JSON.stringify(p)); return true; })()`);
const page = await connect({ width: 1500, height: 900 });
await page.harness({ keep: true });
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", paper: "pages", paperSize: "a4" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.mouse(".home .continue .go", "");
await sleep(1500);
await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`);
const PARAGRAPH =
  "Čez reko je padal mrak in Špela je štela stopnice, ki so škripale pod njenimi koraki, ena za drugo, dokler ni prišla do vrha, kjer je žarnica brnela kot čebela v kozarcu. ";
for (let index = 0; index < 34; index += 1) {
  await page.key("Enter", "Enter", 13);
  await page.type(`${index + 1}. ${PARAGRAPH.repeat(1 + (index % 3))}`.trim());
}
await sleep(1200);

// Every line of text, and where the sheets are, measured from the top of the first sheet.
const LAYOUT = `(() => {
  const paper = document.querySelector(".paper");
  const origin = paper.getBoundingClientRect().top;
  const leaves = [...document.querySelectorAll(".leaf")].map((leaf) => { const r = leaf.getBoundingClientRect(); return { top: r.top - origin, height: r.height, width: r.width, folio: leaf.textContent.trim() }; });
  const pm = paper.querySelector(".ProseMirror");
  const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
  const lines = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) if (r.width > 1) lines.push({ top: r.top - origin, bottom: r.bottom - origin });
  }
  const gaps = [...pm.querySelectorAll(".page-gap")].map((gap) => gap.getBoundingClientRect().height);
  return { leaves, lines, gaps };
})()`;
const MARGIN = { a4: 94, a5: 76 };
const SIZE = { a4: [794, 1123], a5: [559, 794] };
function verify(layout, size) {
  const [, height] = SIZE[size];
  const pitch = height + 28;
  const margin = MARGIN[size];
  const outside = layout.lines.filter((line) => {
    const sheet = Math.floor(line.top / pitch);
    return line.top < sheet * pitch + margin - 6 || line.bottom > sheet * pitch + height - margin + 6;
  });
  // The first line on each sheet after the first sits at its top margin.
  const firsts = [];
  for (let sheet = 1; sheet < layout.leaves.length; sheet += 1) {
    const first = layout.lines.find((line) => line.top >= sheet * pitch);
    if (first) firsts.push(Math.round(first.top - sheet * pitch));
  }
  return { outside, firsts };
}

let layout = await page.run(LAYOUT);
let v = verify(layout, "a4");
check("the text fills several A4 sheets", layout.leaves.length >= 3, `${layout.leaves.length} sheets, ${layout.gaps.length} breaks`);
check(
  "each sheet is A4, 794 × 1123 px, numbered from 1",
  layout.leaves.every((leaf, index) => Math.round(leaf.width) === 794 && Math.round(leaf.height) === 1123 && leaf.folio === String(index + 1)),
  JSON.stringify(layout.leaves.slice(0, 2)),
);
check("one sheet more than breaks", layout.leaves.length === layout.gaps.length + 1, `${layout.leaves.length} / ${layout.gaps.length}`);
check("no line runs into a margin or the desk between sheets", v.outside.length === 0, JSON.stringify(v.outside.slice(0, 3)));
check("each sheet's text starts at its top margin", v.firsts.every((offset) => Math.abs(offset - MARGIN.a4) <= 6), JSON.stringify(v.firsts));
await page.run(`document.querySelector(".stage").scrollTop = 900, true`);
await page.shoot(join(shots, "pages-a4.png"), { x: 0, y: 0, width: 1500, height: 900 });

// Typing at the top moves the breaks once typing pauses.
const breaksBefore = layout.gaps.length;
await page.run(
  `(() => { const pm = document.querySelector(".paper .ProseMirror"); const p = pm.querySelectorAll("p")[1]; const range = document.createRange(); range.setStart(p.firstChild, 0); range.collapse(true); pm.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(range); return true; })()`,
);
await sleep(200);
for (let index = 0; index < 6; index += 1) {
  await page.type(PARAGRAPH);
  await page.key("Enter", "Enter", 13);
}
await sleep(1200);
layout = await page.run(LAYOUT);
v = verify(layout, "a4");
check("after typing above, still no line in a margin or the gap", v.outside.length === 0, `${layout.gaps.length} breaks (was ${breaksBefore}); ${JSON.stringify(v.outside.slice(0, 2))}`);
check("and each sheet's text starts at its top margin", v.firsts.every((offset) => Math.abs(offset - MARGIN.a4) <= 6), JSON.stringify(v.firsts));

// Undo still steps back while sheets are on.
const COUNT = `({ length: document.querySelector(".paper .ProseMirror").textContent.length, paragraphs: document.querySelectorAll(".paper .ProseMirror > p").length })`;
const before = await page.run(COUNT);
await page.key("z", "KeyZ", 90, 2);
await sleep(300);
const after = await page.run(COUNT);
// The last thing typed was Enter: one Ctrl+Z takes back that new paragraph, and only that.
check("Ctrl+Z works on sheets, a step at a time", after.paragraphs === before.paragraphs - 1 && after.length === before.length, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await page.key("y", "KeyY", 89, 2);
await sleep(1200);

// The arrow keys go over a break: from the last line of the first sheet to the first of the second.
const caret = await page.run(`(() => {
  const pm = document.querySelector(".paper .ProseMirror");
  const origin = document.querySelector(".paper").getBoundingClientRect().top;
  const gap = pm.querySelector(".page-gap");
  const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (gap.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) break;
    if (node.textContent.length) last = node;
  }
  const range = document.createRange();
  range.setStart(last, Math.max(0, last.textContent.length - 3));
  range.collapse(true);
  pm.focus();
  const s = getSelection(); s.removeAllRanges(); s.addRange(range);
  return Math.round(range.getBoundingClientRect().top - origin);
})()`);
await page.key("ArrowDown", "ArrowDown", 40);
await sleep(300);
const below = await page.run(
  `(() => { const origin = document.querySelector(".paper").getBoundingClientRect().top; const r = getSelection().getRangeAt(0).getBoundingClientRect(); return Math.round(r.top - origin); })()`,
);
check("the down arrow goes from the first sheet's last line to the second's first", caret < 1123 && below > 1151 && below < 1151 + 94 + 40, `${caret} → ${below}`);

// Backspace at the start of the second sheet keeps the break: the text doesn't jump up a sheet.
await page.key("Home", "Home", 36);
await sleep(100);
const gapsBefore = await page.run(`document.querySelectorAll(".paper .page-gap").length`);
await page.key("Backspace", "Backspace", 8);
await sleep(60);
// Where the first text after the first break lies (the caret beside a break has no box of its own).
const rightAfter = await page.run(`(() => {
  const origin = document.querySelector(".paper").getBoundingClientRect().top;
  const pm = document.querySelector(".paper .ProseMirror");
  const gap = pm.querySelector(".page-gap");
  const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
  let next = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent.trim() && gap.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) { next = node; break; }
  }
  const range = document.createRange();
  range.setStart(next, 0);
  range.setEnd(next, 1);
  return { gaps: pm.querySelectorAll(".page-gap").length, line: Math.round(range.getBoundingClientRect().top - origin) };
})()`);
check("Backspace at a sheet's first line keeps the break until the pass", rightAfter.gaps === gapsBefore && rightAfter.line > 1151 && rightAfter.line < 1151 + 94 + 40, `${gapsBefore} → ${JSON.stringify(rightAfter)}`);
await sleep(1000);

// A pass that finds the same breaks only sets their heights: the breaks (and the lines) aren't drawn again.
await page.run(`[...document.querySelectorAll(".paper .page-gap")].forEach((gap, index) => (gap.dataset.seen = String(index))), true`);
await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`);
await page.type(" Še ena.");
await sleep(1000);
const kept = await page.run(`({ gaps: document.querySelectorAll(".paper .page-gap").length, seen: document.querySelectorAll(".paper .page-gap[data-seen]").length })`);
check("typing on the last sheet leaves the breaks before it as they were", kept.gaps > 0 && kept.seen === kept.gaps, JSON.stringify(kept));
layout = await page.run(LAYOUT);
v = verify(layout, "a4");
check("and still no line in a margin or the gap", v.outside.length === 0 && v.firsts.every((offset) => Math.abs(offset - MARGIN.a4) <= 6), JSON.stringify({ outside: v.outside.slice(0, 2), firsts: v.firsts }));

// A5: smaller sheets, more of them.
const a4Sheets = layout.leaves.length;
await setPrefs({ paperSize: "a5" });
await sleep(2500);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.mouse(".home .continue .go", "");
await sleep(2000);
layout = await page.run(LAYOUT);
v = verify(layout, "a5");
check(
  "A5 sheets are 559 × 794 px, more of them",
  layout.leaves.length > 0 && layout.leaves.every((leaf) => Math.round(leaf.width) === 559 && Math.round(leaf.height) === 794) && layout.leaves.length > a4Sheets,
  `${layout.leaves.length} sheets (A4 had ${a4Sheets})`,
);
check(
  "on A5 too, no line in a margin or the gap, and each sheet starts at its top margin",
  v.outside.length === 0 && v.firsts.every((offset) => Math.abs(offset - MARGIN.a5) <= 6),
  JSON.stringify({ outside: v.outside.slice(0, 2), firsts: v.firsts.slice(0, 6) }),
);
await page.run(`document.querySelector(".stage").scrollTop = 600, true`);
await page.shoot(join(shots, "pages-a5.png"), { x: 0, y: 0, width: 1500, height: 900 });

// Zen is one continuous page.
await page.mouse(".statusbar button.with-icon", "Zen");
await sleep(1500);
const zen = await page.run(
  `({ zen: !!document.querySelector(".app.zen"), leaves: document.querySelectorAll(".leaf").length, gaps: document.querySelectorAll(".paper .page-gap").length })`,
);
check("Zen has no sheets and no breaks", zen.zen && zen.leaves === 0 && zen.gaps === 0, JSON.stringify(zen));
await page.key("Escape", "Escape", 27);
await sleep(800);

// The continuous page has none either.
await setPrefs({ paper: "continuous" });
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.mouse(".home .continue .go", "");
await sleep(1500);
const continuous = await page.run(`({ leaves: document.querySelectorAll(".leaf").length, gaps: document.querySelectorAll(".paper .page-gap").length })`);
check("the continuous page has no sheets and no breaks", continuous.leaves === 0 && continuous.gaps === 0, JSON.stringify(continuous));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
