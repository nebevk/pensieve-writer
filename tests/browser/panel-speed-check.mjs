// Checks that a note open in the panel beside the page doesn't slow typing (owner, 12 October): an
// 11,000-word chapter, the processor slowed four times, the median key with a note open and with nothing.
// Usage: node --experimental-websocket dock-speed-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const page = await connect({ width: 1366, height: 768 });
await page.harness();
const until = async (expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const press = async (key) => {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), text: key });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) });
};

const timeKeys = async (withNote) => {
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  await page.mouse(".home .continue .go", "");
  await until(`!!document.querySelector(".paper .ProseMirror")`);
  await sleep(1000);
  if (withNote) {
    await page.click(`.ribbon button[title="Notes panel"]`);
    await until(`!!document.querySelector('aside.panel button[title="New note"]')`);
    await page.click(`aside.panel button[title="New note"]`);
    await until(`!!document.querySelector("aside.pane input.title")`);
    await sleep(300);
    await page.type("Ana Novak");
    await sleep(500);
  }
  const html = Array.from({ length: 300 }, (_, index) => `<p>${index + 1}. ${"Čez reko je padal mrak in Špela je štela stopnice, ki so škripale pod njenimi koraki. ".repeat(1 + (index % 3))}</p>`).join("");
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); const data = new DataTransfer(); data.setData("text/html", ${JSON.stringify(html)}); data.setData("text/plain", "x"); pm.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); return true; })()`);
  await sleep(3000);
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); const p = pm.querySelectorAll("p")[150]; const r = document.createRange(); r.setStart(p.firstChild, 3); r.collapse(true); pm.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await sleep(800);
  const open = await page.run(`!!document.querySelector("aside.pane .ProseMirror")`);
  await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const times = [];
  for (const letter of "pisemnaprejzdajinpisemsenaprej") {
    const began = Date.now();
    await press(letter);
    times.push(Date.now() - began);
    await sleep(110);
  }
  await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  times.sort((a, b) => a - b);
  return { median: times[Math.floor(times.length / 2)], open };
};

const without = await timeKeys(false);
const withNote = await timeKeys(true);
check("a note was open in the panel for the second run", withNote.open && !without.open);
check("a key is no slower with a note open beside the page, on a long chapter, the processor slowed four times", withNote.median <= without.median + 10, `median ${withNote.median} ms with the note, ${without.median} ms without`);
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
