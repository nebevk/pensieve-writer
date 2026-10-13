// Checks Forest, the theme asked for on 12 October, and the header from the owner's icon set: Forest is a
// light look of its own, chosen from Home's switch (the five looks in the design's order) and remembered;
// the Basin mark follows the theme, moving on Home but still in Write, in Gentle mode and with Windows'
// animations off; the mark stands over the page's left edge, and Home's two sides are as wide as each other.
// Usage: node --experimental-websocket forest-check.mjs [port]
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
const until = async (expression, tries = 60) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
// Home's large mark, the one that moves, beside the greeting since 13 October; the window bar's is small and still.
const homeMark = () =>
  page.run(`(() => { const img = document.querySelector(".home .hero .glow img"); return img && img.complete && img.naturalWidth > 0 ? img.currentSrc.replace(/^.*\\/brand\\//, "") : "not loaded"; })()`);
const barMark = () =>
  page.run(`(() => { const img = document.querySelector(".home-header .brand img"); return img && img.complete && img.naturalWidth > 0 ? img.currentSrc.replace(/^.*\\/brand\\//, "") : "not loaded"; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", theme: "daylight", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(600);

// The switch: the five looks in the design's order; Forest chosen there is the page's look, and stays.
const order = await page.run(`[...document.querySelectorAll(".home-header .themes button")].map((b) => b.getAttribute("aria-label"))`);
check("Home's switch has the five looks in the design's order", JSON.stringify(order) === JSON.stringify(["Dnevna svetloba", "Sončni zahod", "Ob sveči", "Mesečina", "Gozd"]), JSON.stringify(order));
check("Daylight's mark is the sun over the basin, moving on Home beside the greeting", (await homeMark()) === "pensieve-mark-anim-daylight.svg", await homeMark());
check("and small and still in the window bar", (await barMark()) === "pensieve-mark-daylight.svg", await barMark());
await page.run(`[...document.querySelectorAll(".home-header .themes button")].find((b) => b.getAttribute("aria-label") === "Gozd").click(), true`);
await sleep(900);
const look = await page.run(`(() => {
  const css = getComputedStyle(document.documentElement);
  return { theme: document.documentElement.dataset.theme, chrome: css.getPropertyValue("--pv-chrome").trim(), accent: css.getPropertyValue("--pv-accent").trim(), scheme: css.colorScheme, chosen: document.querySelector(".home-header .themes button.on")?.getAttribute("aria-label") };
})()`);
check("Forest is a look of its own: light, sage and pine", look.theme === "forest" && look.chrome === "#edf0e4" && look.accent === "#3b7349" && look.scheme === "light" && look.chosen === "Gozd", JSON.stringify(look));
check("its mark is the sprout in the basin", await until(`(document.querySelector(".home .hero .glow img")?.currentSrc ?? "").endsWith("pensieve-mark-anim-forest.svg")`) && (await homeMark()) === "pensieve-mark-anim-forest.svg" && (await barMark()) === "pensieve-mark-forest.svg", `${await homeMark()} ${await barMark()}`);
await page.shoot(`${shots}forest-home.png`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(500);
check("and it is remembered", (await page.run(`document.documentElement.dataset.theme`)) === "forest");

// The header: the basin over the page's left edge, and two sides as wide as each other.
const place = await page.run(`(() => {
  const mark = document.querySelector(".home-header .brand img").getBoundingClientRect();
  const left = document.querySelector(".home .left").getBoundingClientRect();
  const right = document.querySelector(".home .right").getBoundingClientRect();
  // The basin starts 13 of the mark's 100 units in.
  return { basin: Math.round((mark.left + mark.width * 0.13) * 10) / 10, page: left.left, size: mark.width, left: Math.round(left.width), right: Math.round(right.width) };
})()`);
check("the window bar's mark is the small one, its basin over the page's left edge", place.size === 22 && Math.abs(place.basin - place.page) <= 1, JSON.stringify(place));
check("Home's two sides are as wide as each other", Math.abs(place.left - place.right) <= 1, JSON.stringify(place));
await page.send("Emulation.setDeviceMetricsOverride", { width: 1536, height: 864, deviceScaleFactor: 1, mobile: false });
await sleep(500);
const wide = await page.run(`[document.querySelector(".home .left").getBoundingClientRect().width, document.querySelector(".home .right").getBoundingClientRect().width].map(Math.round)`);
check("at 1536 wide too", Math.abs(wide[0] - wide[1]) <= 1, JSON.stringify(wide));
await page.send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });

// Still where she types, in Gentle mode, and with Windows' animations off.
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
const writeMark = await page.run(`(() => { const img = document.querySelector(".titlebar .mark img"); return img && img.complete && img.naturalWidth > 0 ? img.getAttribute("src") : "not loaded"; })()`);
check("Write's title bar has Forest's mark, still", writeMark === "/brand/pensieve-mark-forest.svg", writeMark);
await page.click(".titlebar .mark");
await until(`!!document.querySelector(".home-header")`);
await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await sleep(600);
check("with Windows' animations off, Home's mark stands still", (await homeMark()) === "pensieve-mark-forest.svg", await homeMark());
await page.send("Emulation.setEmulatedMedia", { features: [] });
await page.run(`(() => { const prefs = JSON.parse(localStorage.getItem("pensieve-prefs")); prefs.gentle = true; localStorage.setItem("pensieve-prefs", JSON.stringify(prefs)); return true; })()`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .hero .glow img")`);
await sleep(600);
check("and in Gentle mode", (await homeMark()) === "pensieve-mark-forest.svg", await homeMark());

// Settings and the floating bar know it.
await page.click(".gear");
await until(`!!document.querySelector(".window .swatch")`);
await sleep(300);
const cards = await page.run(`[...document.querySelectorAll(".window .swatch")].map((b) => (b.getAttribute("aria-pressed") === "true" ? "*" : "") + b.textContent.trim())`);
check("Settings has a Forest card, chosen", JSON.stringify(cards) === JSON.stringify(["Dnevna svetloba", "Sončni zahod", "Ob sveči", "Mesečina", "*Gozd", "Dan in noč"]), JSON.stringify(cards));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
