// Checks smooth typing (owner, 8 October), with Windows animations off as on the owner's PC: a caret that
// sits where the page's own would and glides after it, steady while typing and blinking after; new letters
// that ink in and are plain text again a moment later; the switch in Settings and Gentle mode turning it
// off; and a key no slower with it, on an 11,000-word chapter, the processor slowed four times.
// Usage: node smooth-check.mjs
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const page = await connect({ width: 1366, height: 820 });
await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await page.harness();
const start = async (prefs) => {
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", ${JSON.stringify(JSON.stringify(prefs))}), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  await page.mouse(".home .continue .go", "");
  await sleep(1500);
};
const press = async (key) => {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), text: key });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) });
};
const toEnd = `(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); return true; })()`;
// The glide caret against the page's own caret (the selection's place).
const CARET = `(() => {
  const caret = document.querySelector(".paper .ink-caret");
  if (!caret) return null;
  const box = caret.getBoundingClientRect();
  const rects = getSelection().getRangeAt(0).getClientRects();
  const at = rects[rects.length - 1];
  const style = getComputedStyle(caret);
  return {
    shown: caret.classList.contains("shown"),
    dx: at ? Math.round(box.left + 1 - at.left) : null,
    dy: at ? Math.round(box.top - at.top) : null,
    blinking: caret.classList.contains("blinking"),
    glide: style.transitionDuration,
    native: getComputedStyle(document.querySelector(".paper .ProseMirror")).caretColor,
  };
})()`;

await start({ uiLanguage: "sl" });
await page.run(toEnd);
await sleep(500);
let caret = await page.run(CARET);
check("with the page focused, the gliding caret shows where the page's own would be, which gives way", caret?.shown && Math.abs(caret.dx) <= 1 && Math.abs(caret.dy) <= 1 && caret.native === "rgba(0, 0, 0, 0)", JSON.stringify(caret));
for (const letter of "abc") await press(letter);
await sleep(80);
const inked = await page.run(`({ veils: [...document.querySelectorAll(".paper .ink-veil")].filter((veil) => veil.getAnimations().length > 0).length, spans: document.querySelectorAll(".paper .ProseMirror span.ink-new").length })`);
check("a letter just typed inks in, under a fading veil, the text itself untouched", inked.veils >= 1 && inked.spans === 0, JSON.stringify(inked));
await sleep(150);
caret = await page.run(CARET);
check("the caret follows the typing, steady, and glides even with Windows animations off", caret?.shown && Math.abs(caret.dx) <= 1 && !caret.blinking && caret.glide === "0.1s", JSON.stringify(caret));
await sleep(900);
const settled = await page.run(`({ veil: Math.max(...[...document.querySelectorAll(".paper .ink-veil")].map((veil) => Number(getComputedStyle(veil).opacity))), blinking: document.querySelector(".paper .ink-caret").classList.contains("blinking") })`);
check("a moment later the veils are gone, and the caret blinks", settled.veil === 0 && settled.blinking, JSON.stringify(settled));
check("and the text is as typed", (await page.run(`document.querySelector(".paper .ProseMirror").textContent`)).endsWith("abc"));
// Undo still takes the word back.
await page.key("z", "KeyZ", 90, 2);
await sleep(300);
check("Ctrl+Z still takes the typing back", !(await page.run(`document.querySelector(".paper .ProseMirror").textContent`)).endsWith("abc"));
await page.run(`document.querySelector(".gear")?.focus(), true`);
await sleep(300);
check("with the keyboard elsewhere, the caret goes", !(await page.run(CARET))?.shown);

// Settings → Appearance turns it off.
await page.click(".gear");
await sleep(600);
await page.clickText(".window nav button, .window [role=tab]", "Videz");
await sleep(300);
const toggle = await page.run(`[...document.querySelectorAll(".window .row")].find((row) => row.textContent.includes("Mehko pisanje"))?.querySelector(".toggle")`);
await page.run(`[...document.querySelectorAll(".window .row")].find((row) => row.textContent.includes("Mehko pisanje"))?.querySelector(".toggle")?.click(), true`);
await sleep(200);
await page.key("Escape", "Escape", 27);
await sleep(600);
await page.run(toEnd);
await press("d");
await sleep(300);
const off = await page.run(`({ caret: document.querySelector(".paper .ink-caret.shown") !== null, inked: [...document.querySelectorAll(".paper .ink-veil")].filter((veil) => veil.getAnimations().some((a) => a.playState === "running")).length, native: getComputedStyle(document.querySelector(".paper .ProseMirror")).caretColor })`);
check("Settings → Appearance turns it off: the page's own caret, plain letters", !off.caret && off.inked === 0 && off.native !== "rgba(0, 0, 0, 0)", JSON.stringify(off));

// Gentle mode leaves it alone (owner, 9 October: with Gentle mode on, he saw nothing).
await start({ uiLanguage: "sl", gentle: true });
await page.run(toEnd);
await press("e");
await sleep(300);
check("Gentle mode leaves it on: it has its own switch", (await page.run(`document.querySelector(".paper .ink-caret.shown") !== null || [...document.querySelectorAll(".paper .ink-veil")].filter((veil) => veil.getAnimations().some((a) => a.playState === "running")).length > 0`)));

// No slower: an 11,000-word chapter, the processor slowed four times, smooth typing on and off.
const timeKeys = async (smooth) => {
  await start({ uiLanguage: "sl", smoothTyping: smooth });
  const html = Array.from({ length: 300 }, (_, index) => `<p>${index + 1}. ${"Čez reko je padal mrak in Špela je štela stopnice, ki so škripale pod njenimi koraki. ".repeat(1 + (index % 3))}</p>`).join("");
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); const data = new DataTransfer(); data.setData("text/html", ${JSON.stringify(html)}); data.setData("text/plain", "x"); pm.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); return true; })()`);
  await sleep(3000);
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); const p = pm.querySelectorAll("p")[150]; const r = document.createRange(); r.setStart(p.firstChild, 3); r.collapse(true); pm.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await sleep(800);
  await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const times = [];
  // 30 keys, so one slow moment doesn't decide it.
  for (const letter of "pisemnaprejzdajinpisemsenaprej") {
    const began = Date.now();
    await press(letter);
    times.push(Date.now() - began);
    await sleep(110);
  }
  await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
};
const on = await timeKeys(true);
const offTime = await timeKeys(false);
check("a key is no slower with smooth typing, on a long chapter, the processor slowed four times", on <= offTime + 10, `median ${on} ms on, ${offTime} ms off`);
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
