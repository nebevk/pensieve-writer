// Checks the writing bar's looks and sounds (owner, 13 October): the five looks as icons, the chosen one
// lit; the sound's icon and name, opening a panel of every sound and its volume; a keyboard for the keys'
// sound, lit while they sound, opening a panel of their kinds and volume; Escape and a click elsewhere close
// a panel; the choices are kept. Usage: node --experimental-websocket bar-check.mjs [port]
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
const prefs = () => page.run(`JSON.parse(localStorage.getItem("pensieve-prefs"))`);
const looks = () => page.run(`[...document.querySelectorAll(".statusbar .looks button")].map((b) => (b.getAttribute("aria-checked") === "true" ? "*" : "") + b.getAttribute("aria-label"))`);
const click = (selector) => page.run(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el?.click(); return !!el; })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".statusbar .looks")`);
await sleep(600);

check("the bar has the five looks as icons, the chosen one lit", JSON.stringify(await looks()) === JSON.stringify(["*Dnevna svetloba", "Sončni zahod", "Ob sveči", "Mesečina", "Gozd"]), JSON.stringify(await looks()));
await click('.statusbar .looks button[aria-label="Gozd"]');
await sleep(500);
check("an icon changes the look, and it is kept", (await page.run(`document.documentElement.dataset.theme`)) === "forest" && (await prefs()).theme === "forest" && (await looks())[4] === "*Gozd");
await page.shoot(`${shots}bar-forest.png`, { x: 300, y: 690, width: 900, height: 78 });

// The sound: its icon and name; the panel has every sound and the volume.
check("the sound says Tišina, with its icon", (await page.run(`document.querySelector(".statusbar .sound")?.textContent.trim()`)) === "Tišina" && (await page.run(`!!document.querySelector(".statusbar .sound svg")`)));
await click(".statusbar .sound");
await until(`!!document.querySelector(".statusbar .pop")`);
const sounds = await page.run(`[...document.querySelectorAll(".statusbar .pop .choice")].map((b) => (b.getAttribute("aria-pressed") === "true" ? "*" : "") + b.getAttribute("aria-label"))`);
check("its panel has every sound as an icon, and the volume", JSON.stringify(sounds) === JSON.stringify(["*Tišina", "Dež", "Kamin", "Kavarna", "Klavir"]) && (await page.run(`document.querySelector(".statusbar .pop input[type=range]")?.value`)) === "0.1", JSON.stringify(sounds));
await page.shoot(`${shots}bar-sound.png`, { x: 300, y: 520, width: 900, height: 248 });
await click('.statusbar .pop .choice[aria-label="Dež"]');
await sleep(300);
check("a sound chosen there plays and is said in the bar", (await prefs()).ambience === "rain" && (await page.run(`document.querySelector(".statusbar .sound")?.textContent.trim()`)) === "Dež");
await page.run(`(() => { const input = document.querySelector(".statusbar .pop input[type=range]"); input.value = "0.4"; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await sleep(300);
check("the volume slider sets the volume", (await prefs()).ambienceVolume === 0.4 && (await page.run(`document.querySelector(".statusbar .pop .level")?.textContent.trim()`)) === "40");
await page.run(`document.querySelector(".statusbar .pop .choice").focus(), true`);
await page.key("Escape", "Escape", 27);
check("Escape closes the panel", await until(`!document.querySelector(".statusbar .pop")`, 10));

// The keys' sound: a keyboard; its panel has the kinds and their volume.
check("the keyboard is dark while the keys are quiet", !(await page.run(`document.querySelector(".statusbar .keys").classList.contains("playing")`)));
await click(".statusbar .keys");
await until(`!!document.querySelector(".statusbar .pop")`);
const kinds = await page.run(`[...document.querySelectorAll(".statusbar .pop .row")].map((b) => (b.getAttribute("aria-pressed") === "true" ? "*" : "") + b.textContent.trim())`);
check("its panel has the kinds of key sound, and their volume, which waits while they are off", JSON.stringify(kinds) === JSON.stringify(["*Izklopljeno", "Pisalni stroj", "Mehanska tipkovnica", "Mehka tipkovnica"]) && (await page.run(`document.querySelector(".statusbar .pop input[type=range]").disabled`)), JSON.stringify(kinds));
// The chosen kind is lit and ticked: in Daylight the bar's warm colour alone hid it (owner, 19 October).
await page.run(`document.documentElement.dataset.theme = "daylight", true`);
const marks = await page.run(`[...document.querySelectorAll(".statusbar .pop .row")].map((b) => (b.querySelector("svg") ? "tick" : "") + (getComputedStyle(b).backgroundColor !== "rgba(0, 0, 0, 0)" ? " lit" : ""))`);
check("in Daylight the chosen kind is lit and ticked, the others not", JSON.stringify(marks) === JSON.stringify(["tick lit", "", "", ""]), JSON.stringify(marks));
const panel = await page.run(`(() => { const r = document.querySelector(".statusbar .pop").getBoundingClientRect(); return { x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 }; })()`);
await page.shoot(`${shots}bar-keys-daylight.png`, panel);
await page.run(`document.documentElement.dataset.theme = "forest", true`);
await page.run(`[...document.querySelectorAll(".statusbar .pop .row")].find((b) => b.textContent.trim() === "Pisalni stroj").click(), true`);
await sleep(300);
await page.run(`(() => { const input = document.querySelector(".statusbar .pop input[type=range]"); input.value = "0.7"; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await sleep(300);
await page.shoot(`${shots}bar-keys.png`, { x: 300, y: 500, width: 900, height: 268 });
check("a kind chosen there sounds, at the volume set, and the keyboard is lit", (await prefs()).keySounds === "typewriter" && (await prefs()).keySoundVolume === 0.7 && (await page.run(`document.querySelector(".statusbar .keys").classList.contains("playing")`)));
await page.mouse(".paper .ProseMirror", "");
check("a click on the page closes the panel", await until(`!document.querySelector(".statusbar .pop")`, 10));
check("the pomodoro and Zen are still last", JSON.stringify(await page.run(`[...document.querySelector(".statusbar").children].map((el) => el.textContent.trim()).filter(Boolean).slice(-2)`)) === JSON.stringify(["Pomodoro", "Zen"]));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
