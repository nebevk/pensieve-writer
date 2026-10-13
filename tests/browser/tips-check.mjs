// Checks the tutorial tips (owner, 8 October), as a new user meets them at 1366 × 768: a welcome on
// Home, five tips the first time in Write, one in Notes; each points at what it is about and stays in
// the window; the page can be written in meanwhile; "Ne prikazuj več namigov" stops them; Settings
// turns them on and shows them all again. Usage: node tips-check.mjs
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
const page = await connect({ width: 1366, height: 768 });
const until = async (expression, tries = 60) => {
  for (let turn = 0; turn < tries; turn += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
// The tip as she sees it: its words, where it is, and what its ring is around.
const TIP = `(() => {
  const tip = document.querySelector(".tip");
  if (!tip) return null;
  const box = tip.getBoundingClientRect();
  const ring = document.querySelector(".ring")?.getBoundingClientRect();
  return {
    count: tip.querySelector(".count")?.textContent.trim() ?? "",
    title: tip.querySelector("h2")?.textContent.trim() ?? "",
    next: tip.querySelector(".next")?.textContent.trim() ?? "",
    inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
    ring: ring ? { x: Math.round(ring.left + ring.width / 2), y: Math.round(ring.top + 10) } : null,
  };
})()`;
const tip = () => page.run(TIP);
const ringOn = (selector, info) => page.run(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || !${JSON.stringify(info?.ring ?? null)}) return false; const r = el.getBoundingClientRect(); const p = ${JSON.stringify(info?.ring ?? {})}; return p.x >= r.left - 6 && p.x <= r.right + 6 && p.y >= Math.max(r.top, 0) - 6 && p.y <= r.bottom + 6; })()`);
const next = () => page.mouse(".tip .next", "");
const saved = () => page.run(`(({ tips, tipsSeen }) => ({ tips, tipsSeen }))(JSON.parse(localStorage.getItem("pensieve-prefs")))`);

await page.harness({ tips: true });
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);

// Home: a welcome, then where Settings are.
check("a first start welcomes her on Home", await until(`!!document.querySelector(".tip")`, 40));
let info = await tip();
check("the welcome points at Continue writing", info?.title === "Dobrodošli v Pensieve" && info.count === "Namig 1 od 2" && (await ringOn(".home .continue", info)) && info.inside, JSON.stringify(info));
await page.shoot(join(shots, "tips-home.png"), { x: 0, y: 0, width: 1366, height: 768 });
await next();
await sleep(300);
info = await tip();
check("then at Settings, where the tips can be stopped", info?.title === "Nastavitve" && info.next === "Razumem" && (await ringOn(".gear", info)) && info.inside, JSON.stringify(info));
await next();
await sleep(300);
check("Razumem puts the tips away, and Home's are remembered as seen", !(await tip()) && JSON.stringify(await saved()) === JSON.stringify({ tips: true, tipsSeen: ["home"] }), JSON.stringify(await saved()));

// Write: five tips.
await page.mouse(".home .continue .go", "");
check("the first time in Write, its tips come", await until(`document.querySelector(".tip h2")?.textContent.trim() === "Knjižnica in poglavja"`, 40));
const expected = [
  ["Knjižnica in poglavja", ".sidebar"],
  ["Stran", ".paper"],
  ["Orodna vrstica", ".ribbon"],
  ["Spodnja vrstica", ".statusbar"],
  ["Štirje pogledi", ".titlebar .tabs"],
];
const seenSteps = [];
for (const [index, [title, selector]] of expected.entries()) {
  info = await tip();
  seenSteps.push(`${info?.count}: ${info?.title}`);
  const right = info?.title === title && info.count === `Namig ${index + 1} od 5` && info.inside && (await ringOn(selector, info));
  if (!right) console.log("   step", index + 1, JSON.stringify(info));
  results.push(right);
  if (index === 3) await page.shoot(join(shots, "tips-write.png"), { x: 0, y: 0, width: 1366, height: 768 });
  if (index === 1) {
    // The tips leave the page free: she can write while one is open.
    await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`);
    await page.type(" Pišem naprej.");
    await sleep(300);
    check("while a tip is open, the page takes typing", (await page.run(`document.querySelector(".paper .ProseMirror").textContent`)).endsWith("Pišem naprej.") && !!(await tip()));
  }
  await next();
  await sleep(350);
}
console.log("    steps:", seenSteps.join(" | "));
check("Write's five tips each point at their part, in the window", results.slice(-6).every(Boolean));
check("and are remembered as seen", JSON.stringify((await saved()).tipsSeen) === JSON.stringify(["home", "write"]), JSON.stringify(await saved()));

// Coming back to a place doesn't bring its tips again.
await page.clickText(".titlebar [role=tab]", "Oris");
await sleep(500);
await page.clickText(".titlebar [role=tab]", "Pisanje");
await sleep(1200);
check("coming back to Write, no tips again", !(await tip()));

// Notes: one tip; stopping them all.
await page.clickText(".titlebar [role=tab]", "Zapiski");
check("the first time in Notes, its tip comes", await until(`document.querySelector(".tip h2")?.textContent.trim() === "Zapiski"`, 40));
await page.mouse(".tip .stop input", "");
await sleep(150);
await next();
await sleep(300);
check("Ne prikazuj več namigov stops them", JSON.stringify(await saved()) === JSON.stringify({ tips: false, tipsSeen: ["home", "write", "notes"] }), JSON.stringify(await saved()));
await page.clickText(".titlebar [role=tab]", "Knjiga");
await sleep(1500);
check("so the Book's tip doesn't come", !(await tip()));

// Settings: the switch is off; Show the tips again brings them back, here and everywhere.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "Splošno");
await sleep(300);
const toggle = await page.run(`[...document.querySelectorAll(".window .row")].find((row) => row.textContent.includes("Namigi za začetek"))?.querySelector(".toggle")?.getAttribute("aria-checked") ?? "missing"`);
check("Settings → General has the tips' switch, off now", toggle === "false", toggle);
await page.clickText(".window button", "Pokaži namige znova");
await sleep(300);
check("Show the tips again turns them on and forgets where they were seen", JSON.stringify(await saved()) === JSON.stringify({ tips: true, tipsSeen: [] }), JSON.stringify(await saved()));
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
check("closing Settings, the Book's tip comes", await until(`document.querySelector(".tip h2")?.textContent.trim() === "Knjiga"`, 40));
info = await tip();
check("pointing at the Book's bar, in the window", info?.inside && (await ringOn(".book .bar", info)), JSON.stringify(info));
// The close button puts it away too.
await page.mouse(".tip .close", "");
await sleep(300);
check("the × puts it away, and it counts as seen", !(await tip()) && (await saved()).tipsSeen.includes("book"), JSON.stringify(await saved()));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
