// Checks the ambience: Pensieve always starts quiet, even when a sound was playing last time (owner,
// 8 October); a sound chosen from the floating bar plays, at a tenth of the slider by default, which is
// a twentieth of full loudness, since the slider's 100 plays at half; Gentle mode doesn't silence it;
// Silence lets the audio device go. Usage: node sound-check.mjs
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const SPY = `(() => {
  const log = (window.__PV_AUDIO__ = { contexts: [], starts: 0, decoded: 0, levels: [] });
  const Base = window.AudioContext;
  window.AudioContext = class extends Base {
    constructor(...args) { super(...args); log.contexts.push(this); }
    decodeAudioData(...args) { return super.decodeAudioData(...args).then((buffer) => { log.decoded += 1; return buffer; }); }
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) { log.starts += 1; return start.apply(this, args); };
  const ramp = AudioParam.prototype.linearRampToValueAtTime;
  AudioParam.prototype.linearRampToValueAtTime = function (value, time) { if (value > 0) log.levels.push(value); return ramp.call(this, value, time); };
  const target = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (value, ...rest) { log.levels.push(value); return target.call(this, value, ...rest); };
})();`;

async function opened(prefs) {
  const page = await connect({ width: 1400, height: 860 });
  await page.harness({ keep: true });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: SPY });
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", ${JSON.stringify(JSON.stringify(prefs))}), true`);
  await page.open(`http://127.0.0.1:${port}/`, 2500);
  return page;
}
const audio = (page) =>
  page.run(`({ state: window.__PV_AUDIO__.contexts[0]?.state ?? "none", starts: window.__PV_AUDIO__.starts, decoded: window.__PV_AUDIO__.decoded, levels: window.__PV_AUDIO__.levels })`);
const soundLabel = (page) => page.run(`document.querySelector(".statusbar button.with-icon")?.textContent.trim() ?? ""`);
// The bar's sound opens a panel of every sound (13 October): real clicks, as sound may only start from one.
const chooseSound = async (page, name) => {
  // The panel stays open after a choice, for the volume: opened only when it is shut.
  if (!(await page.run(`!!document.querySelector(".statusbar .pop")`))) await page.mouse(".statusbar .sound", "");
  await sleep(300);
  await page.mouse(`.statusbar .pop .choice[aria-label='${name}']`, "");
};

// Rain was playing last time: Pensieve opens quiet all the same.
let page = await opened({ uiLanguage: "sl", ambience: "rain" });
await page.mouse(".home .continue .go", "");
await sleep(1500);
const before = await audio(page);
check("a sound playing last time doesn't start again: Pensieve opens quiet", before.starts === 0 && before.state === "none", JSON.stringify(before));
check("and the floating bar says Silence", (await soundLabel(page)).includes("Tišina"), await soundLabel(page));
// A sound from the floating bar plays, at the slider's 10 of 100: a twentieth of full loudness.
await chooseSound(page, "Dež");
await sleep(2000);
const next = await audio(page);
const level = next.levels.at(-1) ?? 0;
check("a sound chosen from the floating bar plays", next.state === "running" && next.starts === 1 && next.decoded === 1, JSON.stringify(next));
check("at a twentieth of full loudness, the default slider's 10 of 100", Math.abs(level - 0.05) < 0.001, String(level));
const saved = await page.run(`JSON.parse(localStorage.getItem("pensieve-prefs")).ambienceVolume`);
check("the default volume is 10 of 100", saved === 0.1, String(saved));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
page.close();
await sleep(400);

// The slider's 100 plays at half.
page = await opened({ uiLanguage: "sl", ambienceVolume: 1 });
await page.mouse(".home .continue .go", "");
await sleep(1200);
await chooseSound(page, "Dež");
await sleep(2000);
const loudest = (await audio(page)).levels.at(-1) ?? 0;
check("the slider's 100 plays at half of full loudness, never more", Math.abs(loudest - 0.5) < 0.001, String(loudest));
page.close();
await sleep(400);

// Gentle mode quiets motion, not the sound she chose.
page = await opened({ uiLanguage: "sl", gentle: true });
await page.mouse(".home .continue .go", "");
await sleep(1200);
await chooseSound(page, "Dež");
await sleep(1500);
const gentle = await audio(page);
check("in Gentle mode the sound still plays", gentle.state === "running" && gentle.starts === 1, JSON.stringify(gentle));
// Silence: after the fade, the audio device is let go, and a click doesn't wake it.
await chooseSound(page, "Tišina");
await sleep(300);
await sleep(1800);
await page.mouse(".paper .ProseMirror", "");
await sleep(600);
const quiet = await audio(page);
check("Silence lets the audio device go, and a click doesn't wake it", quiet.state === "suspended", JSON.stringify(quiet));
page.close();

console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
