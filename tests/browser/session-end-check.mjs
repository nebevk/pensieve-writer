// Windows shutting down or signing out (ARCH-23): session.rs holds the session and asks the page to save; the page
// saves her last words, or keeps them in a rescue copy when saving fails, and says it is done, so Pensieve can close.
// The reason Windows shows comes from the page, in her language. Usage: node session-end-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
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
const SAVED = `JSON.stringify(window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}`)}).exec("SELECT plain_text FROM chapters")[0]?.values ?? [])`;
const RESCUE = `([...window.__PV_HARNESS__.keptCopies].find(([key]) => key.startsWith("rescue/"))?.[1].contents ?? "")`;
const typeAtEnd = async (text) => {
  await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.key("Enter", "Enter", 13);
  await page.type(text);
};
const sessionEnding = () => page.run(`(window.__PV_HARNESS__.emit("pensieve://session-ending"), true)`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(1000);
check("Windows is told why Pensieve makes it wait, in her language", (await page.run(`window.__PV_HARNESS__.sessionReason`)) === "Pensieve is saving your words", await page.run(`window.__PV_HARNESS__.sessionReason`));

// Words typed a moment before Windows asks to shut down: saved, then Pensieve says it may close.
await typeAtEnd("Zadnje besede pred izklopom: čšž.");
await sessionEnding();
check("her last words are saved before Pensieve lets Windows go on", await until(`${SAVED}.includes("Zadnje besede pred izklopom: čšž.") && window.__PV_HARNESS__.sessionSaved === 1`, 60), await page.run(SAVED));

// Saving fails: a rescue copy instead, then the same.
await page.run(`(window.__PV_HARNESS__.failSaves = true)`);
await typeAtEnd("Besede, ki jih reši le kopija.");
await sessionEnding();
check("when saving fails, they go into a rescue copy first", await until(`${RESCUE}.includes("Besede, ki jih reši le kopija.") && window.__PV_HARNESS__.sessionSaved === 2`, 60), await page.run(RESCUE));
await page.run(`(window.__PV_HARNESS__.failSaves = false)`);

// In Slovenian, Windows says it in Slovenian.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button[role=radio]", "Slovenščina");
check("and in Slovenian when she reads Slovenian", await until(`window.__PV_HARNESS__.sessionReason === "Pensieve shranjuje vaše besede"`, 40), await page.run(`window.__PV_HARNESS__.sessionReason`));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
