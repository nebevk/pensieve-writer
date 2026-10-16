// Drives headless Edge (remote debugging on port 9333) for the Pensieve checks.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connect({ width = 1366, height = 820 } = {}) {
  let socketUrl = null;
  for (let attempt = 0; attempt < 60 && !socketUrl; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT ?? 9333}/json`)).json();
      // The tab the checks use, never a page of Edge's own: a while after it starts, Edge opens its sync dialog
      // (edge://sync-confirmation-dialog) and lists it first, and a check driving it saw frames only every few
      // seconds, so every key seemed seconds late.
      socketUrl = list.find((target) => target.type === "page" && !/^(edge|chrome|devtools):/.test(target.url))?.webSocketDebuggerUrl ?? null;
    } catch {
      await sleep(500);
    }
  }
  const ws = new WebSocket(socketUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let next = 0;
  const waiting = new Map();
  const problems = [];
  const listeners = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      problems.push("console: " + message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    }
    if (message.method && listeners.has(message.method)) listeners.get(message.method)(message.params);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      next += 1;
      waiting.set(next, resolve);
      ws.send(JSON.stringify({ id: next, method, params }));
    });
  const run = async (expression) => {
    const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (reply.result?.exceptionDetails) return "error: " + (reply.result.exceptionDetails.exception?.description ?? reply.result.exceptionDetails.text);
    return reply.result?.result?.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  return {
    send,
    /** Calls `handler` with the params of every `method` event from the browser. */
    on: (method, handler) => listeners.set(method, handler),
    run,
    problems,
    /** Makes every page load think it runs in the Pensieve window, with sql.js as its database. */
    /**
     * `keep` keeps books between page loads, as files on disk would be; `stacks` is a regex source:
     * calls whose query matches it record where in the app they came from. `tips`: the tutorial tips
     * (since 8 October) show as for a new user; off by default, so the other checks click the window as
     * before: prefs written without `tips` get `tips: false`, and so does a first start. `worker`: sql.js runs
     * in a worker, off the page's thread, as the real database does (the speed checks); books aren't kept then,
     * and `books` holds handles, not databases to read.
     */
    async harness({ keep = false, stacks = "", seed = null, tips = false, worker = false } = {}) {
      const sql = readFileSync(join(here, "..", "..", "node_modules", "sql.js", "dist", "sql-asm.js"), "utf8");
      const fake = readFileSync(join(here, "fake-tauri.js"), "utf8");
      const flags =
        `window.__PV_KEEP__ = ${keep}; window.__PV_STACKS__ = ${stacks ? `new RegExp(${JSON.stringify(stacks)})` : "null"};` +
        `window.__PV_SEED__ = ${seed ? JSON.stringify(seed) : "null"};` +
        (worker ? `window.__PV_SQL_WORKER__ = true; window.__PV_SQL_SOURCE__ = ${JSON.stringify(sql)};` : "");
      const quiet = tips
        ? ""
        : `(() => {
            const set = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) {
              if (key === "pensieve-prefs") {
                try {
                  const prefs = JSON.parse(value);
                  if (prefs && typeof prefs === "object" && !("tips" in prefs)) value = JSON.stringify({ ...prefs, tips: false });
                } catch {}
              }
              return set.call(this, key, value);
            };
            try { if (!localStorage.getItem("pensieve-prefs")) set.call(localStorage, "pensieve-prefs", JSON.stringify({ tips: false })); } catch {}
          })();`;
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `${flags}\n${quiet}\n${sql}\n;${fake}` });
    },
    async open(url, wait = 3500) {
      await send("Page.navigate", { url });
      await sleep(wait);
    },
    click: (selector) =>
      run(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return "missing"; el.click(); return "ok"; })()`),
    /** Clicks the first element matching the selector whose text includes the words. */
    clickText: (selector, words) =>
      run(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.includes(${JSON.stringify(words)})); if (!el) return "missing"; el.click(); return "ok"; })()`),
    type: (text) => send("Input.insertText", { text }),
    /** A real mouse press and release on the first matching element whose text includes the words. */
    async mouse(selector, words = "") {
      const box = await run(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.includes(${JSON.stringify(words)})); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!box) return "missing";
      await sleep(150);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
      }
      return "ok";
    },
    async key(key, code, keyCode, modifiers = 0) {
      // Enter carries its character, so a form in the page submits as it would from a real keyboard.
      const text = key === "Enter" ? String.fromCharCode(13) : undefined;
      await send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode: keyCode, modifiers, text });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, modifiers });
    },
    /** Selects the given words in the manuscript, as a mouse drag would. */
    selectWords: (words) =>
      run(`(() => {
        const root = document.querySelector(".paper .ProseMirror");
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const at = node.textContent.indexOf(${JSON.stringify(words)});
          if (at < 0) continue;
          root.focus();
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + ${JSON.stringify(words)}.length);
          const selection = getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return "ok";
        }
        return "missing";
      })()`),
    async shoot(path, clip) {
      await sleep(500);
      const shot = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { scale: 1, ...clip } } : {}) });
      writeFileSync(path, Buffer.from(shot.result.data, "base64"));
      console.log("shot", path.split(/[\\/]/).pop());
    },
    close() {
      ws.close();
    },
  };
}
