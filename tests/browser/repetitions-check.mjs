// Checks Repetitions (owner, 12 October): the toolbar's switch marks a word said again close by (both times)
// and a very long sentence, each saying what it is when pointed at; the paragraph she types in loses its
// marks until she pauses; Zen hides them; the switch is remembered; off, there are none.
// Usage: node --experimental-websocket repetitions-check.mjs [port]
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
const echoes = () => page.run(`[...document.querySelectorAll(".paper .pv-echo")].map((el) => el.textContent)`);
const switchOn = () => page.run(`document.querySelector('.ribbon button[aria-label="Repetitions"]')?.getAttribute("aria-pressed")`);
const long = Array.from({ length: 45 }, (_, index) => ["pes", "mačka", "miš", "kos", "vrana"][index % 5]).join(" ");

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
// Her own words at the end of the page: a word said again, a long sentence.
await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
await page.key("Enter", "Enter", 13);
await page.type("Stara hiša stoji ob reki. Ob reki raste vrba.");
await page.key("Enter", "Enter", 13);
await page.type(`${long}.`);
await page.key("Enter", "Enter", 13);
await sleep(1500);
check("off to begin with: nothing marked", (await switchOn()) === "false" && (await echoes()).length === 0, await switchOn());

await page.run(`document.querySelector('.ribbon button[aria-label="Repetitions"]').click(), true`);
await until(`document.querySelectorAll(".paper .pv-echo").length > 0`, 60);
const marked = await echoes();
check("the toolbar's Repetitions marks a word said again close by, both times", (await switchOn()) === "true" && marked.filter((word) => word === "reki").length === 2, JSON.stringify(marked));
check("pointed at, a mark says what it is", (await page.run(`[...document.querySelectorAll(".paper .pv-echo")].find((el) => el.textContent === "reki")?.title`)) === "“reki” again, close by");
const sentence = await page.run(`(() => { const pieces = [...document.querySelectorAll(".paper .pv-long-sentence")]; return pieces.length ? { title: pieces[0].title, text: pieces.map((el) => el.textContent).join("").slice(0, 12) } : null; })()`);
check("a very long sentence is marked, saying how long", sentence?.title === "A long sentence: 45 words" && sentence.text.startsWith("pes mačka"), JSON.stringify(sentence));
await page.shoot(`${shots}repetitions.png`);

// Typing in a marked paragraph: its marks wait for the pause, then come back.
await page.run(`(() => { const el = [...document.querySelectorAll(".paper .pv-echo")].find((mark) => mark.textContent === "reki"); const range = document.createRange(); range.setStart(el.closest("p").lastChild, el.closest("p").lastChild.textContent.length); range.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(range); document.querySelector(".paper .ProseMirror").focus(); return true; })()`);
await page.type(" Tiho");
await sleep(100);
const whileTyping = await page.run(`[...document.querySelectorAll(".paper p")].find((p) => p.textContent.includes("Stara hiša"))?.querySelectorAll(".pv-echo").length`);
check("the paragraph she types in has no marks while she types", whileTyping === 0, String(whileTyping));
check("and they come back once she pauses", await until(`([...document.querySelectorAll(".paper p")].find((p) => p.textContent.includes("Stara hiša"))?.querySelectorAll(".pv-echo").length ?? 0) >= 2`, 40));

// Zen is for writing on: the marks wait until she's back.
await page.key("Escape", "Escape", 27);
await page.run(`document.querySelector('.ribbon button[aria-label="Zen"], .ribbon button[title="Zen"]')?.click(), true`);
await until(`!document.querySelector(".ribbon")`, 30);
await sleep(600);
check("Zen hides the marks", (await echoes()).length === 0, JSON.stringify(await echoes()));
await page.key("Escape", "Escape", 27);
await until(`!!document.querySelector(".ribbon")`, 30);
check("and leaving Zen shows them again", await until(`document.querySelectorAll(".paper .pv-echo").length >= 2`, 40));

// Remembered, and off is off.
await page.open(`http://127.0.0.1:${port}/`, 2500);
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
check("the switch is remembered, and the page opens marked", (await switchOn()) === "true" && (await until(`document.querySelectorAll(".paper .pv-echo").length >= 2`, 60)));
await page.run(`document.querySelector('.ribbon button[aria-label="Repetitions"]').click(), true`);
await sleep(400);
check("turned off, nothing is marked", (await switchOn()) === "false" && (await echoes()).length === 0 && !(await page.run(`!!document.querySelector(".paper .pv-long-sentence")`)));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
