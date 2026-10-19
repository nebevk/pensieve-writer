// Serves a built copy of the app, as the Pensieve window would load it. Usage: node serve.mjs <dir> <port>
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const [dir, port] = process.argv.slice(2);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
};

// The window's content security policy (ARCH-19), as Tauri sends it with the page: tauri.conf.json's, with the
// page's inline script let in (Tauri gives it a nonce, here its hash), and the checks' own sql.js worker, made
// from a blob (cdp.mjs), which the app itself has none of.
const { csp } = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src-tauri", "tauri.conf.json"), "utf8")).app.security;
function policy(html) {
  const directives = { ...csp, "worker-src": "'self' blob:" };
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const hashes = inline.map(([, code]) => `'sha256-${createHash("sha256").update(code.replace(/\r\n?/g, "\n")).digest("base64")}'`);
  directives["script-src"] = [directives["script-src"], ...hashes].join(" ");
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources}`)
    .join("; ");
}

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^([\\/])+/, "");
  let file = join(dir, path || "index.html");
  let body;
  try {
    body = await readFile(file);
  } catch {
    file = join(dir, "index.html");
    body = await readFile(file);
  }
  const headers = { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" };
  if (extname(file) === ".html" && csp) headers["Content-Security-Policy"] = policy(body.toString("utf8"));
  response.writeHead(200, headers);
  response.end(body);
}).listen(Number(port), "127.0.0.1", () => console.log(`serving ${dir} on ${port}`));
