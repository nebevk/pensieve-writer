// Checks updates: Settings shows the version and checks at once; with nothing newer it says so; with a
// newer version the window bar offers it, in Write and on Home; and choosing it saves her last words before
// the install starts. Usage: node updater-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1400, height: 860 });
await page.harness({ keep: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 60) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};
const FIRST = "C:\\Users\\Eva\\Documents\\Pensieve\\My first project\\pensieve.db";
const generalSettings = async () => {
  await page.click(".gear");
  await until(`!!document.querySelector(".window")`);
  await page.clickText(".window nav button, .window [role=tab]", "General");
  await sleep(300);
};
const settingsText = () => page.run(`document.querySelector(".window")?.innerText ?? ""`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue .go")`);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(500);

// Nothing newer: Settings says so.
await generalSettings();
check("Settings shows which Pensieve this is", (await settingsText()).includes("Pensieve 0.1.0"), (await settingsText()).slice(0, 80));
await page.clickText(".window button", "Check for updates");
await until(`document.querySelector(".window").innerText.includes("This is the newest version.")`);
check("with nothing newer, Check for updates says so", (await settingsText()).includes("This is the newest version."));
check("and the window bar offers nothing", !(await page.run(`!!document.querySelector(".update")`)));

// A newer version on GitHub Releases: the window bar offers it, in Write and on Home.
await page.run(`localStorage.setItem("pv-update", "0.2.0"), true`);
await page.clickText(".window button", "Check for updates");
await until(`!!document.querySelector(".titlebar .update")`);
check("a newer version shows in Settings, with Update now", (await settingsText()).includes("Version 0.2.0 is ready.") && (await settingsText()).includes("Update now"));
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
const pill = await page.run(`document.querySelector(".titlebar .update")?.textContent.trim() ?? ""`);
check("the window bar offers it in Write", pill === "New version 0.2.0 · Update", pill);
await page.click(".mark");
await until(`!!document.querySelector(".home-header .update")`);
check("and on Home", (await page.run(`document.querySelector(".home-header .update")?.textContent.trim() ?? ""`)) === "New version 0.2.0 · Update");
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(400);

// Choosing it: her last words are saved before the install starts.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Words typed just before the update.");
await page.click(".titlebar .update");
await until(`(window.__PV_HARNESS__.installed ?? 0) === 1`);
const saved = await page.run(`JSON.stringify(window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}`)}).exec("SELECT plain_text FROM chapters")[0].values)`);
check("choosing it saves her last words, then installs", (await page.run(`window.__PV_HARNESS__.installed`)) === 1 && saved.includes("Words typed just before the update."), saved.slice(0, 120));
check("the window bar says it is updating", (await page.run(`document.querySelector(".titlebar .update")?.textContent.trim() ?? ""`)).startsWith("Updating…"));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
