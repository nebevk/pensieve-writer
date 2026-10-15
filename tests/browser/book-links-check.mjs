// A link in the Book view opens in her browser or mail program, and the window stays on the book
// (reproduced 14 October: a click took the whole window to the web page, and with no Back button she
// could only close Pensieve). In installed Pensieve a guard on the window (links.rs) stops any other way
// out too; that one is checked by `cargo test`. Usage: node book-links-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
await page.harness({ keep: true });
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
const FIRST = "C:\\Users\\Eva\\Documents\\Pensieve\\My first project\\pensieve.db";
const DB = `window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${FIRST}`)})`;
const opened = () => page.run("JSON.stringify(window.__PV_HARNESS__.links)");

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
// A web link and an e-mail link at the end of the first chapter, as if written before.
await page.run(`(() => {
  const [id, json] = ${DB}.exec("SELECT id, content_json FROM chapters ORDER BY position LIMIT 1")[0].values[0];
  const doc = JSON.parse(json);
  const link = (text, href) => ({ type: "text", text, marks: [{ type: "link", attrs: { href } }] });
  doc.content.push({ type: "paragraph", content: [{ type: "text", text: "Glej " }, link("zemljevid Save", "https://example.com/zemljevid"), { type: "text", text: " in piši " }, link("Evi", "mailto:eva@example.com"), { type: "text", text: "." }] });
  ${DB}.run("UPDATE chapters SET content_json = ? WHERE id = ?", [JSON.stringify(doc), id]);
  return true;
})()`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
check("the chapter has its two links", await page.run(`document.querySelectorAll(".paper .ProseMirror a[href]").length === 2`));

await page.clickText(".titlebar [role=tab]", "Book");
check("the Book view lays its pages out", await until(`!!document.querySelector(".book[data-laid-out]")`, 80));
const where = await page.run("location.href");
check("the book has both links", await page.run(`document.querySelectorAll(".book .spreads a[href]").length === 2`));

await page.mouse(".book .spreads a[href]", "zemljevid");
await sleep(1200);
const after = await page.run("location.href");
check("a web link leaves the window on the book", after === where && (await page.run(`!!document.querySelector(".book .spreads")`)), after);
check("and opens in her browser", (await opened()) === JSON.stringify(["https://example.com/zemljevid"]), await opened());

await page.mouse(".book .spreads a[href]", "Evi");
await sleep(800);
check("an e-mail link opens her mail program, and the window stays", (await page.run("location.href")) === where && (await opened()) === JSON.stringify(["https://example.com/zemljevid", "mailto:eva@example.com"]), await opened());

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
