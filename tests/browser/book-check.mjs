// Checks the Book view as a printed book (owner, 8 October): facing pages with page 1 on the right, the
// narrower margin at the spine, the text flowing from page to page without running past a page or
// losing a word, each chapter opening a new page, running heads and page numbers, and the 5 × 8 in size.
// Usage: node book-check.mjs
import { connect, sleep } from "./cdp.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shots = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 60) => {
  for (let turn = 0; turn < tries; turn += 1) {
    if (await page.run(expression)) return true;
    await sleep(250);
  }
  return false;
};
const page = await connect({ width: 1500, height: 900 });
await page.harness();
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.mouse(".home .continue .go", "");
await sleep(1500);
await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`);
const PARAGRAPH =
  "Čez reko je padal mrak in Špela je štela stopnice, ki so škripale pod njenimi koraki, ena za drugo, dokler ni prišla do vrha, kjer je žarnica brnela kot čebela v kozarcu. ";
for (let index = 0; index < 30; index += 1) {
  await page.key("Enter", "Enter", 13);
  await page.type(`${index + 1}. ${PARAGRAPH.repeat(1 + (index % 4))}`.trim());
}
await sleep(2600);
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const written = await page.run(`document.querySelector(".paper .ProseMirror").innerText`);
const title = await page.run(`document.querySelector(".titlebar .book-name, .titlebar .title, .titlebar")?.innerText ?? ""`);

await page.clickText("[role=tab]", "Knjiga");
check("the Book view lays its pages out", await until(`!!document.querySelector(".book[data-laid-out]")`));
await sleep(300);
const LAYOUT = `(() => {
  const spreads = [...document.querySelectorAll(".book .spread")].map((spread) => [...spread.children].map((child) => child.classList.contains("blank") ? "blank" : child.classList.contains("verso") ? "verso" : "recto"));
  const pages = [...document.querySelectorAll(".book .page:not(.blank)")].map((sheet) => {
    const box = sheet.getBoundingClientRect();
    const text = sheet.querySelector(".text");
    const area = text.getBoundingClientRect();
    let deepest = area.top;
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 0) deepest = Math.max(deepest, r.bottom);
    }
    return {
      side: sheet.classList.contains("verso") ? "verso" : "recto",
      width: Math.round(box.width), height: Math.round(box.height),
      left: Math.round(area.left - box.left), right: Math.round(box.right - area.right),
      overflow: Math.round(deepest - area.bottom),
      head: sheet.querySelector(".head")?.textContent.trim() ?? null,
      folio: sheet.querySelector(".folio")?.textContent.trim(),
      opening: !!text.querySelector(".chapter-title"),
      text: text.innerText,
    };
  });
  return { spreads, pages, continued: document.querySelectorAll(".book p.continued").length, split: document.querySelectorAll(".book p.split").length };
})()`;
let book = await page.run(LAYOUT);
const mm = (value) => Math.round((value * 96) / 25.4);
check("the text fills several pages", book.pages.length >= 4, `${book.pages.length} pages`);
check("page 1 stands alone on the right, then each left page faces a right one", book.spreads[0]?.join() === "blank,recto" && book.spreads.slice(1).every((spread) => spread[0] === "verso"), JSON.stringify(book.spreads.slice(0, 3)));
check("each page is A5", book.pages.every((sheet) => sheet.width === mm(148) && sheet.height === mm(210)), `${book.pages[0].width} × ${book.pages[0].height}`);
check(
  "the narrower margin is at the spine: inside on the right of a left page, on the left of a right page",
  book.pages.every((sheet) => (sheet.side === "verso" ? sheet.left === mm(22) && sheet.right === mm(15) : sheet.left === mm(15) && sheet.right === mm(22))),
  JSON.stringify(book.pages.slice(0, 2).map(({ side, left, right }) => ({ side, left, right }))),
);
check("no page's text runs past its text block", book.pages.every((sheet) => sheet.overflow <= 1), JSON.stringify(book.pages.map((sheet) => sheet.overflow)));
check("the pages are numbered in order", book.pages.every((sheet, index) => sheet.folio === String(index + 1)), book.pages.map((sheet) => sheet.folio).join(","));
check("a paragraph goes on from one page to the next", book.continued > 0 && book.continued === book.split, `${book.split} split, ${book.continued} continued`);
const openings = book.pages.filter((sheet) => sheet.opening);
check("each chapter opens a new page, with no running head", openings.length === 2 && openings.every((sheet) => sheet.head === null), JSON.stringify(openings.map((sheet) => sheet.folio)));
const heads = book.pages.filter((sheet) => !sheet.opening);
check(
  "running heads: the book's title over left pages, the chapter's over right ones",
  heads.length > 0 && heads.every((sheet) => (sheet.side === "verso" ? sheet.head.length > 0 && title.includes(sheet.head) : sheet.head === "Dobrodošli")),
  JSON.stringify(heads.slice(0, 2).map(({ side, head }) => ({ side, head }))),
);
const inBook = book.pages.reduce((sum, sheet) => sum + words(sheet.text), 0);
check("no word is lost or doubled between pages", inBook === words(written) + words("Poglavje 1"), `${inBook} in the book, ${words(written)} + 2 written`);
await page.run(`document.querySelector(".book").scrollTop = 0, true`);
await page.shoot(join(shots, "book-a5.png"), { x: 0, y: 0, width: 1500, height: 900 });
await page.run(`document.querySelector(".book").scrollTop = 1700, true`);
await page.shoot(join(shots, "book-a5-split.png"), { x: 0, y: 0, width: 1500, height: 900 });

// The 5 × 8 in paperback.
await page.run(`(() => { const select = document.querySelector(".book .bar select"); select.value = "pocket"; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
await sleep(300);
check("the paperback size lays out again", await until(`!!document.querySelector(".book[data-laid-out]")`));
await sleep(300);
book = await page.run(LAYOUT);
check("its pages are 5 × 8 in, and nothing runs past them", book.pages.every((sheet) => sheet.width === mm(127) && sheet.height === mm(203.2) && sheet.overflow <= 1), `${book.pages.length} pages, ${book.pages[0].width} × ${book.pages[0].height}`);
check("and no word is lost", book.pages.reduce((sum, sheet) => sum + words(sheet.text), 0) === words(written) + 2);
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
