// Typing in her case (ARCH-11): the long test book (15 chapters of 10,000 words) on sheets, three comments
// beside the text, at 1366 × 768 with the processor slowed four times, as on Eva's laptop. She types in
// bursts, with pauses of half a second to two and a half between them, so what Pensieve does at a pause (the
// save, the pages, the comments, the notes' mentions) meets her next key. Each key is timed from the moment
// it is pressed until the page shows it (the browser's Event Timing), against the requirement's 40 ms. The
// stand-in database runs in a worker, as the real one runs in Rust, so its SQL isn't timed as the page's.
// Usage: node typing-speed-check.mjs [port]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, "shots"), { recursive: true });

const port = Number(process.argv[2] ?? 4176);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const page = await connect({ width: 1366, height: 768 });
await page.harness({ worker: true });
const until = async (expression, tries = 120) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if ((await page.run(expression)) === true) return true;
    await sleep(500);
  }
  return false;
};

// The long test book, on A4 sheets.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", paper: "pages", paperSize: "a4" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".gear");
await sleep(800);
await page.clickText("nav button, [role=tab]", "General");
await sleep(500);
await page.clickText(".window button", "long test book");
check("the long test book is written", await until(`document.body.innerText.includes("The long test book is on Home.")`, 240));
await page.key("Escape", "Escape", 27);
await sleep(800);
await page.clickText(".project", "Long test book");
await until(`/Long test book/.test(document.querySelector(".home")?.innerText ?? "") && !!document.querySelector(".home .continue")`, 60);
await sleep(800);
await page.clickText(".home button", "Continue writing");
check("its first chapter opens on sheets", await until(`!!document.querySelector(".paper .ProseMirror") && document.querySelectorAll(".leaf").length > 1`, 60));
await sleep(2500);

/** Puts the cursor in the chapter's paragraph `index`, `offset` characters in, on screen; or selects `length` characters there. */
const place = (index, offset, length = 0) =>
  page.run(`(() => {
    const pm = document.querySelector(".paper .ProseMirror");
    const paragraph = pm.querySelectorAll(":scope > p")[${index}];
    if (!paragraph) return false;
    paragraph.scrollIntoView({ block: "center" });
    const text = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode();
    const range = document.createRange();
    range.setStart(text, ${offset});
    range.setEnd(text, ${offset} + ${length});
    pm.focus();
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  })()`);

// Three comments near where she writes, so the comment cards beside the text have places to keep.
const paragraphs = await page.run(`document.querySelectorAll(".paper .ProseMirror > p").length`);
const middle = Math.floor(paragraphs / 2);
for (const [index, words] of [[middle - 3, "Preveri letnico."], [middle + 1, "Je to res Vera?"], [middle + 4, "Tu manjka prehod."]]) {
  await place(index, 0, 12);
  await sleep(300);
  await page.key("m", "KeyM", 77, 2 | 1);
  await until(`!!document.activeElement?.closest(".card")`, 20);
  await sleep(300);
  await page.type(words);
  await sleep(500);
}
await place(middle, 20);
await sleep(3500);
const comments = await page.run(`new Set([...document.querySelectorAll(".paper .ProseMirror .comment")].map((el) => el.dataset.commentId)).size`);
check(
  "three comments are beside the text, and the cursor is back in it",
  comments === 3 && (await page.run(`document.activeElement?.classList.contains("ProseMirror") && !!document.activeElement.closest(".paper")`)),
  `${comments} comments`,
);

// Every key's events as the browser times them, the keys she pressed, and the app's calls to the database.
await page.run(`(() => {
  const timing = (window.__PV_TIMING__ = { events: [], keys: [], calls: [], frames: [] });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.interactionId) continue;
      timing.events.push({ id: entry.interactionId, name: entry.name, start: entry.startTime, duration: entry.duration, delay: entry.processingStart - entry.startTime, processing: entry.processingEnd - entry.processingStart, end: entry.processingEnd });
    }
  }).observe({ type: "event", durationThreshold: 16 });
  // Frames that took long, and what took the time in them: scripts (which), or style, layout and paint.
  new PerformanceObserver((list) => {
    for (const frame of list.getEntries()) {
      timing.frames.push({
        start: frame.startTime,
        duration: frame.duration,
        render: frame.renderStart ? frame.startTime + frame.duration - frame.renderStart : 0,
        layout: frame.styleAndLayoutStart ? frame.startTime + frame.duration - frame.styleAndLayoutStart : 0,
        scripts: frame.scripts.map((script) => ({ invoker: script.invoker, url: script.sourceURL, at: script.sourceCharPosition, duration: script.duration, forced: script.forcedStyleAndLayoutDuration })),
      });
    }
  }).observe({ type: "long-animation-frame" });
  addEventListener("keydown", (event) => timing.keys.push({ key: event.key, at: event.timeStamp }), true);
  const invoke = window.__TAURI_INTERNALS__.invoke;
  window.__TAURI_INTERNALS__.invoke = (cmd, args, options) => {
    const start = performance.now();
    const result = invoke(cmd, args, options);
    if (cmd.startsWith("plugin:sql|")) Promise.resolve(result).finally(() => timing.calls.push({ query: String(args?.query ?? ""), start, end: performance.now() })).catch(() => {});
    return result;
  };
  return true;
})()`);

/** The key as a keyboard sends it: a letter's code and key code, a space's, or only its character. */
const keyOf = (character) => {
  if (/^[a-z]$/i.test(character)) return { key: character, code: `Key${character.toUpperCase()}`, windowsVirtualKeyCode: character.toUpperCase().charCodeAt(0) };
  if (character === " ") return { key: " ", code: "Space", windowsVirtualKeyCode: 32 };
  if (character === ".") return { key: ".", code: "Period", windowsVirtualKeyCode: 190 };
  if (character === ",") return { key: ",", code: "Comma", windowsVirtualKeyCode: 188 };
  return { key: character, code: { č: "Semicolon", š: "BracketLeft", ž: "Backslash" }[character] ?? "", windowsVirtualKeyCode: { č: 186, š: 219, ž: 220 }[character] ?? 0 };
};
// Bursts of a sentence or two, with the pause before each: some shorter than the 2-second wait before a save,
// some longer, so saves start during pauses and the next key can meet one.
const BURSTS = [
  [0, "Ana je stala pri oknu. "],
  [600, "Reka je bila tiha, temna "],
  [2500, "in nekje spodaj je zaškripal pod. "],
  [900, "Vera ni rekla ničesar. "],
  [2200, "Ključi so bili hladni kot led, "],
  [1500, "težji, kot bi smeli biti. "],
  [2500, "Pri mlinu je lajal pes. "],
  [700, "Potem je bilo spet tiho. "],
  [2000, "Ana je prižgala luč v kuhinji "],
  [2400, "in sedla k mizi. Pisala je dolgo. "],
];
const STEP = 125;
const sent = [];
await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
for (const [pause, text] of BURSTS) {
  await sleep(pause);
  const began = Date.now();
  const presses = [];
  for (const [index, character] of [...text].entries()) {
    // On a steady beat, as fingers type, whether or not the page has caught up.
    const wait = began + index * STEP - Date.now();
    if (wait > 0) await sleep(wait);
    const key = keyOf(character);
    presses.push(page.send("Input.dispatchKeyEvent", { type: "keyDown", ...key, text: character, unmodifiedText: character }));
    presses.push(sleep(45).then(() => page.send("Input.dispatchKeyEvent", { type: "keyUp", ...key })));
    sent.push({ character, first: index === 0, pause });
  }
  await Promise.all(presses);
}
await sleep(3000);
await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await sleep(1500);

const timing = await page.run(`window.__PV_TIMING__`);
writeFileSync(join(here, "shots", "typing-speed.json"), JSON.stringify({ sent, ...timing }));
const typed = BURSTS.map(([, text]) => text).join("");
const shown = await page.run(`document.querySelector(".paper .ProseMirror").innerText.replace(/\\s+/g, " ")`);
check("every key reached the page, and the words are there", timing.keys.length === sent.length && shown.includes(typed.trim()), `${timing.keys.length} of ${sent.length} keys`);
const saved = await page.run(`window.__TAURI_INTERNALS__.invoke("plugin:sql|select", { db: "sqlite:" + JSON.parse(localStorage.getItem("pensieve-prefs")).projectPath, query: "SELECT COUNT(*) AS n FROM chapters WHERE plain_text LIKE $1", values: ["%Pisala je dolgo.%"] }).then((rows) => rows[0].n)`);
check("and saved in the file", saved === 1, `${saved}`);

// Saves while she typed: runs of the database calls with no long gap, holding a chapter's write.
const calls = [...timing.calls].sort((a, b) => a.start - b.start);
const saves = [];
for (const call of calls) {
  const last = saves.at(-1);
  if (last && call.start - last.end < 250) {
    last.end = Math.max(last.end, call.end);
    last.chapters += /INSERT INTO chapters/.test(call.query) ? 1 : 0;
  } else saves.push({ start: call.start, end: call.end, chapters: /INSERT INTO chapters/.test(call.query) ? 1 : 0 });
}
const writes = saves.filter((save) => save.chapters > 0 && save.end > timing.keys[0].at);
check("saves ran while she typed, at the pauses", writes.length >= 2, writes.map((save) => `${Math.round(save.end - save.start)} ms, ${save.chapters} chapters`).join("; "));

// Each key, from the moment it was pressed until the page showed its letter: the longer of its keydown and keypress.
// Its keyup isn't counted: letting go changes nothing on the page, so its time only says when the next frame
// happened to come. A key the browser didn't report took under 16 ms, its shortest report.
const keys = timing.keys.map((key, index) => {
  const pressed = timing.events.find((event) => event.name === "keydown" && Math.abs(event.start - key.at) < 1);
  const events = pressed ? timing.events.filter((event) => event.id === pressed.id && event.name !== "keyup") : [];
  const slowest = events.reduce((most, event) => (event.duration > (most?.duration ?? -1) ? event : most), null);
  const ms = slowest?.duration ?? 0;
  const during = writes.some((save) => key.at < save.end && key.at + ms > save.start);
  return { ...sent[index], ms, slowest, kind: during ? "meeting a save" : sent[index].first ? "first after a pause" : "in a burst" };
});
const percentile = (list, share) => {
  const ordered = list.map((key) => key.ms).sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(share * ordered.length))] ?? 0;
};
const shownMs = (ms) => (ms < 16 ? "under 16 ms" : `${Math.round(ms)} ms`);
console.log(`\n${keys.length} keys: median ${shownMs(percentile(keys, 0.5))}, 90% within ${shownMs(percentile(keys, 0.9))}, 95% within ${shownMs(percentile(keys, 0.95))}, slowest ${shownMs(percentile(keys, 1))}`);
for (const kind of ["in a burst", "first after a pause", "meeting a save"]) {
  const these = keys.filter((key) => key.kind === kind);
  console.log(`  ${kind}: ${these.length} keys, median ${shownMs(percentile(these, 0.5))}, ${these.filter((key) => key.ms > 40).length} over 40 ms`);
}
console.log("  slowest (waited for the page, its code ran, then until painted):");
for (const key of [...keys].sort((a, b) => b.ms - a.ms).slice(0, 6)) {
  const { delay = 0, processing = 0 } = key.slowest ?? {};
  console.log(`    ${JSON.stringify(key.character)} ${Math.round(key.ms)} ms: ${Math.round(delay)} + ${Math.round(processing)} + ${Math.max(0, Math.round(key.ms - delay - processing))} (${key.kind})`);
}
// What took the time in the frames over 50 ms while she typed: the code, as the build has it.
const scripts = new Map();
for (const frame of timing.frames.filter((frame) => frame.start >= timing.keys[0].at)) {
  for (const script of frame.scripts) {
    const where = `${script.url}:${script.at}`;
    const sum = scripts.get(where) ?? { ...script, total: 0, forcedTotal: 0, count: 0 };
    sum.total += script.duration;
    sum.forcedTotal += script.forced;
    sum.count += 1;
    scripts.set(where, sum);
  }
}
const sources = new Map();
console.log(`  frames over 50 ms: ${timing.frames.filter((frame) => frame.start >= timing.keys[0].at).length}; the code in them:`);
for (const script of [...scripts.values()].sort((a, b) => b.total - a.total).slice(0, 4)) {
  if (!sources.has(script.url)) sources.set(script.url, await fetch(script.url).then((reply) => reply.text(), () => ""));
  const code = sources.get(script.url).slice(script.at, script.at + 70).replace(/\s+/g, " ");
  console.log(`    ${Math.round(script.total)} ms in ${script.count} (${Math.round(script.forcedTotal)} of it layout forced): ${script.invoker} ${code}`);
}
console.log("");

check("the middle key shows within 40 ms", percentile(keys, 0.5) <= 40, shownMs(percentile(keys, 0.5)));
check("19 keys in 20 show within 40 ms, after a pause and during a save too", percentile(keys, 0.95) <= 40, shownMs(percentile(keys, 0.95)));
check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
