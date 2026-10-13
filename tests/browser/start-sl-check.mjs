// Checks a first start in Slovenian, the default, when the library already has an empty folder named
// like the first project: Pensieve makes the project in it rather than giving up on the library (the
// Windows side's "already there" was compared after translation). Then a name the library would hide.
// Usage: node start-sl-check.mjs [port]
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
const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const FOLDER = `${LIBRARY}\\Moj prvi projekt`;

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(
  `window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", sidebarView: "library" })), localStorage.setItem("pv-folders", JSON.stringify([${JSON.stringify(FOLDER)}])), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue .go")`);
await sleep(500);
const books = await page.run(`[...window.__PV_HARNESS__.books.keys()]`);
check("a first start makes the project in the library's empty folder of that name", books.includes(`sqlite:${FOLDER}\\pensieve.db`) && !books.some((key) => key.includes("C:\\Books")), JSON.stringify(books));
const warning = await page.run(`document.querySelector(".error[role=alert]")?.textContent.trim() ?? ""`);
check("and Home has nothing to warn about", !warning, warning);

await page.click(".home .continue .go");
await until(`!!document.querySelector(".library")`);
await sleep(400);
await page.click(".sidebar-head .add");
await until(`!!document.querySelector(".tree-menu")`);
await page.run(`[...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === "Nov projekt")?.click()`);
// The New project window (since 12 October), its name field taking the keyboard.
await until(`!!document.activeElement?.matches(".window .field input")`);
await page.type("$denar");
await page.key("Enter", "Enter", 13);
await until(`!!document.querySelector(".window [role=alert]")`);
const problem = await page.run(`document.querySelector(".window [role=alert]")?.textContent.trim() ?? ""`);
check("a name starting with a dollar sign is refused, in Slovenian", problem === "Ime se ne sme začeti s piko ali z znakom za dolar.", problem);
await page.key("Escape", "Escape", 27);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
