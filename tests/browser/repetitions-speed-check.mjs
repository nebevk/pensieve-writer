// Checks that marking repetitions doesn't slow typing (owner, 12 October): an 11,000-word chapter full of
// repeated words (thousands of marks), the processor slowed four times, the median key with the marks on
// and off, twice each; and how long the page is busy working the marks out after a pause.
// Usage: node --experimental-websocket repetitions-speed-check.mjs [port]
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

const timeKeys = async (repetitions) => {
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", repetitions: ${repetitions} })), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  await page.mouse(".home .continue .go", "");
  await until(`!!document.querySelector(".paper .ProseMirror")`);
  await sleep(1000);
  const html = Array.from({ length: 300 }, (_, index) => `<p>${index + 1}. ${"Čez reko je padal mrak in Špela je štela stopnice, ki so škripale pod njenimi koraki. ".repeat(1 + (index % 3))}</p>`).join("");
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); const data = new DataTransfer(); data.setData("text/html", ${JSON.stringify(html)}); data.setData("text/plain", "x"); pm.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); return true; })()`);
  await sleep(3500);
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); const p = pm.querySelectorAll("p")[150]; p.scrollIntoView({ block: "center" }); const r = document.createRange(); r.setStart(p.firstChild, 3); r.collapse(true); pm.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await sleep(1500);
  const marks = await page.run(`document.querySelectorAll(".paper .pv-echo").length`);
  await page.run(`(() => { window.__longTasks = []; new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__longTasks.push(Math.round(entry.duration)); }).observe({ entryTypes: ["longtask"] }); return true; })()`);
  await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const times = [];
  for (const letter of "pisemnaprejzdajinpisemsenaprej") {
    const began = Date.now();
    await press(letter);
    times.push(Date.now() - began);
    await sleep(110);
  }
  // The pause after typing: the marks are worked out again, in time the page has to spare.
  await sleep(4000);
  await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const longTasks = await page.run(`window.__longTasks`);
  const after = await page.run(`document.querySelectorAll(".paper .pv-echo").length`);
  times.sort((a, b) => a - b);
  return { median: times[Math.floor(times.length / 2)], marks, after, longest: Math.max(0, ...longTasks) };
};

const runs = [];
for (const repetitions of [false, true, false, true]) runs.push({ repetitions, ...(await timeKeys(repetitions)) });
for (const run of runs) console.log(JSON.stringify(run));
const off = runs.filter((run) => !run.repetitions).map((run) => run.median);
const on = runs.filter((run) => run.repetitions).map((run) => run.median);
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
check("with the marks on, at most 150 are drawn, where she types, of the chapter's thousands", runs.filter((run) => run.repetitions).every((run) => run.marks > 50 && run.marks <= 150 && run.after > 50 && run.after <= 150), JSON.stringify(runs.map((run) => [run.marks, run.after])));
check("and none with them off", runs.filter((run) => !run.repetitions).every((run) => run.marks === 0));
check("typing is as quick with the marks on as off (within 5 ms a key)", Math.max(...on) <= Math.max(...off) + 5, `off ${off.join("/")} ms, on ${on.join("/")} ms`);
console.log(`median off ${median(off)} ms, on ${median(on)} ms; longest task after a pause with the marks on: ${runs.filter((run) => run.repetitions).map((run) => run.longest).join("/")} ms`);
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
