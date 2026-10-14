// Builds a signed release of Pensieve for GitHub Releases: the installer, its signature, and latest.json,
// the file every installed Pensieve reads to find out about a newer one (see docs/releasing.md).
//
//   npm run release -- 0.5.0 --notes "What changed, in a sentence or two"
//   npm run release -- 0.5.0 --notes "…" --publish   (all of it: built, committed, tagged, pushed, published)
//   npm run release -- 0.4.0 --publish               (publishes a version already built and tagged)
//   npm run release                                  (builds the version already set, again)
//
// --publish needs the GitHub CLI, signed in once: winget install --id GitHub.cli, then gh auth login.
// release/v<version>/notes.md, written before, becomes the release's text on GitHub.
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
/** Runs git or gh in the repository; stops the release if it fails. */
const run = (program, args, what) => {
  const done = spawnSync(program, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (done.error || done.status !== 0) fail(`${what} didn't work${done.error ? ` (${done.error.message})` : "; see above"}`);
  return done.stdout ?? "";
};
const quietly = (program, args) => spawnSync(program, args, { cwd: root, encoding: "utf8" });

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

const out = at("release", `v${version}`);
const tag = `v${version}`;
// The files the release changes; anything else uncommitted would be in the build but not in its tag.
const VERSION_FILES = ["package.json", "package-lock.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock", "src-tauri/tauri.conf.json"];
const changedFiles = () =>
  quietly("git", ["status", "--porcelain"])
    .stdout.split("\n")
    .filter((line) => line.trim())
    // The design folder's zip stays untracked on purpose, and release/ is what this script makes.
    .filter((line) => !/release\/|design-system\//.test(line));

/** The GitHub release of what is built in release/v<version>, its tag already pushed; then master moved up to it. */
function publishBuilt() {
  const files = readdirSync(out)
    .filter((name) => name.endsWith(".exe") || name.endsWith(".exe.sig") || name === "latest.json")
    .map((name) => join(out, name));
  if (files.length !== 3) fail(`${out} should hold the installer, its .sig and latest.json`);
  if (quietly("gh", ["release", "view", tag, "--repo", REPO]).status === 0) fail(`${tag} is published already`);
  const notesFile = join(out, "notes.md");
  const latest = JSON.parse(readFileSync(join(out, "latest.json"), "utf8"));
  console.log(`release: publishing ${tag} on GitHub…`);
  run(
    "gh",
    ["release", "create", tag, ...files, "--repo", REPO, "--title", `Pensieve ${version}`, "--verify-tag", "--latest", ...(existsSync(notesFile) ? ["--notes-file", notesFile] : ["--notes", latest.notes])],
    "gh release create",
  );
  // master is the latest release, as it was moved by hand before: only ever forward to it.
  const commit = run("git", ["rev-parse", `${tag}^{commit}`], "git rev-parse").trim();
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], "git rev-parse").trim();
  run("git", ["fetch", "origin", "master"], "git fetch");
  if (quietly("git", ["merge-base", "--is-ancestor", "origin/master", commit]).status === 0) {
    run("git", ["push", "origin", `${commit}:refs/heads/master`], "pushing master");
    // The master here too, unless it is the branch checked out, or has work of its own.
    const moved = branch === "master" || quietly("git", ["fetch", ".", `${commit}:master`]).status === 0;
    console.log(`release: master is ${tag} now${moved ? "" : " on GitHub (the master here has commits of its own, so it stays)"}`);
  } else {
    console.log(`release: master on GitHub has commits ${tag} hasn't, so it stays where it is`);
  }
  console.log(`\nrelease: published https://github.com/${REPO}/releases/tag/${tag}`);
  console.log("Installed copies find it within six hours, or at once with Settings → General → Check for updates.");
}

// Publishing asks first what could stop it halfway, before the long build.
if (publish) {
  const gh = quietly("gh", ["auth", "status"]);
  if (gh.error || gh.status !== 0) fail("the GitHub CLI isn't installed or signed in: winget install --id GitHub.cli, then gh auth login (once)");
  const tagged = quietly("git", ["tag", "--list", tag]).stdout.trim() !== "";
  const onGitHub = quietly("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`]).stdout.trim() !== "";
  // A version already built and tagged (one published by hand before, or a publish that stopped halfway).
  if (version === current && tagged && onGitHub && existsSync(join(out, "latest.json"))) {
    publishBuilt();
    process.exit(0);
  }
  if (version === current) fail(`--publish makes a new version: ask for one newer than ${current}`);
  if (tagged || onGitHub) fail(`${tag} is there already`);
  const changed = changedFiles();
  if (changed.length > 0) fail(`commit your work first, so the release's tag has it:\n${changed.map((line) => `  ${line}`).join("\n")}`);
  // The type check and the tests; the browser checks take too long to be asked for here.
  for (const [command, what] of [
    [["run", "check"], "the type check"],
    [["test"], "the tests"],
  ]) {
    console.log(`release: ${what}…`);
    const checked = spawnSync("npm", command, { cwd: root, stdio: ["ignore", "ignore", "inherit"], shell: true });
    if (checked.status !== 0) fail(`${what} failed: npm ${command.join(" ")}`);
  }
}

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
      url: `https://github.com/${REPO}/releases/download/${tag}/${installer}`,
    },
  },
};
writeFileSync(join(out, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
const files = [installer, `${installer}.sig`, "latest.json"].map((name) => join(out, name));
console.log(`\nrelease: Pensieve ${version} is ready in ${out}:\n${files.map((file) => `  ${file}`).join("\n")}`);

// Uncommitted work would be in the release but not in the repository's history.
const changed = changedFiles();

if (!publish) {
  if (changed.length > 0) {
    console.log(`\nrelease: not committed yet (commit and push before publishing, so the release's tag has them):\n${changed.map((line) => `  ${line}`).join("\n")}`);
  }
  console.log(
    [
      "",
      "To publish it:",
      `  1. Commit, tag and push: git commit -am "chore: release ${version}" && git tag -a ${tag} -m "Pensieve ${version}" && git push && git push origin ${tag}`,
      `  2. Open https://github.com/${REPO}/releases/new?tag=${tag}&title=Pensieve%20${version}`,
      "  3. Attach the three files above, write what changed, and publish (not as a draft or pre-release).",
      "Installed copies find it within six hours, or at once with Settings → General → Check for updates.",
      `(Or, once the GitHub CLI is signed in: npm run release -- ${version} --publish)`,
    ].join("\n"),
  );
  process.exit(0);
}

// The release commit has the new version and nothing else; then its tag, both pushed, and the release. All
// was committed before the build, so anything else changed now is another's (a session working alongside,
// say) or the build's own, and stays out of it, as it is.
const others = changed.filter((line) => !VERSION_FILES.some((file) => line.trim().endsWith(file)));
if (others.length > 0) console.log(`\nrelease: changed during the build, and left as it is, out of the release:\n${others.map((line) => `  ${line}`).join("\n")}`);
run("git", ["add", ...VERSION_FILES.filter((file) => existsSync(at(file)))], "git add");
run("git", ["commit", "-m", `chore: release ${version}`], "git commit");
run("git", ["tag", "-a", tag, "-m", `Pensieve ${version}`], "git tag");
run("git", ["push", "origin", "HEAD"], "pushing the branch");
run("git", ["push", "origin", tag], "pushing the tag");
publishBuilt();
