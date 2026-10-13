// Checks keystroke sounds (owner, 8 October), from the recordings the owner chose: off to start with;
// Settings → Ambience offers a typewriter, a mechanical keyboard and a soft one, with their own volume.
// On the typewriter, keys strike, space thumps, Backspace has its own sound and Enter returns the
// carriage with its bell; on a keyboard each key has its own sound (č, š and ž too, where they sit on a
// Slovenian keyboard). Shortcuts and arrows stay quiet, and typing is no slower with them on, the
// processor slowed four times. Usage: node keysound-check.mjs
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
// Each sound played: where in its recording, and how long.
const SPY = `(() => {
  const log = (window.__PV_KEYS__ = { plays: [] });
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    log.plays.push({ at: Math.round((offset ?? 0) * 1000), ms: Math.round((duration ?? this.buffer?.duration ?? 0) * 1000) });
    return start.apply(this, arguments);
  };
})();`;
const page = await connect({ width: 1366, height: 820 });
const until = async (expression, tries = 60) => {
  for (let turn = 0; turn < tries; turn += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
await page.harness();
await page.send("Page.addScriptToEvaluateOnNewDocument", { source: SPY });
const open = async (prefs) => {
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", ${JSON.stringify(JSON.stringify(prefs))}), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  await page.mouse(".home .continue .go", "");
  await sleep(2000);
};
const toEnd = `(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`;
// A real key: its keydown, its letter, its keyup.
const press = async (key, code, keyCode, modifiers = 0) => {
  const text = key.length === 1 && !modifiers ? key : key === "Enter" ? "\r" : undefined;
  await page.send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode: keyCode, modifiers, text });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, modifiers });
};
const plays = () => page.run(`window.__PV_KEYS__.plays.slice()`);
const reset = () => page.run(`(window.__PV_KEYS__.plays = []), true`);

await open({ uiLanguage: "sl" });
await page.run(toEnd);
await press("a", "KeyA", 65);
await press("b", "KeyB", 66);
await sleep(300);
check("keys are quiet to start with", (await plays()).length === 0, JSON.stringify(await plays()));

// Settings → Ambience: the three sounds; the typewriter.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "Vzdušje");
await sleep(300);
const choices = await page.run(`[...document.querySelectorAll(".window .segment button")].map((b) => b.textContent.trim())`);
check("Settings → Ambience offers off, a typewriter, a mechanical and a soft keyboard", JSON.stringify(choices.slice(-4)) === JSON.stringify(["Izklopljeno", "Pisalni stroj", "Mehanska tipkovnica", "Mehka tipkovnica"]), JSON.stringify(choices));
await page.clickText(".window .segment button", "Pisalni stroj");
await sleep(300);
const volume = await page.run(`[...document.querySelectorAll(".window .slider")].map((s) => s.textContent.trim().replace(/\\s+/g, " ")).find((text) => text.startsWith("Glasnost tipk")) ?? ""`);
check("with its own volume, 50 to start with", volume === "Glasnost tipk 50", volume);
await page.key("Escape", "Escape", 27);
await sleep(1200);

await page.run(toEnd);
await reset();
await press("d", "KeyD", 68);
await press("č", "Semicolon", 186);
await press(" ", "Space", 32);
await press("Backspace", "Backspace", 8);
await press("Enter", "Enter", 13);
await sleep(300);
const typed = await plays();
const sameKey = typed[0]?.at === typed[1]?.at;
check("the typewriter: letters strike (one recording, č too)", typed.length === 5 && sameKey && typed[0].ms > 200 && typed[0].ms < 500, JSON.stringify(typed));
check("space thumps, Backspace has its own sound, Enter returns the carriage with its bell", typed[2].at !== typed[0].at && typed[3].at !== typed[0].at && typed[3].at !== typed[2].at && typed[4].ms > 1000, JSON.stringify(typed.slice(2)));
await reset();
await press("ArrowLeft", "ArrowLeft", 37);
await press("b", "KeyB", 66, 2);
await press("Shift", "ShiftLeft", 16, 8);
await sleep(300);
check("arrows, Ctrl+B and Shift stay quiet", (await plays()).length === 0, JSON.stringify(await plays()));

// The mechanical keyboard: each key its own sound, č, š and ž where they sit.
await open({ uiLanguage: "sl", keySounds: "mechanical" });
await page.run(toEnd);
await reset();
for (const [key, code, keyCode] of [["a", "KeyA", 65], ["s", "KeyS", 83], ["a", "KeyA", 65], ["č", "Semicolon", 186], ["š", "BracketLeft", 219], ["ž", "Backslash", 220]]) await press(key, code, keyCode);
await sleep(300);
const mech = await plays();
check("a mechanical keyboard: each key its own sound, the same key the same sound", mech.length === 6 && mech[0].at === mech[2].at && mech[0].at !== mech[1].at && new Set(mech.map((play) => play.at)).size === 5, JSON.stringify(mech));
check("and it stays chosen after a restart", (await page.run(`JSON.parse(localStorage.getItem("pensieve-prefs")).keySounds`)) === "mechanical");

// The soft keyboard.
await open({ uiLanguage: "sl", keySounds: "soft" });
await page.run(toEnd);
await reset();
await press("e", "KeyE", 69);
await press(" ", "Space", 32);
await press("Enter", "Enter", 13);
await sleep(300);
const soft = await plays();
check("a soft keyboard: short, quiet keys, its own space and Enter", soft.length === 3 && soft.every((play) => play.ms < 400) && new Set(soft.map((play) => play.at)).size === 3, JSON.stringify(soft));

// Typing as quick with them as without, the processor slowed four times.
const timeKeys = async () => {
  await page.run(toEnd);
  await sleep(300);
  const times = [];
  for (const letter of "pisemnaprej") {
    const began = Date.now();
    await press(letter, `Key${letter.toUpperCase()}`, letter.toUpperCase().charCodeAt(0));
    times.push(Date.now() - began);
    await sleep(60);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
};
await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const withSound = await timeKeys();
await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await open({ uiLanguage: "sl" });
await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const withoutSound = await timeKeys();
await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
check("a key takes no longer with sounds on than off", withSound <= withoutSound + 8, `median ${withSound} ms on, ${withoutSound} ms off`);
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
