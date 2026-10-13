// Checks HOME-15 on Home's library: a project of the library goes to the Recycle Bin once she said so (from
// its menu or with Del), never the open one; one Windows won't move stays, and Home says why; a project kept
// elsewhere only leaves the list, its file where it is. Then the question in Slovenian.
// Usage: node delete-project-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const page = await connect({ width: 1366, height: 768 });
await page.harness();
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

const ELSEWHERE = "C:\\Users\\Eva\\Desktop\\Stara knjiga\\pensieve.db";
const rowSel = (name) =>
  `[...document.querySelectorAll(".home .library button.tree-row.project")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const hasRow = (name) => page.run(`!!(${rowSel(name)})`);
const menuOn = (name) =>
  page.run(`(() => { const el = ${rowSel(name)}; if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 10 })); return true; })()`);
const menuItems = () =>
  page.run(`[...document.querySelectorAll(".tree-menu button")].map((el) => (el.disabled ? "(off) " : "") + (el.querySelector(".label")?.textContent.trim() ?? "") + (el.querySelector(".keys") ? " [" + el.querySelector(".keys").textContent.trim() + "]" : ""))`);
const question = () => page.run(`document.querySelector(".tree-menu .question")?.textContent.trim() ?? ""`);
const choose = async (label) => {
  await until(`!!document.querySelector(".tree-menu")`);
  return page.run(`(() => { const el = [...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === ${JSON.stringify(label)}); if (!el || el.disabled) return false; el.click(); return true; })()`);
};
const trashed = () => page.run(`window.__PV_HARNESS__.trashed ?? []`);
const prefs = () => page.run(`JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}")`);
const bookOf = (folder) => page.run(`[...window.__PV_HARNESS__.books.keys()].find((key) => key.includes(${JSON.stringify(`\\${folder}\\`)})) ?? ""`);

// A project from before the library, kept on the desktop: it is listed under Elsewhere.
await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(
  `localStorage.clear(), localStorage.setItem('pensieve-prefs', JSON.stringify({ uiLanguage: 'en', knownProjects: [{ path: ${JSON.stringify(ELSEWHERE)}, title: 'Stara knjiga' }] })), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 500);
await until(`!!document.querySelector(".home .continue")`);

// The example projects, so the library has more than the open one.
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
// Home's projects as the library's list (its cards have no menu).
await page.run(`[...document.querySelectorAll(".home .right .switch button")].find((el) => el.textContent.includes("List")).click(), true`);
await until(`!!(${rowSel("The Lantern series")}) && !!(${rowSel("Zgodbe ob reki")})`);
await sleep(300);
const lantern = await bookOf("The Lantern series");
const samplesBefore = (await prefs()).samples ?? {};

// A project of the library: its menu ends with Delete, which asks first.
await menuOn("The Lantern series");
const lanternMenu = await menuItems();
check("a library project's menu offers to delete it, with its key", lanternMenu.at(-1) === "Delete the project [Del]" && !lanternMenu.includes("Remove from the list"), JSON.stringify(lanternMenu));
await choose("Delete the project");
await until(`!!document.querySelector(".tree-menu .question")`);
check(
  "it asks first, saying where the project goes",
  (await question()) === "Move “The Lantern series” and everything in its folder to the Recycle Bin? You can bring it back from there." &&
    JSON.stringify(await menuItems()) === JSON.stringify(["Move to the Recycle Bin", "Cancel"]),
  `${await question()} ${JSON.stringify(await menuItems())}`,
);
await choose("Cancel");
await sleep(400);
check("Cancel leaves it where it is", (await trashed()).length === 0 && (await hasRow("The Lantern series")), JSON.stringify(await trashed()));

await menuOn("The Lantern series");
await choose("Delete the project");
await until(`!!document.querySelector(".tree-menu .question")`);
await choose("Move to the Recycle Bin");
await until(`!(${rowSel("The Lantern series")})`);
const gone = await trashed();
check(
  "the project's folder goes to the Recycle Bin, and off Home",
  gone.length === 1 && lantern.endsWith(`${gone[0]}\\pensieve.db`) && gone[0].endsWith("\\Examples\\The Lantern series") && !(await hasRow("The Lantern series")),
  `${JSON.stringify(gone)} ${lantern}`,
);
await until(`!Object.keys(JSON.parse(localStorage.getItem("pensieve-prefs") ?? "{}").samples ?? {}).includes("the-lantern-series")`);
const after = await prefs();
check(
  "Pensieve forgets it: no longer an example to reset, nor a known project",
  "the-lantern-series" in samplesBefore && !("the-lantern-series" in (after.samples ?? {})) && "zgodbe-ob-reki" in (after.samples ?? {}) && !(after.knownProjects ?? []).some((item) => lantern.includes(item.path)),
  JSON.stringify(after.samples),
);
check("the other projects stay", (await hasRow("Zgodbe ob reki")) && (await hasRow("My first project")));

// The open project can't go: its Delete is there but off.
await menuOn("My first project");
const openMenu = await menuItems();
check("the open project's Delete is off", openMenu.includes("(off) Delete the project [Del]"), JSON.stringify(openMenu));
check("and choosing it does nothing", !(await choose("Delete the project")) && (await trashed()).length === 1);
await page.key("Escape", "Escape", 27);
await sleep(200);

// One Windows won't move (a file in it held open): it stays, and Home says why. With Del, from the keyboard.
const river = await bookOf("Zgodbe ob reki");
await page.run(`window.__PV_HARNESS__.openPools.add(${JSON.stringify(river)}), true`);
await page.run(`(${rowSel("Zgodbe ob reki")}).focus(), true`);
await page.key("Delete", "Delete", 46);
await until(`!!document.querySelector(".tree-menu .question")`);
check("Del on a project asks the same question", (await question()).startsWith("Move “Zgodbe ob reki” and everything in its folder"), await question());
await choose("Move to the Recycle Bin");
const refused = "Windows couldn't move the folder to the Recycle Bin; close what has it open and try again";
check("a folder Windows won't move stays, and Home says why", await until(`[...document.querySelectorAll("[role=alert]")].some((el) => el.textContent.trim() === ${JSON.stringify(refused)})`), await page.run(`[...document.querySelectorAll("[role=alert]")].map((el) => el.textContent.trim()).join(" | ")`));
check("nothing of it went", (await hasRow("Zgodbe ob reki")) && (await trashed()).length === 1 && "zgodbe-ob-reki" in ((await prefs()).samples ?? {}));
check("Home's message goes by itself", await until(`![...document.querySelectorAll("[role=alert]")].some((el) => el.textContent.trim() === ${JSON.stringify(refused)})`, 60));
await page.run(`window.__PV_HARNESS__.openPools.delete(${JSON.stringify(river)}), true`);

// A project kept elsewhere is only taken off the list.
await until(`!!(${rowSel("Stara knjiga")})`);
await menuOn("Stara knjiga");
const elsewhereMenu = await menuItems();
check("a project kept elsewhere offers Remove from the list, not Delete", elsewhereMenu.at(-1) === "Remove from the list" && !elsewhereMenu.some((item) => item.includes("Delete the project")), JSON.stringify(elsewhereMenu));
await choose("Remove from the list");
await until(`!(${rowSel("Stara knjiga")})`);
check(
  "it leaves the list, its file where it is",
  !(await hasRow("Stara knjiga")) && !((await prefs()).knownProjects ?? []).some((item) => item.path === ELSEWHERE) && (await trashed()).length === 1,
  JSON.stringify((await prefs()).knownProjects?.map((item) => item.path)),
);

// In Slovenian.
await page.click(".home .lang");
await until(`document.querySelector(".home .lang")?.textContent.trim() === "SL"`);
await sleep(300);
await menuOn("Zgodbe ob reki");
const slovenianMenu = await menuItems();
await choose("Izbriši projekt");
await until(`!!document.querySelector(".tree-menu .question")`);
check(
  "in Slovenian: Izbriši projekt, and the question",
  slovenianMenu.at(-1) === "Izbriši projekt [Del]" && (await question()) === "Premaknem »Zgodbe ob reki« in vse v njegovi mapi v Koš? Od tam ga lahko vrnete." && JSON.stringify(await menuItems()) === JSON.stringify(["Premakni v Koš", "Prekliči"]),
  `${slovenianMenu.at(-1)} | ${await question()} | ${JSON.stringify(await menuItems())}`,
);
await choose("Prekliči");

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
