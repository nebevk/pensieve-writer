// Checks the floating bar (owner, 8 October): no words in the book, language or "Saved" there any more,
// and a pomodoro: it ticks as it starts, counts the writing time down (its length from Settings), then a
// chime, a word on the page and the break; a chime and a word again. While it runs, icons pause and
// resume it, start the phase again and stop it; Zen shows its time. The page's clock is moved on
// instead of waiting. Usage: node pomodoro-check.mjs
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const CLOCK = `(() => {
  const real = Date.now.bind(Date);
  window.__PV_SKIP__ = 0;
  Date.now = () => real() + window.__PV_SKIP__;
  const log = (window.__PV_TONES__ = { tones: 0, high: 0 });
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) { log.tones += 1; if (this.frequency.value > 1000) log.high += 1; return start.apply(this, args); };
})();`;
const page = await connect({ width: 1366, height: 820 });
await page.harness();
await page.send("Page.addScriptToEvaluateOnNewDocument", { source: CLOCK });
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.mouse(".home .continue .go", "");
await sleep(1500);
const bar = () => page.run(`[...document.querySelector(".statusbar").children].map((el) => el.textContent.trim()).filter(Boolean)`);
const face = () => page.run(`document.querySelector(".statusbar .pomodoro")?.textContent.trim() ?? ""`);
const icons = () => page.run(`[...document.querySelectorAll(".statusbar .pomodoro-run button")].map((b) => b.getAttribute("aria-label"))`);
const press = (label) => page.mouse(`.statusbar button[aria-label='${label}']`, "");
const notice = () => page.run(`document.querySelector(".write-notice")?.textContent.trim() ?? ""`);
const skip = (minutes) => page.run(`window.__PV_SKIP__ += ${minutes * 60_000}, true`);
const tones = () => page.run(`({ ...window.__PV_TONES__ })`);

const items = await bar();
check("the bar no longer has the words in the book, the language or Saved", !items.some((text) => /v knjigi|Slovenščina|Angleščina|Shranjeno|Neshranjeno/.test(text)), JSON.stringify(items));
check("it has the pomodoro, resting, before Zen", (await face()) === "Pomodoro" && items.indexOf("Pomodoro") === items.length - 2 && items.at(-1) === "Zen", JSON.stringify(items));

// Lengths from Settings: 50 minutes of writing, 10 of break.
await page.click(".gear");
await page.run(`new Promise((resolve) => setTimeout(resolve, 600))`);
await page.clickText(".window nav button, .window [role=tab]", "Pisanje in cilji");
await sleep(300);
const sliders = await page.run(`[...document.querySelectorAll(".window .slider")].filter((s) => /Pisanje|Odmor/.test(s.textContent)).map((s) => s.textContent.trim().replace(/\\s+/g, " "))`);
check("Settings → Writing & goals has the pomodoro's two lengths, 25 and 5 to start with", JSON.stringify(sliders) === JSON.stringify(["Pisanje 25 min", "Odmor 5 min"]), JSON.stringify(sliders));
await page.run(`(() => {
  const set = (label, value) => { const input = [...document.querySelectorAll(".window .slider")].find((s) => s.textContent.includes(label)).querySelector("input"); input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); };
  set("Pisanje", 50); set("Odmor", 10); return true;
})()`);
await sleep(300);
await page.key("Escape", "Escape", 27);
await sleep(600);

// It ticks as it starts, and counts 50 minutes down.
const before = await tones();
await page.mouse(".statusbar .pomodoro", "");
await sleep(1500);
const started = await face();
const ticked = await tones();
check("a click starts the writing time set in Settings, counted down", /^(49|50):\d\d$/.test(started), started);
check("with a clock's tick-tock as it starts", ticked.high - before.high >= 4, `${ticked.high - before.high} ticks`);
check("while it runs, three icons: pause, start again, stop", JSON.stringify(await icons()) === JSON.stringify(["Premor", "Znova od začetka", "Ustavi"]), JSON.stringify(await icons()));
await skip(10);
await sleep(1200);
check("the time goes down", /^(39|40):\d\d$/.test(await face()), await face());

// Pause and resume.
await press("Premor");
await sleep(300);
const paused = await face();
await skip(5);
await sleep(1200);
check("paused, the time stands still, and the icon offers to go on", (await face()) === paused && (await icons())[0] === "Nadaljuj", `${paused} → ${await face()}`);
await press("Nadaljuj");
await sleep(1200);
check("and resumed, it goes on from there", (await face()) !== paused && /^(39|40):\d\d$/.test(await face()), await face());

// Start again: the writing time from the top, ticking.
const beforeReset = await tones();
await press("Znova od začetka");
await sleep(1200);
check("Start again puts the writing time back to its start, ticking", /^(49|50):\d\d$/.test(await face()) && (await tones()).high - beforeReset.high >= 4, await face());

// The writing ends: a chime, a word on the page, and the break of 10 minutes.
const tonesBefore = (await tones()).tones;
await skip(51);
await sleep(1500);
check("when the writing time is up, the break set in Settings begins", /^Odmor (9|10):\d\d$/.test(await face()), await face());
check("with a chime", (await tones()).tones > tonesBefore);
check("and a word on the page", (await notice()) === "Čas za odmor: 10 minut.", await notice());

// Zen shows the time too.
await page.mouse(".statusbar button.with-icon", "Zen");
await sleep(1200);
const zenTime = await page.run(`[...document.querySelectorAll(".zen-tools .words")].map((el) => el.textContent.trim()).join(" | ")`);
check("Zen's bar shows the break's time", /Odmor (9|10):\d\d/.test(zenTime), zenTime);
await page.key("Escape", "Escape", 27);
await sleep(1000);

// The break ends: a chime and a word, and it rests.
const tonesBreak = (await tones()).tones;
await skip(11);
await sleep(1500);
check("when the break is up, it rests again", (await face()) === "Pomodoro", await face());
check("with a chime and a word on the page", (await tones()).tones > tonesBreak && (await notice()) === "Odmor je mimo. Nazaj k pisanju.", await notice());

// Stop.
await page.mouse(".statusbar .pomodoro", "");
await sleep(1200);
await press("Ustavi");
await sleep(400);
check("Stop rests it at once", (await face()) === "Pomodoro" && (await icons()).length === 0, await face());
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
