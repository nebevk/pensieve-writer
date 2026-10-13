// Photographs the Sunset theme: Home, Write with the library beside the page, and Settings' theme cards,
// and checks that it is the Sunset look, light, with its own colours. Usage: node sunset-look.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1400, height: 860 });
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

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", theme: "dusk", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(800);
const look = await page.run(`(() => {
  const css = getComputedStyle(document.documentElement);
  return { theme: document.documentElement.dataset.theme, chrome: css.getPropertyValue("--pv-chrome").trim(), accent: css.getPropertyValue("--pv-accent").trim(), scheme: css.colorScheme, body: getComputedStyle(document.body).backgroundColor };
})()`);
check("Sunset is a look of its own: light, with its own colours", look.theme === "dusk" && look.chrome === "#f6e6d8" && look.accent === "#a8392d" && look.scheme === "light", JSON.stringify(look));
await page.shoot(`${shots}sunset-home.png`);
const homeSwitch = await page.run(`[...document.querySelectorAll(".themes button")].map((b) => (b.classList.contains("on") ? "*" : "") + b.getAttribute("title"))`);
check("Home's theme switch has Sunset, chosen", homeSwitch.includes("*Sončni zahod"), JSON.stringify(homeSwitch));
// The window bar's mark is small and still, and the large one moves beside the greeting (since 13 October).
const mark = await page.run(`(() => { const src = (sel) => { const img = document.querySelector(sel); return img && img.complete && img.naturalWidth > 0 ? img.getAttribute("src") : "not loaded"; }; return src(".home-header .brand img") + " " + src(".home .hero .glow img"); })()`);
check("the marks are Sunset's own, the sun over the basin (since 12 October)", mark === "/brand/pensieve-mark-sunset.svg /brand/pensieve-mark-anim-sunset.svg", mark);

await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(900);
await page.shoot(`${shots}sunset-write.png`);

await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await sleep(300);
await page.clickText(".window nav button, .window [role=tab]", "Videz");
await sleep(500);
const cards = await page.run(`[...document.querySelectorAll(".window .swatch")].map((b) => (b.getAttribute("aria-pressed") === "true" ? "*" : "") + b.textContent.trim())`);
check("Settings offers Sunset beside the others, and Day and night", JSON.stringify(cards) === JSON.stringify(["Dnevna svetloba", "*Sončni zahod", "Ob sveči", "Mesečina", "Gozd", "Dan in noč"]), JSON.stringify(cards));
await page.shoot(`${shots}sunset-settings.png`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
