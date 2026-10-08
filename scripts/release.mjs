// Builds a signed release of Pensieve for GitHub Releases: the installer, its signature, and latest.json,
// the file every installed Pensieve reads to find out about a newer one (see docs/releasing.md).
//
//   npm run release -- 0.2.0 --notes "What changed, in a sentence or two"
//   npm run release -- 0.2.0 --notes "…" --publish   (also makes the GitHub release, when gh is signed in)
//   npm run release                                  (builds the version already set, again)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "nebevk/pensieve-writer";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => join(root, ...parts);
const fail = (message) => {
  console.error(`\nrelease: ${message}`);
  process.exit(1);
};

// What was asked: a version, notes, and whether to publish.
const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1] ?? "";
  args.splice(index, 2);
  return value;
};
const notesArg = flag("--notes");
const publish = args.includes("--publish");
const asked = args.filter((arg) => !arg.startsWith("--"))[0] ?? "";

const conf = JSON.parse(readFileSync(at("src-tauri", "tauri.conf.json"), "utf8"));
const current = conf.version;
const version = asked || current;
const parts = (value) => value.split(".").map(Number);
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`"${version}" isn't a version like 0.2.0`);
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let index = 0; index < 3; index += 1) if (x[index] !== y[index]) return x[index] > y[index];
  return false;
};
if (asked && asked !== current && !newer(asked, current)) fail(`${asked} isn't newer than ${current}: installed copies would never take it`);

// The signing key, kept outside the repository.
const keyFile = join(homedir(), ".tauri", "pensieve.key");
const passwordFile = `${keyFile}.password`;
if (!existsSync(keyFile) || !existsSync(passwordFile)) {
  fail(`the signing key isn't at ${keyFile} (with ${passwordFile}); without it no installed Pensieve accepts an update`);
}

// The new version, in the three places it lives.
if (version !== current) {
  const replaceFirst = (file, pattern, replacement) => {
    const text = readFileSync(file, "utf8");
    if (!pattern.test(text)) fail(`couldn't find the version in ${file}`);
    writeFileSync(file, text.replace(pattern, replacement));
  };
  replaceFirst(at("src-tauri", "tauri.conf.json"), /"version": "[^"]+"/, `"version": "${version}"`);
  replaceFirst(at("package.json"), /"version": "[^"]+"/, `"version": "${version}"`);
  replaceFirst(at("src-tauri", "Cargo.toml"), /^version = "[^"]+"/m, `version = "${version}"`);
  if (existsSync(at("package-lock.json"))) {
    const lock = JSON.parse(readFileSync(at("package-lock.json"), "utf8"));
    lock.version = version;
    if (lock.packages?.[""]) lock.packages[""].version = version;
    writeFileSync(at("package-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  }
  console.log(`release: version ${current} → ${version}`);
}

// The build, signed: the release config adds the updater's files (the signature beside the installer).
console.log(`release: building Pensieve ${version}…\n`);
const built = spawnSync("npx", ["tauri", "build", "--config", "src-tauri/tauri.release.conf.json"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyFile, "utf8").trim(),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: readFileSync(passwordFile, "utf8").trim(),
  },
});
if (built.status !== 0) fail("the build didn't finish; see above");

// The installer and its signature.
const bundle = at("src-tauri", "target", "release", "bundle", "nsis");
const installer = existsSync(bundle) ? readdirSync(bundle).find((name) => name.endsWith(`_${version}_x64-setup.exe`)) : undefined;
if (!installer || !existsSync(join(bundle, `${installer}.sig`))) fail(`no signed installer for ${version} in ${bundle}`);

// latest.json: what installed copies read, pointing at this release's installer.
const out = at("release", `v${version}`);
mkdirSync(out, { recursive: true });
copyFileSync(join(bundle, installer), join(out, installer));
copyFileSync(join(bundle, `${installer}.sig`), join(out, `${installer}.sig`));
const notes = notesArg || `Pensieve ${version}`;
const latest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(join(bundle, `${installer}.sig`), "utf8").trim(),
      url: `https://github.com/${REPO}/releases/download/v${version}/${installer}`,
    },
  },
};
writeFileSync(join(out, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
const files = [installer, `${installer}.sig`, "latest.json"].map((name) => join(out, name));
console.log(`\nrelease: Pensieve ${version} is ready in ${out}:\n${files.map((file) => `  ${file}`).join("\n")}`);

// Uncommitted work would be in the release but not in the repository's history.
const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
// The design folder's zip stays untracked on purpose, and release/ is what this script makes.
const changed = (status.stdout ?? "").split("\n").filter((line) => line.trim() && !/release\/|design-system\//.test(line));
if (changed.length > 0) {
  console.log(`\nrelease: not committed yet (commit and push before publishing, so the release's tag has them):\n${changed.map((line) => `  ${line}`).join("\n")}`);
}

if (!publish) {
  console.log(
    [
      "",
      "To publish it:",
      `  1. Commit and push: git commit -am "chore: release ${version}" && git push`,
      `  2. Open https://github.com/${REPO}/releases/new?tag=v${version}&title=Pensieve%20${version}`,
      "  3. Attach the three files above, write what changed, and publish (not as a draft or pre-release).",
      "Installed copies find it within six hours, or at once with Settings → General → Check for updates.",
      "(Or run this again with --publish, once the GitHub CLI is signed in: gh auth login.)",
    ].join("\n"),
  );
  process.exit(0);
}

const gh = spawnSync("gh", ["auth", "status"], { encoding: "utf8", shell: true });
if (gh.status !== 0) fail("the GitHub CLI isn't installed or signed in (gh auth login); publish by hand as shown without --publish");
if (changed.length > 0) fail("commit and push first, then run this again with --publish");
const made = spawnSync("gh", ["release", "create", `v${version}`, ...files.map((file) => `"${file}"`), "--repo", REPO, "--title", `"Pensieve ${version}"`, "--notes", JSON.stringify(notes)], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (made.status !== 0) fail("gh couldn't make the release; see above");
console.log(`\nrelease: published https://github.com/${REPO}/releases/tag/v${version}`);
