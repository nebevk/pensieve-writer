// Hushed Tales, the version for the owner's friends (IMP-29), as its own build shows it: its name in the welcome, the
// window's title, Home and the ribbon; a greeting without a name; its library in Documents\Hushed Tales; and not a
// word of Pensieve in anything it says, on Home, in Write or in any of Settings' sections, in Slovenian or English.
// Usage: node edition-hushed-check.mjs [port], or through run.mjs --hushed, which builds it.
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
// The tips on, as on a first start, so the welcome shows; off once it is read.
await page.harness({ tips: true });
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
// Where any text on the screen still says Pensieve, with a little around it.
const PENSIEVE = `(() => { const text = document.body.innerText; const at = text.search(/Pensiev/); return at < 0 ? "" : text.slice(Math.max(0, at - 40), at + 40).replace(/\\s+/g, " "); })()`;
const GREETING = `(document.querySelector(".home h1.greeting strong")?.textContent.trim() ?? "")`;
const press = (label) =>
  page.run(`(() => { const el = [...document.querySelectorAll(".window footer button")].find((b) => b.textContent.trim() === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);

/** Every section of Settings, each read through: what still says Pensieve, and the library's folder as shown. */
async function settingsSections() {
  await page.click(".gear");
  await until(`!!document.querySelector(".window nav")`);
  const sections = await page.run(`[...document.querySelectorAll(".window nav button")].map((button) => button.textContent.trim())`);
  const said = [];
  let library = "";
  for (const name of sections) {
    await page.clickText(".window nav button", name);
    await sleep(250);
    const left = await page.run(PENSIEVE);
    if (left) said.push(`${name}: ${left}`);
    library ||= await page.run(`[...document.querySelectorAll(".window .row .path")].map((el) => el.textContent.trim()).find((path) => /Hushed Tales$|Pensieve$/.test(path)) ?? ""`);
  }
  await page.key("Escape", "Escape", 27);
  await until(`!document.querySelector(".window")`);
  return { count: sections.length, said, library };
}

// A first start, nothing kept from before: in Slovenian, as it starts.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__?.forget?.(), localStorage.clear(), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);
check("a first start opens the welcome", await until(`!!document.querySelector(".welcome")`, 40));
const welcome = await page.run(`(() => { const win = document.querySelector(".welcome").closest(".window"); return { title: win.querySelector("header")?.innerText.trim() ?? "", text: win.innerText }; })()`);
check("the welcome is Hushed Tales', and doesn't say Pensieve", welcome.text.includes("Hushed Tales") && !/Pensiev/.test(welcome.text), welcome.text.slice(0, 120).replace(/\s+/g, " "));
await press("Preskoči");
await until(`!document.querySelector(".welcome")`);
await page.run(`(() => { const prefs = JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}"); localStorage.setItem("pensieve-prefs", JSON.stringify({ ...prefs, tips: false })); return true; })()`);
await page.open(`http://127.0.0.1:${port}/`, 1500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(400);
check("the window's title is Hushed Tales", (await page.run(`document.title`)) === "Hushed Tales", await page.run(`document.title`));
check("Home's bar says Hushed Tales", (await page.run(`document.querySelector(".home-header .name")?.textContent.trim()`)) === "Hushed Tales");
check("Home greets without a name", /^[^,]+\.$/.test(await page.run(GREETING)), await page.run(GREETING));
check("nothing on Home says Pensieve (sl)", (await page.run(PENSIEVE)) === "", await page.run(PENSIEVE));
let settings = await settingsSections();
check("no section of Settings says Pensieve (sl)", settings.count >= 6 && settings.said.length === 0, settings.said.join(" | "));
check("the library is in Documents\\Hushed Tales", /\\Documents\\Hushed Tales$/.test(settings.library), settings.library);

// Write, with the ribbon's group named after the app.
await page.clickText(".home button", "Nadaljuj s pisanjem");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
check("the ribbon names Hushed Tales", (await page.run(`[...document.querySelectorAll(".ribbon .group > p")].map((p) => p.textContent.trim())`)).includes("Hushed Tales"));
check("nothing in Write says Pensieve (sl)", (await page.run(PENSIEVE)) === "", await page.run(PENSIEVE));

// In English too.
await page.run(`(() => { const prefs = JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}"); localStorage.setItem("pensieve-prefs", JSON.stringify({ ...prefs, uiLanguage: "en" })); return true; })()`);
await page.open(`http://127.0.0.1:${port}/`, 1500);
await until(`!!document.querySelector(".home .continue")`);
await sleep(400);
check("in English, Home greets without a name", /^(Good morning|Good afternoon|Good evening|Late again)\.$/.test(await page.run(GREETING)), await page.run(GREETING));
check("nothing on Home says Pensieve (en)", (await page.run(PENSIEVE)) === "", await page.run(PENSIEVE));
settings = await settingsSections();
check("no section of Settings says Pensieve (en)", settings.said.length === 0, settings.said.join(" | "));
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
check("nothing in Write says Pensieve (en)", (await page.run(PENSIEVE)) === "", await page.run(PENSIEVE));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
