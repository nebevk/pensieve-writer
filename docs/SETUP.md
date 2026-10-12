# Setup

How to build, run and check Pensieve on a Windows development computer. What the app must do is in
[requirements.md](requirements.md), what is open in [backlog.md](backlog.md), and how to publish a version
in [releasing.md](releasing.md).

## Prerequisites

- Git, and access to the GitHub repository
- Node.js 22 or newer
- Rust, through https://rustup.rs
- Microsoft C++ Build Tools, with the "Desktop development with C++" workload (Rust needs it to link the app)
- The WebView2 runtime (part of Windows 11; the installer brings it to Windows 10)

If something fails, Tauri's prerequisites page for Windows has the details:
https://v2.tauri.app/start/prerequisites/

## Commands

| Command | What it does |
|---------|--------------|
| `npm install` | Installs the dependencies |
| `npm run tauri dev` | Runs the desktop app while developing; it never looks for updates |
| `npm run check` | Type-checks (svelte-check), including accessibility warnings |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run build` | Builds the web part only |
| `npm run tauri build` | Builds an installer, without the update files |
| `npm run release -- 0.2.0 --notes "…"` | Builds a signed release for GitHub Releases ([releasing.md](releasing.md)) |

Before a change is done: it runs, `npm run check` reports nothing, the tests pass, the console shows no
errors, and text still saves after a forced close.

## Where things are

| Folder | What is in it |
|--------|---------------|
| `src/routes/+page.svelte` | The app's shell: views, windows, saving, projects |
| `src/lib/editor/` | The editor and its extensions, the toolbar, the window and floating bars |
| `src/lib/chapters/` | The library tree, the chapter list, chapters and parts on the page |
| `src/lib/views/` | Home, Notes, To-dos, Outline, Book, Settings and the windows |
| `src/lib/storage/` | SQLite, notes and to-dos, backups |
| `src/lib/i18n.ts` | Every interface text, in English and Slovenian |
| `src-tauri/` | The Rust side: files, the library on disk, backups, spell check |
| `static/` | Fonts, ambience and keystroke recordings (with their credits), brand images |
| `design-system/` | The design: tokens, components, UI kit |

## For coding agents

`AGENTS.md` holds the project's rules, and `.cursor/rules/` the detailed ones: data safety, the cozy
interface's speed budget, languages and spell check, and Tauri and Rust. `.cursor/mcp.json` sets up
Context7 (current Tauri, Svelte and TipTap docs) and a Tauri MCP server; the latter needs a debug-only bridge
plugin in the app, which isn't installed.

## Google Drive backups

On Eva's laptop, install Google Drive for desktop, then choose a folder inside the "Google Drive" folder in
Settings → Backup & export. The projects themselves stay in the library folder, outside it.
