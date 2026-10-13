// Checks Home's Continue card with long paragraphs in Slovenian, at a narrow and a wide window: the time it
// was edited stays on one line, the buttons stay inside the card (under the time when short of room), and the
// line under the card isn't covered. Usage: node home-card-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";

const port = Number(process.argv[2] ?? 4176);
const shots = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

const LONG_ONE =
  "Later, Nika would remember the sound of it more clearly than the words. The smell of apples and woodsmoke had not changed in twenty years, and neither had the creak of the third stair.";
const LONG_TWO =
  "In the morning the river was high and brown, and the ferry did not cross. By noon the fog had lifted from the mill, and the village came back piece by piece. Roofs first, then the church.";

for (const width of [1180, 1500]) {
  const page = await connect({ width, height: 860 });
  await page.harness({ keep: true });
  const until = async (expression, tries = 60) => {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      if (await page.run(expression)) return true;
      await sleep(150);
    }
    return false;
  };
  await page.open(`http://127.0.0.1:${port}/`, 1500);
  await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "sl", theme: "dusk" })), true`);
  await page.open(`http://127.0.0.1:${port}/`, 500);
  await until(`!!document.querySelector(".home .continue .go")`);
  await page.click(".home .continue .go");
  await until(`!!document.querySelector(".paper .ProseMirror")`);
  await sleep(600);
  // Two long paragraphs at the end of the chapter, as in a real manuscript.
  await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  for (const text of [LONG_ONE, LONG_TWO]) {
    await page.key("Enter", "Enter", 13);
    await page.run(`document.execCommand("insertText", false, ${JSON.stringify(text)})`);
  }
  await sleep(2600);
  await page.click(".mark");
  await until(`!!document.querySelector(".home .continue .go")`);
  await sleep(700);
  const box = await page.run(`(() => {
    const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const sheet = rect(".home .continue .sheet");
    const card = rect(".home .continue");
    const go = rect(".home .continue .go");
    const zen = rect(".home .continue .zen");
    const edited = document.querySelector(".home .continue .edited");
    // On the card since the owner's design of 13 October, beside the buttons or above them.
    const sound = rect(".home .continue .sheet .sound");
    const lineHeight = parseFloat(getComputedStyle(edited).lineHeight) || 18;
    return {
      inside: go.bottom <= sheet.bottom + 0.5 && zen.bottom <= sheet.bottom + 0.5,
      oneLine: edited.getBoundingClientRect().height <= lineHeight * 1.5,
      clear: sound.bottom <= sheet.bottom + 0.5 && (sound.right <= zen.left + 0.5 || sound.bottom <= zen.top + 0.5),
      together: Math.abs(go.top - zen.top) < 4,
      text: edited.textContent,
      sheet: Math.round(sheet.height),
    };
  })()`);
  check(`at ${width}px the buttons stay inside the card, together`, box.inside && box.together, JSON.stringify(box));
  check(`at ${width}px the time it was edited stays on one line`, box.oneLine, box.text);
  check(`at ${width}px the sound line sits on the card, clear of the buttons`, box.clear, JSON.stringify(box));
  await page.shoot(`${shots}home-card-${width}.png`);
  check(`no errors on the page at ${width}px`, page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
  page.close();
  await sleep(500);
}
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
