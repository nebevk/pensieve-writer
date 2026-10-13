// Checks the 6 October afternoon changes: Home on the light chrome colour, no daily goal anywhere,
// no snapshots on Home, and the whole book restored from "Earlier versions". Usage: node home-light-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const page = await connect({ width: 1500, height: 900 });
await page.harness();
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const editorText = () => page.run(`document.querySelector(".paper .ProseMirror")?.innerText ?? ""`);

// Start with settings saved by an older Pensieve that still had a daily goal.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight", dailyGoal: 500 })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(800);

const home = await page.run(`(() => {
  const home = document.querySelector(".alt.home");
  return {
    background: getComputedStyle(home).backgroundColor,
    chrome: getComputedStyle(document.documentElement).getPropertyValue("--pv-chrome").trim(),
    text: home.innerText,
  };
})()`);
check("Home sits on the light chrome colour", home.background === "rgb(243, 238, 229)", `${home.background}, chrome ${home.chrome}`);
check("Home lists no snapshots", !/Snapshots|Hourly ·|Daily ·/.test(home.text));
const today = await page.run(`[...document.querySelectorAll(".stats > div")].map((stat) => stat.innerText.replace(/\\s+/g, " ").trim()).join(" | ")`);
check("words today show without a goal", /^\d+ words today/.test(today) && !today.includes("/ 500"), today);
await page.shoot(`${shots}home-light.png`);
const stored = await page.run(`JSON.parse(localStorage.getItem("pensieve-prefs") || "{}")`);
check("a saved daily goal is kept for the Goals list", stored.dailyGoal === 500, stored.dailyGoal);

// Settings no longer offer a daily goal.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "Writing");
await sleep(400);
const writing = await page.run(`document.querySelector(".window")?.innerText ?? ""`);
check("Settings have no daily goal", !/daily/i.test(writing) && /Book target|target/i.test(writing), writing.replace(/\s+/g, " ").slice(0, 90));
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);

// The floating bar counts today's words, with no goal meter.
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
const bar = await page.run(`({ today: document.querySelector(".statusbar .today")?.innerText.trim(), meter: !!document.querySelector(".statusbar .meter") })`);
check("the floating bar says Today without a meter", /^Today \d+$/.test(bar.today ?? "") && !bar.meter, JSON.stringify(bar));

// Write something after the book's first snapshots, then put the whole book back.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("A line that the restore will take away.");
await sleep(2500);
check("the new line is on the page", (await editorText()).includes("A line that the restore will take away."));
await page.clickText("button", "Earlier versions");
await until(`!!document.querySelector(".history button[aria-pressed]")`);
const panel = await page.run(`document.querySelector(".window")?.innerText ?? ""`);
check("Earlier versions opens in a window, listing the book's snapshots", panel.startsWith("Earlier versions") && /Hourly|Daily/.test(panel), panel.split("\n").slice(0, 3).join(" / "));
await page.run(`[...document.querySelectorAll(".history button[aria-pressed]")].at(-1).click(), true`);
await until(`!!document.querySelector(".history .then h2")`);
check("the chosen snapshot is marked", await page.run(`!!document.querySelector('.history button[aria-pressed="true"]')`));
await page.clickText(".window footer button", "Restore the whole book");
check("restoring the whole book asks first", await until(`(document.querySelector(".window footer")?.innerText ?? "").includes("Before restore")`));
await page.shoot(`${shots}history-confirm.png`);
const inView = await page.run(`(() => { const panel = document.querySelector(".window").getBoundingClientRect(); const button = [...document.querySelectorAll(".window footer button")].find((b) => b.textContent.includes("Restore the whole book")).getBoundingClientRect(); return button.bottom <= panel.bottom && button.top >= panel.top; })()`);
check("the confirm button is in view without scrolling", inView);
const rows = await page.run(`[...document.querySelectorAll(".history button[aria-pressed]")].map((b) => b.getAttribute("aria-pressed") + " " + getComputedStyle(b).backgroundColor + " " + getComputedStyle(b).fontWeight)`);
check("only the chosen snapshot is highlighted", rows.filter((row) => !row.includes("rgba(0, 0, 0, 0)")).length === 1 && rows.at(-1).startsWith("true"), rows.join(" | "));
await page.clickText(".window footer button.primary", "Restore the whole book");
await until(`!document.querySelector(".history") && !!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
check("the whole book is back as it was", !(await editorText()).includes("A line that the restore will take away."));
await page.clickText("button", "Earlier versions");
await until(`!!document.querySelector(".history button[aria-pressed]")`);
check("what was there is kept as Before restore", (await page.run(`document.querySelector(".history .snaps")?.innerText ?? ""`)).includes("Before restore"));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
