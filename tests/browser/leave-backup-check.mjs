// The project she leaves is backed up (ARCH-18): the hourly backup covers only the open project, so a project she
// switched away from waited for its next turn. Each project's last backup is remembered on its own, so switching
// back and forth writes no copy of the same. Usage: node leave-backup-check.mjs [port]
import { connect, sleep } from "./cdp.mjs";
import { clickFound } from "./tree-unfold.mjs";

const port = Number(process.argv[2] ?? 4176);
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
const LIBRARY = "C:\\Users\\Eva\\Documents\\Pensieve";
const FIRST = `${LIBRARY}\\My first project\\pensieve.db`;
const DRIVE = "C:\\Users\\Eva\\Google Drive\\Pensieve";
const db = (file) => `window.__PV_HARNESS__.books.get(${JSON.stringify(`sqlite:${file}`)})`;
const projectIdOf = (file) => page.run(`${db(file)}.exec("SELECT project_id FROM shelf")[0].values[0][0]`);
/** The backups written so far of a project, by its id, as backup.ts names them. */
const backupsOf = (projectId) =>
  page.run(`(window.__PV_HARNESS__.backups ?? []).filter((path) => path.includes("pensieve-" + ${JSON.stringify(projectId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8))} + "-")).length`);
const title = () => page.run(`document.querySelector(".titlebar .project")?.textContent.trim() ?? ""`);
const rowSel = (kind, name) =>
  `[...document.querySelectorAll(".library button.tree-row.${kind}")].find((el) => el.querySelector(".name")?.textContent.trim() === ${JSON.stringify(name)})`;
const typeAtEnd = async (text) => {
  await page.run(`(() => { const editor = document.querySelector(".paper .ProseMirror"); editor.focus(); const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); return true; })()`);
  await page.key("Enter", "Enter", 13);
  await page.type(text);
  await sleep(2600);
};
const openProject = async (name) => {
  await clickFound(page, rowSel("project", name));
  await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === ${JSON.stringify(name)}`);
  await sleep(800);
};

await page.open(`http://127.0.0.1:${port}/`, 1500);
// A backup folder chosen, and the last backup just now, so the hourly one stays out of the way.
await page.run(
  `window.__PV_HARNESS__.forget(), localStorage.setItem("pensieve-prefs", JSON.stringify({ uiLanguage: "en", sidebarView: "library", backupFolder: ${JSON.stringify(DRIVE)}, lastBackupAt: new Date().toISOString() })), true`,
);
await page.open(`http://127.0.0.1:${port}/`, 2500);
await until(`!!document.querySelector(".home .continue")`);
await page.clickText(".home button", "Continue writing");
await until(`!!document.querySelector(".paper .ProseMirror")`);
await sleep(1000);
const first = await projectIdOf(FIRST);
await typeAtEnd("Čaša, šola, žaba: besede prvega projekta.");

// A second project: the first is backed up as she leaves it.
await page.click(".sidebar-head .add");
await page.run(`([...document.querySelectorAll(".tree-menu button")].find((b) => b.querySelector(".label")?.textContent.trim() === "New project")?.click(), true)`);
await until(`!!document.activeElement?.matches(".window .field input")`);
await page.type("Druga zgodba");
await page.key("Enter", "Enter", 13);
await until(`(document.querySelector(".titlebar .project")?.textContent ?? "").trim() === "Druga zgodba"`);
await sleep(800);
check("leaving a project backs it up", (await backupsOf(first)) === 1, `${await backupsOf(first)} of the first`);
const backup = await page.run(`(() => { const path = window.__PV_HARNESS__.backups.find((p) => p.includes("pensieve-")); const file = window.__PV_HARNESS__.files.get(path.toLowerCase()); return new TextDecoder().decode(Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))); })()`);
check("with the words written in it, č, š and ž", backup.includes("besede prvega projekta"));
const second = await page.run(`${db(`${LIBRARY}\\Druga zgodba\\pensieve.db`)}.exec("SELECT project_id FROM shelf")[0].values[0][0]`);

// Back and forth, nothing changed: no copy of the same.
await openProject("My first project");
check("the second project is backed up as she leaves it too", (await backupsOf(second)) === 1, `${await backupsOf(second)}`);
await openProject("Druga zgodba");
await openProject("My first project");
check("switching back and forth with nothing changed writes no copy of the same", (await backupsOf(first)) === 1 && (await backupsOf(second)) === 1, `${await backupsOf(first)} and ${await backupsOf(second)}`);

// Changed, then left: a new one.
await typeAtEnd("Še nekaj besed.");
await openProject("Druga zgodba");
check("a project changed since its last backup is backed up again as she leaves", (await backupsOf(first)) === 2, `${await backupsOf(first)}`);
check("and she is where she went", (await title()) === "Druga zgodba");

check("no errors on the page", page.problems.length === 0, page.problems.slice(0, 3).join(" | "));
console.log(results.every(Boolean) ? "\nALL PASSED" : `\n${results.filter((ok) => !ok).length} FAILED`);
page.close();
