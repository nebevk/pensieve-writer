// Runs the browser checks: every tests/browser/*-check.mjs against a fresh build of Pensieve, in headless Edge,
// with fake-tauri.js standing in for the desktop window (see README.md here).
//
//   npm run test:browser                  every check but the speed ones
//   npm run test:browser -- find home     only the checks whose names have these words
//   npm run test:browser -- --speed       the speed checks too (each takes a few minutes)
//   npm run test:browser -- --no-build    the build already in build/, as it is
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const args = process.argv.slice(2);
const withSpeed = args.includes("--speed");
const words = args.filter((arg) => !arg.startsWith("--"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port no one is listening on. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const checks = readdirSync(here)
  .filter((name) => name.endsWith("-check.mjs"))
  .filter((name) => withSpeed || !name.includes("speed"))
  .filter((name) => words.length === 0 || words.some((word) => name.includes(word)))
  .sort();
if (checks.length === 0) {
  console.error("No check has those words in its name.");
  process.exit(1);
}

if (!args.includes("--no-build")) {
  console.log("Building Pensieve…");
  // Its long log only matters when it fails.
  const built = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", shell: true });
  if (built.status !== 0) {
    console.error(`${built.stdout ?? ""}${built.stderr ?? ""}`);
    process.exit(built.status ?? 1);
  }
}
if (!existsSync(join(root, "build", "index.html"))) {
  console.error("There is no build in build/; run without --no-build.");
  process.exit(1);
}

const edgePath = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA]
  .filter(Boolean)
  .map((folder) => join(folder, "Microsoft", "Edge", "Application", "msedge.exe"))
  .find((path) => existsSync(path));
if (!edgePath) {
  console.error("Microsoft Edge isn't installed where Windows keeps it; the checks drive it.");
  process.exit(1);
}

const appPort = await freePort();
const cdpPort = await freePort();
const profile = mkdtempSync(join(tmpdir(), "pensieve-checks-"));
mkdirSync(join(here, "shots"), { recursive: true });
const server = spawn(process.execPath, [join(here, "serve.mjs"), join(root, "build"), String(appPort)], { stdio: "ignore" });
const edge = spawn(
  edgePath,
  ["--headless=new", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--restore-last-session=false", "--noerrdialogs", "about:blank"],
  { stdio: "ignore" },
);
const stop = () => {
  server.kill();
  // Edge's own processes go with the one started here.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(edge.pid), "/t", "/f"], { stdio: "ignore" });
  else edge.kill();
};
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

let ready = false;
for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
  ready = await fetch(`http://127.0.0.1:${cdpPort}/json/version`).then((reply) => reply.ok, () => false);
  if (!ready) await sleep(250);
}
if (!ready) {
  stop();
  console.error("Edge didn't open its debugging port.");
  process.exit(1);
}

// Node 22 has WebSocket built in; Node 20 needs it switched on.
const nodeArgs = typeof WebSocket === "undefined" ? ["--experimental-websocket"] : [];
const failed = [];
const began = Date.now();
for (const name of checks) {
  const run = spawnSync(process.execPath, [...nodeArgs, join(here, name), String(appPort)], {
    cwd: here,
    encoding: "utf8",
    env: { ...process.env, CDP_PORT: String(cdpPort) },
    timeout: 15 * 60 * 1000,
  });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const verdict = out.split("\n").reverse().find((line) => /ALL PASSED|\d+ FAILED/.test(line))?.trim() ?? "";
  if (verdict === "ALL PASSED") {
    console.log(`ok    ${name}`);
  } else {
    failed.push(name);
    console.log(`FAIL  ${name}${verdict ? ` (${verdict})` : ""}`);
    const lines = out.split("\n").filter((line) => line.startsWith("FAIL"));
    for (const line of (lines.length > 0 ? lines : out.trim().split("\n").slice(-5)).slice(0, 8)) console.log(`        ${line.trim()}`);
  }
}
stop();
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  // Edge may still hold its profile for a moment; it is in the temporary folder.
}
const minutes = Math.round((Date.now() - began) / 6000) / 10;
console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed in ${minutes} min${failed.length > 0 ? `; failed: ${failed.join(", ")}` : ""}`);
process.exit(failed.length > 0 ? 1 : 0);
