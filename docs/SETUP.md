# Setup guide (Windows + Cursor + GitHub)

## 1. Prerequisites on the development machine
- Git, and a GitHub account
- Node.js LTS (22 or newer)
- Rust via https://rustup.rs
- Microsoft C++ Build Tools ("Desktop development with C++" workload)
- WebView2 runtime (already on Windows 11; installer bundles it for Windows 10)
- Cursor (https://cursor.com)

Check Tauri's official prerequisites page for Windows if anything fails: https://v2.tauri.app/start/prerequisites/

## 2. Create the repository
```
git init
git add .
git commit -m "chore: add Cursor starter (rules, MCP, CI, docs)"
gh repo create pensieve --private --source=. --push   # or create it on github.com
```

## 3. Open in Cursor
1. Open the folder in Cursor. Rules in `.cursor/rules/` and `AGENTS.md` load automatically.
2. Check **Customize / Settings > MCP**: `context7` and `tauri` should appear. Enable them.
3. Paste `docs/phase-0-prompt.md` into the Agent chat.

## 4. About the Tauri MCP server (`tauri`)
It lets the agent take screenshots of the running app, read DOM and console logs, and click around. It needs the MCP bridge plugin inside the app (dev only):
- Rust crate: `tauri-plugin-mcp-bridge`, registered in `src-tauri/src/lib.rs` only for debug builds (`#[cfg(debug_assertions)]`)
- Never ship the bridge in release builds.
If you do not want this yet, remove the `tauri` entry from `.cursor/mcp.json`; Context7 alone is enough to start.

## 5. Releases (installers on GitHub)
- Tag a version: `git tag v0.1.0 && git push --tags`. The Release workflow builds the Windows installer and attaches it to a DRAFT release; review and publish it.
- Install by downloading the `*-setup.exe` from the release on the wife's laptop.

## 6. Auto-update (optional, Phase 5)
1. `npm run tauri add updater`
2. Generate a signing key: `npm run tauri signer generate -- -w ~/.tauri/pensieve.key`
   - Public key goes in `tauri.conf.json` (`plugins.updater.pubkey`).
   - Private key + password go into GitHub repo secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Never commit it.
3. In `tauri.conf.json`: `bundle.createUpdaterArtifacts: true` and updater endpoint
   `https://github.com/<you>/pensieve/releases/latest/download/latest.json`
4. IMPORTANT: that URL is only reachable without login if the repo (or a separate releases repo) is PUBLIC. For a private repo, either keep updating manually from the installer, or publish releases in a small public "pensieve-releases" repo (installers only, no source).
5. After a release, confirm `latest.json` is attached to the release; if it is missing, check the tauri-action logs for a "signature not found" message.

## 7. Google Drive backup
Install Google Drive for desktop on the writer's laptop, then pick a folder inside the "Google Drive" folder as the backup location inside Pensieve. The live project stays outside it.
