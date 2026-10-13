// The restore drill (IMP-7): a book with č, š, ž and a picture is written to the project's database, kept as
// an earlier version and as a Drive backup, written over, and put back from each; every time the page must
// read exactly as it did, the picture too, and still after Pensieve starts again. Then a look at how the
// file keeps the picture (IMP-6): once, however many saves and earlier versions there are.
// Usage: node restore-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
await page.harness({ keep: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const until = async (expression, tries = 80) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await page.run(expression)) return true;
    await sleep(150);
  }
  return false;
};

const PICTURE = "C:\\Users\\Eva\\Pictures\\reka.png";
const BACKUPS = "C:\\Users\\Eva\\Google Drive\\Pensieve";
// The page as she sees it: its words, and the picture's own data.
const seen = () =>
  page.run(`(() => {
    const editor = document.querySelector(".paper .ProseMirror");
    return editor ? { text: editor.innerText.replace(/\\s+$/, ""), pictures: [...editor.querySelectorAll("img")].map((img) => img.getAttribute("src")) } : null;
  })()`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const toEnd = () =>
  page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
// Ctrl+S, then the window bar says it is saved.
const save = async () => {
  await page.key("s", "KeyS", 83, 2);
  return until(`/^Saved/.test(document.querySelector(".titlebar .save")?.textContent.trim() ?? "")`);
};
const answer = (...paths) => page.run(`(window.__PV_HARNESS__.dialogAnswers = ${JSON.stringify(paths)}, true)`);
// A button by its whole label: Settings has "Choose folder…" for the Word copy above the backup's "Choose folder".
const press = (selector, label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
const openSettingsAt = async (section) => {
  await page.click(".titlebar .gear, .gear");
  await until(`!!document.querySelector(".window")`);
  await page.clickText(".window nav button, .window [role=tab]", section);
  await sleep(300);
};
const closeWindow = async () => {
  await page.key("Escape", "Escape", 27);
  await until(`!document.querySelector(".window")`);
};
const wipe = async (words) => {
  await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.key("Delete", "Delete", 46);
  await page.type(words);
  await save();
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);

// The book: her words with č, š, ž, and a picture from her Pictures folder.
await page.run(`(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 320;
  const pen = canvas.getContext("2d");
  pen.fillStyle = "#e8b04a"; pen.fillRect(0, 0, 480, 320);
  pen.fillStyle = "#2f5d8a"; pen.fillRect(40, 180, 400, 100);
  pen.fillStyle = "#b5483a"; pen.beginPath(); pen.arc(240, 120, 60, 0, Math.PI * 2); pen.fill();
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  window.__PV_HARNESS__.files.set(${JSON.stringify(PICTURE.toLowerCase())}, { path: ${JSON.stringify(PICTURE)}, base64 });
  return true;
})()`);
await toEnd();
await page.key("Enter", "Enter", 13);
await page.type("Čez reko je padal mrak, šepetal je žerjav.");
await page.key("Enter", "Enter", 13);
await page.type("Druga vrstica: č, š, ž in Č, Š, Ž.");
await page.key("Enter", "Enter", 13);
await answer(PICTURE);
await page.click('.ribbon button[aria-label="Image"]');
await until(`!!document.querySelector(".paper .ProseMirror img")?.complete`);
await toEnd();
await page.type("Pod sliko: konec poglavja.");
check("the book is written, with its picture, and saved", (await save()) && (await seen())?.pictures.length === 1, JSON.stringify((await seen())?.text.slice(-60)));

// An hour later (the clock moved on), one more word: that save keeps an hourly earlier version of the book.
await page.run(`(() => {
  const Real = Date;
  const shift = 3 * 60 * 60 * 1000;
  window.Date = class extends Real {
    constructor(...args) { if (args.length === 0) super(Real.now() + shift); else super(...args); }
    static now() { return Real.now() + shift; }
  };
  return true;
})()`);
await toEnd();
await page.type(" Še ena beseda.");
await save();
const kept = await seen();
check("the book as kept: words with č, š, ž and the picture", /Čez reko je padal mrak, šepetal je žerjav\./.test(kept.text) && /č, š, ž in Č, Š, Ž/.test(kept.text) && kept.pictures.length === 1 && kept.pictures[0].startsWith("data:image/"), JSON.stringify({ text: kept.text.slice(-80), picture: kept.pictures[0]?.slice(0, 30) }));

// Written over, then put back from the earlier version.
await wipe("Vse je izginilo.");
check("written over: the words and the picture are gone", !(await seen()).text.includes("žerjav") && (await seen()).pictures.length === 0);
await page.clickText("button", "Earlier versions");
await until(`!!document.querySelector(".history button[aria-pressed]")`);
// The newest are the hourly and daily ones the last save kept; the one before them is from the first start.
await page.run(`document.querySelector(".history button[aria-pressed]").click(), true`);
await until(`(document.querySelector(".history .text")?.textContent ?? "").includes("žerjav")`);
check("the earlier version shows the chapter as it was", (await page.run(`document.querySelector(".history .text")?.textContent ?? ""`)).includes("Še ena beseda."));
await page.clickText(".window footer button, .history button", "Restore this chapter");
await until(`!document.querySelector(".history") && (document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("žerjav")`);
await sleep(600);
const fromVersion = await seen();
check("restored from the earlier version: every word and the picture, exactly", same(fromVersion, kept), JSON.stringify({ text: fromVersion.text === kept.text, pictures: same(fromVersion.pictures, kept.pictures) }));
await save();

// A Drive backup, the book written over again, and put back from the backup.
await openSettingsAt("Backup & export");
await answer(BACKUPS);
await press(".window button", "Choose folder");
await until(`[...document.querySelectorAll(".window .path")].some((el) => el.textContent.includes("Google Drive"))`);
await press(".window button", "Back up now");
await until(`(window.__PV_HARNESS__.backups ?? []).length === 1`);
const backupPath = await page.run(`window.__PV_HARNESS__.backups[0]`);
const backupText = await page.run(`new TextDecoder().decode(Uint8Array.from(atob(window.__PV_HARNESS__.files.get(window.__PV_HARNESS__.backups[0].toLowerCase()).base64), (c) => c.charCodeAt(0)))`);
check("Back up now writes the book to the Drive folder, its picture inside", backupPath?.startsWith(`${BACKUPS}\\pensieve-`) && backupText.includes("šepetal je žerjav") && backupText.includes(kept.pictures[0]), backupPath);
await closeWindow();
await wipe("Spet vse izginilo.");
await openSettingsAt("Backup & export");
await answer(backupPath);
await press(".window button", "Restore from a backup…");
await until(`!!document.querySelector(".window .offer")`);
await press(".window .offer button", "Restore");
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("žerjav")`);
await closeWindow();
await sleep(600);
const fromBackup = await seen();
check("restored from the backup: every word and the picture, exactly", same(fromBackup, kept), JSON.stringify({ text: fromBackup.text === kept.text, pictures: same(fromBackup.pictures, kept.pictures) }));
await save();

// Pensieve starts again: the same book.
await page.run(`window.__PV_HARNESS__.keepAll(), true`);
await page.open(`http://127.0.0.1:${port}/`, 1000);
await page.clickText(".home button", "Continue writing");
await until(`(document.querySelector(".paper .ProseMirror")?.innerText ?? "").includes("žerjav")`);
await sleep(800);
const again = await seen();
check("after starting again, still every word and the picture", same(again, kept), JSON.stringify({ text: again.text === kept.text, pictures: same(again.pictures, kept.pictures) }));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
