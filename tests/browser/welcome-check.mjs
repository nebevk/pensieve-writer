// Checks the welcome (owner, 13 October), as a new user meets it at 1366 × 768: three steps over Home the
// first time Pensieve opens, each with the owner's picture for the look on now; the last picks the look,
// which changes at once; then the tips. It isn't shown again, nor to someone whose settings are kept from
// before. Usage: node welcome-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1366, height: 768 });
await page.harness({ tips: true });
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
// The window as she sees it: its heading, its picture (and whether it is drawn), its buttons and dots.
const shown = () =>
  page.run(`(() => {
    const win = document.querySelector(".welcome")?.closest(".window");
    if (!win) return null;
    const art = win.querySelector("img.art");
    return {
      heading: win.querySelector("h2")?.textContent.trim() ?? "",
      art: art?.getAttribute("src") ?? "",
      drawn: !!art && art.complete && art.naturalWidth > 0,
      buttons: [...win.querySelectorAll("footer button")].map((el) => el.textContent.trim()),
      dot: [...win.querySelectorAll(".dots span")].findIndex((el) => el.classList.contains("on")),
      looks: [...win.querySelectorAll(".looks button")].map((el) => (el.getAttribute("aria-checked") === "true" ? "*" : "") + el.textContent.trim()),
      inside: (() => { const box = win.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth; })(),
    };
  })()`);
const press = (label) => page.run(`(() => { const el = [...document.querySelectorAll(".window footer button")].find((b) => b.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const saved = () => page.run(`JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}")`);

// A first start: nothing kept from before.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
check("a first start opens the welcome over Home", await until(`!!document.querySelector(".welcome")`, 40));
await until(`document.querySelector(".welcome img.art")?.complete && document.querySelector(".welcome img.art").naturalWidth > 0`, 40);
let info = await shown();
check(
  "step 1: the scene and a welcome, in Slovenian",
  info?.heading === "Dobrodošli v Pensieve" && info.art === "/art/onboarding/onboarding-1-daylight.svg" && info.drawn && info.dot === 0 && JSON.stringify(info.buttons) === JSON.stringify(["Preskoči", "Naprej"]) && info.inside,
  JSON.stringify(info),
);
check("the tips wait while it is open", !(await page.run(`!!document.querySelector(".tip")`)));
await page.shoot(`${shots}welcome-1.png`);

await press("Naprej");
await sleep(400);
info = await shown();
check(
  "step 2: a page above the basin, her writing and its notes",
  info?.heading === "Vaše pisanje in zapiski" && info.art === "/art/onboarding/onboarding-2-daylight.svg" && info.dot === 1 && JSON.stringify(info.buttons) === JSON.stringify(["Preskoči", "Nazaj", "Naprej"]),
  JSON.stringify(info),
);
await press("Nazaj");
await sleep(300);
check("Nazaj goes back a step", (await shown())?.dot === 0);
await press("Naprej");
await sleep(200);
await press("Naprej");
await sleep(400);
info = await shown();
check(
  "step 3: the five looks, the one on now marked",
  info?.heading === "Izberite videz" && info.art === "/art/onboarding/onboarding-3-daylight.svg" && JSON.stringify(info.looks) === JSON.stringify(["*Dnevna svetloba", "Sončni zahod", "Ob sveči", "Mesečina", "Gozd"]) && JSON.stringify(info.buttons) === JSON.stringify(["Nazaj", "Začni pisati"]),
  JSON.stringify(info),
);

// A look picked changes at once, the picture too.
await page.run(`[...document.querySelectorAll(".welcome .looks button")].find((el) => el.textContent.includes("Mesečina")).click(), true`);
check("a look picked changes at once", await until(`document.documentElement.dataset.theme === "moonlit"`, 40), await page.run(`document.documentElement.dataset.theme`));
await until(`document.querySelector(".welcome img.art")?.getAttribute("src")?.includes("moonlit") && document.querySelector(".welcome img.art").naturalWidth > 0`, 40);
info = await shown();
check("its picture and mark follow", info?.art === "/art/onboarding/onboarding-3-moonlit.svg" && info.drawn && info.looks[3] === "*Mesečina", JSON.stringify(info));
await page.shoot(`${shots}welcome-3.png`);

// Done: the tips follow, and it is remembered.
await press("Začni pisati");
check("Začni pisati closes it", await until(`!document.querySelector(".welcome")`, 20));
check("then the tips, beginning with Home", await until(`document.querySelector(".tip h2")?.textContent.trim() === "To je domača stran"`, 40), await page.run(`document.querySelector(".tip h2")?.textContent ?? ""`));
const after = await saved();
check("the look and the welcome are kept", after.theme === "moonlit" && after.welcomed === true, JSON.stringify({ theme: after.theme, welcomed: after.welcomed }));
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(1500);
check("it isn't shown again", !(await page.run(`!!document.querySelector(".welcome")`)));

// Escape, in English, counts as done; settings from before the welcome never see it.
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", welcomed: false })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".welcome")`, 40);
info = await shown();
check("in English", info?.heading === "Welcome to Pensieve" && JSON.stringify(info.buttons) === JSON.stringify(["Skip", "Next"]), JSON.stringify(info));
await page.key("Escape", "Escape", 27);
check("Escape closes it for good", (await until(`!document.querySelector(".welcome")`, 20)) && (await saved()).welcomed === true);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", tipsSeen: ["home"] })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(1500);
check("settings kept from before mean she knows Pensieve: no welcome", !(await page.run(`!!document.querySelector(".welcome")`)));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
