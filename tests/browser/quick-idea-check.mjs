// Checks quick ideas (owner, 12 October; Home's box moved to the Ideas tab on 13 October): Ctrl+Shift+N opens
// the Quick idea window from Home and from the page she writes on; Enter keeps the idea among the open
// project's Ideas, tied to no chapter; Shift+Enter starts another line, its text; Escape gives the keyboard
// back to the page, with nothing typed into it. Usage: node --experimental-websocket quick-idea-check.mjs [port]
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
const CTRL_SHIFT = 2 | 8;
const ideaRows = () =>
  page.run(`(() => {
    const db = [...window.__PV_HARNESS__.books.values()][0];
    const rows = db?.exec("SELECT n.title, n.category, n.plain_text, (SELECT count(*) FROM note_chapters c WHERE c.note_id = n.id) FROM notes n WHERE n.category = 'ideas' ORDER BY n.created_at");
    return rows?.[0]?.values ?? [];
  })()`);

await page.open(`http://127.0.0.1:${port}/`, 1500);
await page.run(`window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", theme: "daylight", sidebarView: "library" })), true`);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .right")`);
await sleep(500);
check("Home has no Ideas box: ideas have their own tab", !(await page.run(`!!document.querySelector(".home .ideas, .home .capture")`)));

// Ctrl+Shift+N on Home: the window; Shift+Enter starts another line, Enter keeps it.
await page.run(`document.activeElement?.blur(), true`);
await page.key("N", "KeyN", 78, CTRL_SHIFT);
check("Ctrl+Shift+N opens the Quick idea window on Home", (await until(`!!document.querySelector(".window textarea")`)) && (await page.run(`document.activeElement?.matches(".window textarea")`)));
await page.type("Čarovnica");
await page.key("Enter", "Enter", 13, 8);
await page.type("Živi pri mlinu.");
await page.shoot(`${shots}quick-idea-window.png`);
await page.key("Enter", "Enter", 13);
await until(`!document.querySelector(".window")`);
await sleep(400);
const first = (await ideaRows()).find((row) => row[0] === "Čarovnica");
check("Enter keeps it among the project's Ideas, tied to no chapter, the second line its text", first?.[1] === "ideas" && first?.[2] === "Živi pri mlinu." && first?.[3] === 0, JSON.stringify(first));

// From the page she writes on: the window over it, and Escape gives the keyboard back.
await page.click(".home .continue .go");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(800);
await page.run(`document.querySelector(".paper .ProseMirror").focus(), true`);
const textBefore = await page.run(`document.querySelector(".paper .ProseMirror").textContent`);
await page.key("N", "KeyN", 78, CTRL_SHIFT);
check("Ctrl+Shift+N opens it over the page too", await until(`!!document.querySelector(".window textarea")`));
const typedIn = (await page.run(`document.querySelector(".paper .ProseMirror").textContent`)) !== textBefore;
await page.key("Escape", "Escape", 27);
await until(`!document.querySelector(".window")`);
await sleep(200);
check("the shortcut types nothing into the page", !typedIn);
check("Escape closes it and the page has the keyboard again", await page.run(`!!document.activeElement?.closest(".paper .ProseMirror")`));
await page.key("N", "KeyN", 78, CTRL_SHIFT);
await until(`!!document.querySelector(".window textarea")`);
await page.type("Most čez Savo");
await page.key("Enter", "Enter", 13);
await until(`!document.querySelector(".window")`);
await sleep(300);
check("kept from the page, said in the status bar", (await page.run(`document.body.innerText.includes("Saved among the ideas of")`)) && (await ideaRows()).some((row) => row[0] === "Most čez Savo"));

await page.click(".gear");
await until(`!!document.querySelector(".window")`);
await page.clickText(".window nav button", "Shortcuts");
await sleep(300);
check("Settings lists Ctrl+Shift+N", await page.run(`document.querySelector(".window .keys")?.textContent.includes("Quick idea")`));

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
