// Serves a built copy of the app, as the Pensieve window would load it. Usage: node serve.mjs <dir> <port>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

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
  response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  response.end(body);
}).listen(Number(port), "127.0.0.1", () => console.log(`serving ${dir} on ${port}`));
