// Checks the Ideas map (owner, 13 October): Cards or Map; the map shows this project's ideas in rows until
// she moves one, then each stays where it is; a press opens one; a line drawn from an idea's dot to another
// links them with a [[link]] in the first one's text (the open idea's page shows it, and her next words keep
// it); a picked line can be taken away; a double click makes an idea there; a search fades the rest; the
// places are kept. Usage: node --experimental-websocket ideas-map-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
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
const openTitle = () => page.run(`(document.querySelector(".ideas-view aside.idea input.title")?.value ?? "").trim()`);
const linked = () => page.run(`[...document.querySelectorAll(".ideas-view aside.idea .linked button")].map((el) => el.textContent.trim())`);
const pageText = () => page.run(`document.querySelector(".ideas-view aside.idea .ProseMirror")?.textContent ?? ""`);
const nameIdea = async (name) => {
  await until(`document.activeElement?.matches(".ideas-view aside.idea input.title")`);
  await page.type(name);
};
const writeIdea = async (text) => {
  await page.run(`(() => { const editor = document.querySelector(".ideas-view aside.idea .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.type(text);
  await sleep(300);
};
const search = (words) =>
  page.run(`(() => { const input = document.querySelector(".ideas-view .search input"); input.value = ${JSON.stringify(words)}; input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);

// The map's cards, where they sit on it.
const mapCards = () =>
  page.run(`[...document.querySelectorAll(".ideas-view .map-card")].map((el) => ({ title: el.querySelector(".title").textContent.trim(), left: parseFloat(el.style.left), top: parseFloat(el.style.top), text: el.querySelector(".text")?.textContent.trim() ?? "", dim: el.classList.contains("dim"), open: el.classList.contains("open") }))`);
const cardOf = async (title) => (await mapCards()).find((card) => card.title === title);
const plane = () => page.run(`(() => { const r = document.querySelector(".ideas-view .plane").getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
const centreOf = async (title) => {
  const origin = await plane();
  const card = await cardOf(title);
  return { x: origin.x + card.left + 92, y: origin.y + card.top + 42 };
};
const dotOf = (title) =>
  page.run(`(() => { const card = [...document.querySelectorAll(".ideas-view .map-card")].find((el) => el.querySelector(".title").textContent.trim() === ${JSON.stringify(title)}); const r = card.querySelector(".dot").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const lines = () => page.run(`[...document.querySelectorAll(".ideas-view .lines line.link")].map((el) => ({ x1: +el.getAttribute("x1"), y1: +el.getAttribute("y1"), x2: +el.getAttribute("x2"), y2: +el.getAttribute("y2") }))`);

const mouse = (type, x, y, extra = {}) => page.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
async function press(at) {
  await mouse("mouseMoved", at.x, at.y, { button: "none" });
  await mouse("mousePressed", at.x, at.y, { buttons: 1 });
  await mouse("mouseReleased", at.x, at.y, { buttons: 0 });
  await sleep(250);
}
async function drag(from, to, steps = 10) {
  await mouse("mouseMoved", from.x, from.y, { button: "none" });
  await mouse("mousePressed", from.x, from.y, { buttons: 1 });
  for (let step = 1; step <= steps; step += 1) {
    await mouse("mouseMoved", from.x + ((to.x - from.x) * step) / steps, from.y + ((to.y - from.y) * step) / steps, { buttons: 1 });
    await sleep(16);
  }
  await mouse("mouseReleased", to.x, to.y, { buttons: 0 });
  await sleep(300);
}
async function doubleClick(at) {
  await mouse("mouseMoved", at.x, at.y, { button: "none" });
  await mouse("mousePressed", at.x, at.y, { buttons: 1, clickCount: 1 });
  await mouse("mouseReleased", at.x, at.y, { buttons: 0, clickCount: 1 });
  await mouse("mousePressed", at.x, at.y, { buttons: 1, clickCount: 2 });
  await mouse("mouseReleased", at.x, at.y, { buttons: 0, clickCount: 2 });
  await sleep(300);
}
const showMap = async () => {
  await page.clickText(".ideas-view .switch button", "Map");
  return until(`document.querySelectorAll(".ideas-view .map-card").length > 0`);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .right")`);
await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button, .window [role=tab]", "General");
await sleep(300);
await page.clickText(".window button", "Add example books");
await until(`document.body.innerText.includes("The example books are on Home.")`, 200);
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".titlebar [role=tab]")`);
await page.clickText(".titlebar [role=tab]", "Ideas");
await until(`!!document.querySelector(".ideas-view .empty")`);

// Three ideas, made as cards.
for (const [name, text] of [
  ["Stara hiša", "Ob reki stoji."],
  ["Čarovnica", "Živi pri mlinu."],
  ["Most čez Savo", ""],
]) {
  await page.clickText(".ideas-view .new", "New idea");
  await nameIdea(name);
  if (text) await writeIdea(text);
  await sleep(200);
}

// The map: in a row, oldest first, until she moves one.
check("the map opens", await showMap());
const first = await mapCards();
check(
  "the ideas sit in a row, oldest first",
  first.length === 3 &&
    new Set(first.map((card) => card.top)).size === 1 &&
    (await cardOf("Stara hiša")).left < (await cardOf("Čarovnica")).left &&
    (await cardOf("Čarovnica")).left < (await cardOf("Most čez Savo")).left,
  JSON.stringify(first.map((card) => [card.title, card.left, card.top])),
);
check("the hint says how", (await page.run(`document.querySelector(".ideas-view .status")?.textContent.trim()`)).length > 20, await page.run(`document.querySelector(".ideas-view .status")?.textContent.trim()`));
check(
  "All projects waits while the map is shown",
  await page.run(`[...document.querySelectorAll(".ideas-view .switch button")].find((el) => el.textContent.includes("All projects")).disabled`),
);
check("the newest idea is still open beside the map", (await openTitle()) === "Most čez Savo" && (await cardOf("Most čez Savo")).open);

// A drag moves an idea, and leaves the others where they were; it doesn't open it.
const witchBefore = await cardOf("Čarovnica");
const houseBefore = await cardOf("Stara hiša");
const houseFrom = await centreOf("Stara hiša");
await drag(houseFrom, { x: houseFrom.x + 60, y: houseFrom.y + 260 });
const houseAfter = await cardOf("Stara hiša");
const witchAfter = await cardOf("Čarovnica");
check("a drag moves the idea", Math.abs(houseAfter.left - (houseBefore.left + 60)) <= 1 && Math.abs(houseAfter.top - (houseBefore.top + 260)) <= 1, JSON.stringify([houseBefore, houseAfter].map((card) => [card.left, card.top])));
check("the others stay where they were", witchAfter.left === witchBefore.left && witchAfter.top === witchBefore.top, JSON.stringify([witchBefore, witchAfter].map((card) => [card.left, card.top])));
check("a drag doesn't open the idea", (await openTitle()) === "Most čez Savo", await openTitle());

// A press opens it.
await press(await centreOf("Čarovnica"));
check("a press opens the idea beside", (await openTitle()) === "Čarovnica" && (await cardOf("Čarovnica")).open, await openTitle());

// A line from the house's dot to the witch: a [[link]] in the house.
await drag(await dotOf("Stara hiša"), await centreOf("Čarovnica"));
check("a line drawn from an idea's dot to another links them", (await lines()).length === 1, JSON.stringify(await lines()));
check("with a [[link]] in the first one's text", (await cardOf("Stara hiša")).text.includes("Čarovnica"), (await cardOf("Stara hiša")).text);
check("the open idea shows where it is linked from", JSON.stringify(await linked()) === JSON.stringify(["← Stara hiša"]), JSON.stringify(await linked()));
await drag(await dotOf("Stara hiša"), await centreOf("Čarovnica"));
check("linking them again adds nothing", (await lines()).length === 1 && (await cardOf("Stara hiša")).text.split("Čarovnica").length === 2, (await cardOf("Stara hiša")).text);

// From the open idea: its page shows the link, and her next words keep it.
await press(await centreOf("Most čez Savo"));
await drag(await dotOf("Most čez Savo"), await centreOf("Stara hiša"));
check("a link from the open idea shows on its page", (await lines()).length === 2 && (await pageText()).includes("Stara hiša"), await pageText());
await writeIdea(" Kamen.");
await sleep(400);
check("and her next words keep it", (await lines()).length === 2 && (await cardOf("Most čez Savo")).text.includes("Stara hiša") && (await cardOf("Most čez Savo")).text.includes("Kamen."), (await cardOf("Most čez Savo")).text);
await page.shoot(`${shots}ideas-map.png`);

// A line picked, then taken away.
const houseToWitch = (await lines()).find((line) => line.x2 > line.x1 && line.y2 < line.y1) ?? (await lines())[0];
const origin = await plane();
await press({ x: origin.x + (houseToWitch.x1 + houseToWitch.x2) / 2, y: origin.y + (houseToWitch.y1 + houseToWitch.y2) / 2 });
check("a line picked offers to take the link away", await until(`!!document.querySelector(".ideas-view .unlink")`, 10));
await page.click(".ideas-view .unlink");
await sleep(400);
check("and takes it away, from the text too", (await lines()).length === 1 && !(await cardOf("Stara hiša")).text.includes("Čarovnica") && (await cardOf("Stara hiša")).text === "Ob reki stoji.", (await cardOf("Stara hiša")).text);
check("the other link stays", (await cardOf("Most čez Savo")).text.includes("Stara hiša"));

// A double click on the sheet: a new idea there, its name ready to be typed.
const spot = { x: origin.x + 760, y: origin.y + 420 };
const inside = await page.run(`(() => { const r = document.querySelector(".ideas-view .map").getBoundingClientRect(); return ${spot.x} > r.left && ${spot.x} < r.right && ${spot.y} > r.top && ${spot.y} < r.bottom; })()`);
check("(the spot is on the visible map)", inside);
await doubleClick(spot);
await nameIdea("Mlin");
await sleep(400);
const mill = await cardOf("Mlin");
check("a double click makes an idea there", !!mill && Math.abs(mill.left - (760 - 92)) <= 1 && Math.abs(mill.top - (420 - 42)) <= 1 && (await openTitle()) === "Mlin", JSON.stringify(mill));

// A search fades the ideas without its words.
await search("mlin");
await sleep(200);
const faded = (await mapCards()).filter((card) => card.dim).map((card) => card.title).sort();
check("a search fades the ideas without its words", JSON.stringify(faded) === JSON.stringify(["Most čez Savo", "Stara hiša"]), JSON.stringify(faded));
await search("");
await sleep(200);

// Kept.
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".titlebar [role=tab]")`);
await page.clickText(".titlebar [role=tab]", "Ideas");
await until(`!!document.querySelector(".ideas-view .card")`);
check("the tab opens on the cards", (await page.run(`document.querySelectorAll(".ideas-view .card").length`)) === 4);
await showMap();
const kept = await mapCards();
const at = (title) => kept.find((card) => card.title === title);
check(
  "the places are kept",
  at("Stara hiša").left === houseAfter.left && at("Stara hiša").top === houseAfter.top && at("Čarovnica").left === witchBefore.left && at("Mlin").left === mill.left && at("Mlin").top === mill.top,
  JSON.stringify(kept.map((card) => [card.title, card.left, card.top])),
);
check("and the links", (await lines()).length === 1);
await page.shoot(`${shots}ideas-map-kept.png`);
await page.run(`document.documentElement.dataset.theme = "moonlit", true`);
await page.shoot(`${shots}ideas-map-moonlit.png`);
await page.run(`document.documentElement.dataset.theme = "daylight", true`);

await page.clickText(".ideas-view .switch button", "Cards");
await sleep(300);
check(
  "Cards shows them as cards again, with All projects",
  (await page.run(`document.querySelectorAll(".ideas-view .card").length`)) === 4 &&
    !(await page.run(`[...document.querySelectorAll(".ideas-view .switch button")].find((el) => el.textContent.includes("All projects")).disabled`)),
);

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
