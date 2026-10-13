// Checks that find doesn't slow typing (owner, 13 October): an 11,000-word chapter where "je" is found more
// than a thousand times, the processor slowed four times: the median key with find closed and with find
// open on "je", twice each; and how long finding "je" takes, from the key to every match counted.
// Usage: node --experimental-websocket find-speed-check.mjs [port]
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
const atMiddle = () =>
  page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); const p = pm.querySelectorAll("p")[150]; p.scrollIntoView({ block: "center" }); const r = document.createRange(); r.setStart(p.firstChild, 3); r.collapse(true); pm.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);

const timeKeys = async (findOpen) => {
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  await page.mouse(".home .continue .go", "");
  await until(`!!document.querySelector(".paper .ProseMirror")`);
  await sleep(1000);
  const html = Array.from({ length: 300 }, (_, index) => `<p>${index + 1}. ${"Čez reko je padal mrak in Špela je štela stopnice, ki so škripale pod njenimi koraki. ".repeat(1 + (index % 3))}</p>`).join("");
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); const data = new DataTransfer(); data.setData("text/html", ${JSON.stringify(html)}); data.setData("text/plain", "x"); pm.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); return true; })()`);
  await sleep(3500);
  await atMiddle();
  await sleep(800);
  let searchTook = 0;
  let total = "";
  if (findOpen) {
    await page.key("f", "KeyF", 70, 2);
    await until(`!!document.activeElement?.closest(".find-panel .field")`);
    await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const began = Date.now();
    await page.type("je");
    await until(`/of \\d/.test(document.querySelector(".find-panel .counter")?.textContent ?? "")`, 100);
    searchTook = Date.now() - began;
    await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    total = await page.run(`document.querySelector(".find-panel .counter")?.textContent.trim()`);
    // Back to the page, find still open, to write there.
    await atMiddle();
    await sleep(800);
  }
  const marks = await page.run(`document.querySelectorAll(".paper .pv-find").length`);
  await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const times = [];
  for (const letter of "pisemnaprejzdajinpisemsenaprej") {
    const began = Date.now();
    await press(letter);
    times.push(Date.now() - began);
    await sleep(110);
  }
  await sleep(2500);
  await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  times.sort((a, b) => a - b);
  return { median: times[Math.floor(times.length / 2)], marks, searchTook, total, open: await page.run(`!!document.querySelector(".find-panel")`) };
};

const runs = [];
for (const findOpen of [false, true, false, true]) runs.push({ findOpen, ...(await timeKeys(findOpen)) });
for (const run of runs) console.log(JSON.stringify(run));
const closed = runs.filter((run) => !run.findOpen).map((run) => run.median);
const open = runs.filter((run) => run.findOpen);
check("find open on a word found a thousand times: it is counted, and only the marks in sight are drawn", open.every((run) => run.open && /of 1[.,]?\d{3}/.test(run.total) && run.marks > 20 && run.marks <= 400), JSON.stringify(open.map((run) => [run.total, run.marks])));
check("typing on the page is as quick with find open as closed (within 8 ms a key)", Math.max(...open.map((run) => run.median)) <= Math.max(...closed) + 8, `closed ${closed.join("/")} ms, open ${open.map((run) => run.median).join("/")} ms`);
check("finding it takes under half a second, four times slower", open.every((run) => run.searchTook < 500), open.map((run) => run.searchTook).join("/") + " ms");
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
