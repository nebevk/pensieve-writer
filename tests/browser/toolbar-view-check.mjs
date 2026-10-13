// Checks the toolbar's View group (owner, 8 October): the paper (continuous, A4 or A5 sheets) and Zen
// in the full and the short toolbar, and the full toolbar in one row at the widths Eva's HP ProBook
// 650 G2 gives (1366, or 1536 at 125%), folding its alignments into a menu. Usage: node toolbar-view-check.mjs
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
const pickPaper = (page, value) =>
  page.run(`(() => { const select = document.querySelector(".ribbon select.paper-pick"); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const saved = (page) => page.run(`(({ paper, paperSize }) => ({ paper, paperSize }))(JSON.parse(localStorage.getItem("pensieve-prefs")))`);

async function opened(width, prefs) {
  const page = await connect({ width, height: 820 });
  await page.harness();
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", ${JSON.stringify(JSON.stringify(prefs))}), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  await page.mouse(".home .continue .go", "");
  await sleep(1500);
  return page;
}

for (const width of [1366, 1536]) {
  const page = await opened(width, { uiLanguage: "sl" });
  const bar = await page.run(`(() => { const r = document.querySelector(".ribbon"); const tops = new Set([...r.querySelectorAll(":scope > .group")].map((g) => Math.round(g.getBoundingClientRect().top))); return { height: Math.round(r.getBoundingClientRect().height), rows: tops.size, aligns: [...r.querySelectorAll(".aligns .tool")].filter((b) => b.offsetParent).length, menu: !!r.querySelector(".align-fold .align-wrap")?.offsetParent }; })()`);
  check(`at ${width} px the full toolbar is one row, its alignments in one menu`, bar.rows === 1 && bar.height < 70 && bar.aligns === 0 && bar.menu, JSON.stringify(bar));
  await page.shoot(join(shots, `toolbar-${width}.png`), { x: 0, y: 0, width, height: 110 });
  page.close();
  await sleep(300);
}

// The full toolbar: the paper chosen there, and Zen.
let page = await opened(1536, { uiLanguage: "sl" });
const shown = await page.run(`(() => { const select = document.querySelector(".ribbon select.paper-pick"); return { value: select.value, label: select.selectedOptions[0].textContent.trim(), group: select.closest(".group").querySelector("p").textContent.trim() }; })()`);
check("the View group shows the continuous page", shown.value === "continuous" && shown.label === "Neprekinjen" && shown.group === "Pogled", JSON.stringify(shown));
await pickPaper(page, "a5");
await sleep(1200);
const a5 = await page.run(`({ leaves: document.querySelectorAll(".leaf").length, width: Math.round(document.querySelector(".leaf")?.getBoundingClientRect().width ?? 0) })`);
check("choosing A5 pages there puts the text on A5 sheets, and Settings keeps it", a5.leaves > 0 && a5.width === 559 && JSON.stringify(await saved(page)) === JSON.stringify({ paper: "pages", paperSize: "a5" }), JSON.stringify({ ...a5, saved: await saved(page) }));
await pickPaper(page, "continuous");
await sleep(600);
check("and Neprekinjen takes it back to one page, keeping A5 for next time", (await page.run(`document.querySelectorAll(".leaf").length`)) === 0 && JSON.stringify(await saved(page)) === JSON.stringify({ paper: "continuous", paperSize: "a5" }), JSON.stringify(await saved(page)));
await page.mouse(".ribbon .group.last button[title='Zen']", "");
await sleep(1200);
check("the toolbar's Zen button opens Zen", await page.run(`!!document.querySelector(".app.zen")`));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
await sleep(300);

// The short toolbar has them too.
page = await opened(1366, { uiLanguage: "sl", toolsExpanded: false });
const short = await page.run(`(() => { const r = document.querySelector(".ribbon"); return { select: !!r.querySelector("select.paper-pick"), zen: !!r.querySelector("button[title='Zen']"), height: Math.round(r.getBoundingClientRect().height) }; })()`);
check("the short toolbar has the paper and Zen, in one row", short.select && short.zen && short.height <= 41, JSON.stringify(short));
await pickPaper(page, "a4");
await sleep(1200);
check("choosing A4 pages there puts the text on A4 sheets", (await page.run(`Math.round(document.querySelector(".leaf")?.getBoundingClientRect().width ?? 0)`)) === 794);
await page.shoot(join(shots, "toolbar-short-1366.png"), { x: 0, y: 0, width: 1366, height: 90 });
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
