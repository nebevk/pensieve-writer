// Checks that Zen's still scene (owner, 13 October) doesn't slow typing: an 11,000-word chapter in Zen, in
// Moonlit (the scene with the most in it), the processor slowed four times, the median key with the scene
// and with it taken away. Usage: node zen-speed-check.mjs [port]
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

const timeKeys = async (withScene) => {
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "moonlit" })), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  await page.mouse(".home .continue .go", "");
  await until(`!!document.querySelector(".paper .ProseMirror")`);
  await sleep(1000);
  const html = Array.from({ length: 300 }, (_, index) => `<p>${index + 1}. ${"Čez reko je padal mrak in Špela je štela stopnice, ki so škripale pod njenimi koraki. ".repeat(1 + (index % 3))}</p>`).join("");
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); pm.focus(); const s = getSelection(); s.selectAllChildren(pm); s.collapseToEnd(); const data = new DataTransfer(); data.setData("text/html", ${JSON.stringify(html)}); data.setData("text/plain", "x"); pm.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); return true; })()`);
  await sleep(3000);
  await page.clickText(".statusbar button", "Zen");
  await until(`!!document.querySelector(".zen-tools")`);
  await sleep(800);
  if (!withScene) await page.run(`(document.querySelector(".zen-scene").style.display = "none", true)`);
  await page.run(`(() => { const pm = document.querySelector(".paper .ProseMirror"); const p = pm.querySelectorAll("p")[150]; const r = document.createRange(); r.setStart(p.firstChild, 3); r.collapse(true); pm.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); p.scrollIntoView({ block: "center" }); return true; })()`);
  await sleep(800);
  const scene = await page.run(`(() => { const el = document.querySelector(".zen-scene"); return !!el && getComputedStyle(el).display !== "none" && getComputedStyle(el).backgroundImage.includes("zen-moonlit"); })()`);
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
  return { median: times[Math.floor(times.length / 2)], scene };
};

const without = await timeKeys(false);
const withScene = await timeKeys(true);
check("the scene was there for the second run only", withScene.scene && !without.scene);
check("a key is no slower in Zen with the scene, on a long chapter, the processor slowed four times", withScene.median <= without.median + 5, `median ${withScene.median} ms with the scene, ${without.median} ms without`);
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
