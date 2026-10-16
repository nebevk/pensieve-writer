// Draws Pensieve's Windows icons and the installer's picture from the design system's Basin mark (owner, 16 October):
// the mark alone, filling the square, as Windows' own icons are drawn, every size drawn from the vector rather than
// shrunk from a large one; and the installer's first and last page, the mark and the name on the app's paper.
//
//   node --experimental-websocket scripts/brand-images.mjs
//
// Writes src-tauri/icons (icon.ico with 16 to 256, the PNGs) and src-tauri/installer/sidebar.bmp, or into the
// folder given (`icons` and `installer` in it), to look at first. Uses headless Edge, muted, on a profile of its own.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] ?? join(root, "src-tauri");
const icons = join(out, "icons");
const installer = join(out, "installer");
mkdirSync(icons, { recursive: true });
const markFile = join(root, "design-system", "exports", "pensieve-icons", "logo", "svg", "pensieve-mark-daylight.svg");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The mark alone, its sun and basin filling the square with a little room around them.
const mark = readFileSync(markFile, "utf8")
  .replace(/<metadata>[\s\S]*?<\/metadata>/, "")
  .replace('viewBox="0 0 100 100"', 'viewBox="9 9 82 82"');

const edge = ["ProgramFiles(x86)", "ProgramFiles"].map((name) => process.env[name] && join(process.env[name], "Microsoft", "Edge", "Application", "msedge.exe")).find((path) => path && existsSync(path));
if (!edge) throw new Error("Microsoft Edge wasn't found");
const profile = mkdtempSync(join(tmpdir(), "pensieve-brand-"));
const port = 9471;
const browser = spawn(edge, ["--headless=new", "--mute-audio", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

try {
  let socketUrl = "";
  for (let attempt = 0; attempt < 60 && !socketUrl; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      socketUrl = list.find((target) => target.type === "page")?.webSocketDebuggerUrl ?? "";
    } catch {
      await sleep(250);
    }
  }
  const ws = new WebSocket(socketUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let next = 0;
  const waiting = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
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
    const answer = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (answer.result?.exceptionDetails) throw new Error(JSON.stringify(answer.result.exceptionDetails));
    return answer.result.result.value;
  };

  // A page with the heading face loaded, to draw in.
  const page = join(profile, "draw.html");
  const font = pathToFileURL(join(root, "static", "fonts", "YoungSerif-Regular.ttf")).href;
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>@font-face { font-family: "Young Serif"; src: url("${font}"); }</style><body>`);
  await send("Page.navigate", { url: pathToFileURL(page).href });
  await sleep(800);
  await run(`document.fonts.load('26px "Young Serif"').then(() => true)`);

  const markUrl = `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`;
  /** The mark drawn at `size`, as PNG bytes. */
  const png = async (size) =>
    Buffer.from(
      await run(`(async () => {
        const image = new Image();
        image.src = ${JSON.stringify(markUrl)};
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = ${size};
        canvas.getContext("2d").drawImage(image, 0, 0, ${size}, ${size});
        return canvas.toDataURL("image/png").split(",")[1];
      })()`),
      "base64",
    );

  // The icon file: one picture for each size Windows asks for, each drawn at that size.
  const icoSizes = [16, 24, 32, 48, 64, 256];
  const frames = [];
  for (const size of icoSizes) frames.push({ size, bytes: await png(size) });
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const at = 6 + index * 16;
    header[at] = frame.size >= 256 ? 0 : frame.size;
    header[at + 1] = frame.size >= 256 ? 0 : frame.size;
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(frame.bytes.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += frame.bytes.length;
  });
  writeFileSync(join(icons, "icon.ico"), Buffer.concat([header, ...frames.map((frame) => frame.bytes)]));

  // The PNGs Tauri and the window use, and the tiles a Store package would.
  const pngs = {
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
  };
  for (const [name, size] of Object.entries(pngs)) writeFileSync(join(icons, name), await png(size));

  // The installer's first and last page: 164 × 314, the mark and the name on the app's paper, with its glow.
  const sidebar = await run(`(async () => {
    const width = 164, height = 314;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fcf9f2";
    context.fillRect(0, 0, width, height);
    const glow = context.createRadialGradient(width / 2, 118, 0, width / 2, 118, 120);
    glow.addColorStop(0, "rgba(255, 225, 208, 0.85)");
    glow.addColorStop(1, "rgba(255, 225, 208, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    const image = new Image();
    image.src = ${JSON.stringify(markUrl)};
    await image.decode();
    context.drawImage(image, (width - 96) / 2, 70, 96, 96);
    context.fillStyle = "#3a2e26";
    context.font = '26px "Young Serif"';
    context.textAlign = "center";
    context.fillText("Pensieve", width / 2, 204);
    const pixels = context.getImageData(0, 0, width, height).data;
    // A 24-bit BMP, as the installer takes it: rows from the bottom up, each padded to four bytes.
    const row = Math.ceil((width * 3) / 4) * 4;
    const bytes = new Uint8Array(54 + row * height);
    const view = new DataView(bytes.buffer);
    bytes[0] = 0x42;
    bytes[1] = 0x4d;
    view.setUint32(2, bytes.length, true);
    view.setUint32(10, 54, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(34, row * height, true);
    view.setInt32(38, 2835, true);
    view.setInt32(42, 2835, true);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const from = ((height - 1 - y) * width + x) * 4;
        const to = 54 + y * row + x * 3;
        bytes[to] = pixels[from + 2];
        bytes[to + 1] = pixels[from + 1];
        bytes[to + 2] = pixels[from];
      }
    }
    let binary = "";
    for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    return btoa(binary);
  })()`);
  mkdirSync(installer, { recursive: true });
  writeFileSync(join(installer, "sidebar.bmp"), Buffer.from(sidebar, "base64"));
  console.log(`icons: icon.ico (${icoSizes.join(", ")}) and ${Object.keys(pngs).length} PNGs; installer: sidebar.bmp`);
  ws.close();
} finally {
  browser.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
