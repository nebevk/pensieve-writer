// A keyboard-only walk through Pensieve (IMP-25), in Slovenian at 1366 × 768: Tab through Home (cards and list),
// Write (with the notes panel too), Notes, Ideas, Outline, Book, To-dos, Settings, Earlier versions and New
// project. Every stop must have a name, be on screen, and show where the keyboard is (a ring, or its field's
// frame lit; the page itself shows its caret instead). The windows keep the keyboard inside and Esc gives it
// back; a library row's menu works from the keyboard alone. Usage: node keys-walk-check.mjs [port]
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
// Where the keyboard is, as she would see and hear it.
const STOP = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const r = el.getBoundingClientRect();
  const label = el.labels && el.labels[0] ? el.labels[0].textContent : "";
  const name = (el.getAttribute("aria-label") || label || (el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? el.getAttribute("placeholder") : el.textContent) || el.getAttribute("title") || "").replace(/\\s+/g, " ").trim();
  let shown = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  for (let up = el; up && shown; up = up.parentElement) { const st = getComputedStyle(up); if (st.visibility === "hidden" || st.opacity === "0" || st.display === "none") shown = false; }
  const lit = (st) => (st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0) || st.boxShadow !== "none";
  let ring = el.isContentEditable || lit(getComputedStyle(el));
  for (let up = el.parentElement, depth = 0; up && depth < 3 && !ring; up = up.parentElement, depth += 1) ring = lit(getComputedStyle(up)) && up.matches(":focus-within");
  return { tag: el.tagName.toLowerCase(), name: name.slice(0, 40), at: Math.round(r.left) + "," + Math.round(r.top), shown, ring, inWindow: !!el.closest(".window") };
})()`;
const walk = async (max = 90) => {
  await page.run(`(document.activeElement?.blur?.(), true)`);
  const stops = [];
  for (let index = 0; index < max; index += 1) {
    await page.key("Tab", "Tab", 9);
    await sleep(60);
    const stop = await page.run(STOP);
    if (!stop) continue;
    const key = `${stop.tag}|${stop.name}|${stop.at}`;
    if (stops.some((seen) => seen.key === key)) break;
    stops.push({ ...stop, key });
  }
  return stops;
};
const problems = (stops) =>
  stops.filter((stop) => !stop.name || !stop.shown || !stop.ring).map((stop) => `${stop.tag} "${stop.name}"${stop.shown ? "" : " hidden"}${stop.ring ? "" : " no ring"}${stop.name ? "" : " no name"}`);
const view = async (label, least) => {
  const stops = await walk();
  check(`${label}: ${stops.length} stops, each named, on screen and showing the keyboard`, stops.length >= least && problems(stops).length === 0, problems(stops).join(" | ") || `${stops.length} stops`);
  return stops;
};
const inside = async (label, least) => {
  const stops = await walk(50);
  check(`${label}: ${stops.length} stops, each named and showing the keyboard, never leaving the window`, stops.length >= least && problems(stops).length === 0 && stops.every((stop) => stop.inWindow), [...problems(stops), ...stops.filter((stop) => !stop.inWindow).map((stop) => `outside: ${stop.name}`)].join(" | ") || `${stops.length} stops`);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);

await view("Home with the projects as cards", 15);
await page.run(`[...document.querySelectorAll(".home .right .switch button")].find((el) => el.textContent.includes("Seznam")).click(), true`);
await sleep(500);
await view("Home with the projects as a list", 20);

// A library row's menu, from the keyboard alone: Shift+F10 opens it at the row, the arrows move, Esc gives the row the keyboard back.
await page.run(`[...document.querySelectorAll(".home .library button.tree-row.project")][0].focus(), true`);
await page.key("F10", "F10", 121, 8);
const opened = await until(`!!document.querySelector(".tree-menu") && document.activeElement?.closest(".tree-menu") !== null`, 20);
const firstItem = await page.run(`document.activeElement?.textContent.trim() ?? ""`);
await page.key("ArrowDown", "ArrowDown", 40);
const nextItem = await page.run(`document.activeElement?.textContent.trim() ?? ""`);
await page.key("Escape", "Escape", 27);
await sleep(300);
check(
  "a project row's menu works from the keyboard: Shift+F10 opens it, the arrows move, Esc gives the row the keyboard back",
  opened && firstItem !== nextItem && (await page.run(`!document.querySelector(".tree-menu") && document.activeElement?.classList.contains("tree-row")`)),
  `${firstItem} → ${nextItem}`,
);

await page.clickText(".home button", "Nadaljuj s pisanjem");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
await view("Write", 50);
await page.click('.ribbon button[aria-label="Plošča z zapiski"]');
await sleep(600);
await view("Write with the notes panel", 50);
await page.clickText(".titlebar [role=tab]", "Zapiski");
await sleep(800);
await view("Notes", 12);
await page.clickText(".titlebar [role=tab]", "Ideje");
await sleep(800);
await view("Ideas", 12);
await page.clickText(".titlebar [role=tab]", "Oris");
await sleep(800);
await view("Outline", 12);
await page.clickText(".titlebar [role=tab]", "Knjiga");
await sleep(1500);
await view("Book", 10);
await page.clickText(".titlebar [role=tab]", "Zapiski");
await sleep(500);
await page.clickText("button", "Opravila");
await sleep(800);
await view("To-dos", 12);

// The windows keep the keyboard, and Esc gives it back where it was.
await page.run(`document.querySelector(".gear").focus(), true`);
await page.key("Enter", "Enter", 13);
await until(`!!document.querySelector(".window")`);
await sleep(400);
await inside("Settings", 20);
await page.key("Escape", "Escape", 27);
check("Esc closes Settings and gives the keyboard back to its button", (await until(`!document.querySelector(".window")`, 20)) && (await page.run(`document.activeElement?.classList.contains("gear")`)));
await page.clickText(".titlebar [role=tab]", "Pisanje");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(600);
await page.clickText("button", "Prejšnje različice");
await until(`!!document.querySelector(".window")`);
await sleep(600);
await inside("Earlier versions", 2);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.click(".titlebar .mark");
await until(`!!document.querySelector(".home .continue")`);
await sleep(600);
await page.clickText(".home button", "Nov projekt");
await until(`!!document.querySelector(".window")`);
await sleep(600);
await inside("New project", 3);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
