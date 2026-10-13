// Checks the toolbar's text colour and highlight (TOOL-5), as in Word: each button's arrow opens its colours,
// a colour chosen goes on the selected words and becomes the button's own (the bar under the A, the swatch),
// the button then puts that colour on other words, and Automatic or No colour takes it off. Esc or a click
// elsewhere closes the colours. The colours are saved with the page. At 1366 × 768.
// Usage: node colours-check.mjs [port]
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
const arrow = (label) => page.run(`(() => { const el = document.querySelector('.ribbon button[aria-label="${label}"]'); el?.click(); return !!el; })()`);
const chips = () => page.run(`[...document.querySelectorAll(".ribbon .palette button")].map((el) => (el.getAttribute("aria-checked") === "true" ? "*" : "") + (el.getAttribute("aria-label") || el.textContent.trim()))`);
const choose = (label) => page.run(`(() => { const el = [...document.querySelectorAll(".ribbon .palette button")].find((b) => (b.getAttribute("aria-label") || b.textContent.trim()) === ${JSON.stringify(label)}); el?.click(); return !!el; })()`);
// What colours the words have on the page: [words, text colour name, its CSS colour, highlight name, its background].
const painted = () =>
  page.run(`[...document.querySelectorAll(".paper .ProseMirror span[data-color], .paper .ProseMirror mark[data-color]")].map((el) => [el.textContent, el.tagName === "MARK" ? "mark" : "span", el.dataset.color, el.tagName === "MARK" ? getComputedStyle(el).backgroundColor : getComputedStyle(el).color])`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`localStorage.clear(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 500);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Rdeča beseda, zelena senca in modro nebo.");
await sleep(300);

// The text colour's arrow opens its colours: Automatic, the look's colour first, then the rest.
await page.selectWords("Rdeča");
check("the text colour's arrow opens its colours", (await arrow("More text colours")) && (await until(`!!document.querySelector(".ribbon .palette")`)));
check("Automatic, then the look's colour (chosen now) and six more", JSON.stringify(await chips()) === JSON.stringify(["Automatic", "*The look's colour", "Red", "Orange", "Green", "Blue", "Purple", "Grey"]), JSON.stringify(await chips()));
const inside = await page.run(`(() => { const box = document.querySelector(".ribbon .palette").getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; })()`);
check("the colours fit the window", inside);
await page.shoot(`${new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")}colours-text.png`, { x: 300, y: 30, width: 520, height: 200 });
await choose("Red");
await sleep(300);
check("Red goes on the selected words, and the colours close", JSON.stringify(await painted()) === JSON.stringify([["Rdeča", "span", "red", "rgb(179, 38, 30)"]]) && !(await page.run(`!!document.querySelector(".ribbon .palette")`)), JSON.stringify(await painted()));
check("the A's bar is red now", (await page.run(`getComputedStyle(document.querySelector(".ribbon .tool.color")).boxShadow`)).includes("rgb(179, 38, 30)"));

// The highlight the same way.
await page.selectWords("zelena senca");
await arrow("More highlight colours");
await until(`!!document.querySelector(".ribbon .palette")`);
check("the highlight's colours: No colour, yellow (chosen now) and four more", JSON.stringify(await chips()) === JSON.stringify(["No colour", "*Yellow", "Green", "Blue", "Pink", "Orange"]), JSON.stringify(await chips()));
await choose("Green");
await sleep(300);
check("Green highlights the selected words", (await painted()).some((item) => item[0] === "zelena senca" && item[2] === "green" && item[3] === "rgb(207, 232, 196)"), JSON.stringify(await painted()));

// The buttons themselves put on the colours last chosen.
await page.selectWords("modro nebo");
await page.click('.ribbon button[aria-label="Text colour"]');
await sleep(200);
await page.selectWords("beseda");
await page.click('.ribbon button[aria-label="Highlight"]');
await sleep(300);
const after = await painted();
check("the A puts on red, the last colour chosen", after.some((item) => item[0] === "modro nebo" && item[2] === "red"), JSON.stringify(after));
check("the highlight button puts on green", after.some((item) => item[0] === "beseda" && item[1] === "mark" && item[2] === "green"), JSON.stringify(after));

// Automatic takes the colour off.
await page.selectWords("Rdeča");
await arrow("More text colours");
await until(`!!document.querySelector(".ribbon .palette")`);
check("Red is marked as the chosen one", (await chips()).includes("*Red"), JSON.stringify(await chips()));
await choose("Automatic");
await sleep(300);
check("Automatic takes the colour off", !(await painted()).some((item) => item[0].includes("Rdeča")), JSON.stringify(await painted()));

// Esc, or a click elsewhere, closes the colours. Opened with the mouse, the keyboard stays in the page;
// opened from the keyboard, it goes into the colours and comes back to the arrow.
await page.mouse('.ribbon button[aria-label="More highlight colours"]', "");
await until(`!!document.querySelector(".ribbon .palette")`);
await page.key("Escape", "Escape", 27);
check(
  "Esc closes colours opened with the mouse, the keyboard still in the page",
  (await until(`!document.querySelector(".ribbon .palette")`, 20)) && (await page.run(`!!document.activeElement?.closest(".ProseMirror")`)),
  await page.run(`document.activeElement?.className ?? ""`),
);
await page.run(`document.querySelector('.ribbon button[aria-label="More text colours"]').focus(), true`);
await page.key("Enter", "Enter", 13);
await until(`!!document.querySelector(".ribbon .palette")`);
check("opened from the keyboard, the keyboard goes into the colours", (await page.run(`document.activeElement?.closest(".palette") ? document.activeElement.textContent.trim() : ""`)) === "Automatic");
await page.key("Escape", "Escape", 27);
check("and Esc brings it back to the arrow", (await until(`!document.querySelector(".ribbon .palette")`, 20)) && (await page.run(`document.activeElement?.getAttribute("aria-label")`)) === "More text colours");
await arrow("More text colours");
await until(`!!document.querySelector(".ribbon .palette")`);
await page.run(`document.querySelector(".paper").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })), true`);
check("a click elsewhere closes them", await until(`!document.querySelector(".ribbon .palette")`, 20));

// Saved with the page.
await page.key("s", "KeyS", 83, 2);
await until(`/^Saved/.test(document.querySelector(".titlebar .save")?.textContent.trim() ?? "")`);
const stored = await page.run(`(() => { const key = [...window.__PV_HARNESS__.books.keys()].find((name) => name.includes("My first project")); const r = window.__PV_HARNESS__.books.get(key).exec("SELECT content_json FROM chapters"); return r[0].values.map((row) => row[0]).join(" "); })()`);
check("the colours are saved with the page", stored.includes('"type":"textColor","attrs":{"color":"red"}') && stored.includes('"type":"highlight","attrs":{"color":"green"}'), stored.match(/"type":"(textColor|highlight)","attrs":\{"color":"\w+"\}/g)?.join(" "));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
