# Pensieve: project instructions for AI agents

Pensieve is a cozy, minimalist desktop writing app (a lightweight Word alternative with chapters, notes/todos, book view, and zen mode) for one personal user. Not distributed publicly.
Full requirements: `docs/requirements.md` (read it before big features; requirement IDs like ED-1, CH-4, SV-1 refer to it).

## Stack
- Tauri v2 (Rust backend, thin) + Svelte + TypeScript (app logic) + TipTap editor
- SQLite (Tauri SQL plugin) for project data; one file per project
- Target: Windows 10 or newer on an OLDER laptop. Performance and smoothness matter more than features.

## Principles (do not violate)
1. **Never lose the user's text.** Autosave, atomic writes, local snapshots. See `.cursor/rules/data-safety.mdc`.
2. **Typing latency is sacred.** Decoration (animation, ambience) must never slow the editor. See `.cursor/rules/cozy-ui-performance.mdc`.
3. **Word-familiar UX.** Standard shortcuts (Ctrl+B/I/U/Z/Y/S/F), familiar toolbar icons and menu names.
4. **Simple over clever.** Prefer small, readable code. Do not add features outside `docs/requirements.md` without asking.
5. **Two languages:** English and Slovenian (spell check, UI strings if localized). Use UTF-8 everywhere; test with č, š, ž.
6. **Local-first, no telemetry, no account.** Cloud backup = snapshot files written to a Google Drive-synced folder (never keep the live database inside a synced folder).

## Commands
- `npm install` : install dependencies
- `npm run tauri dev` : run the desktop app in development
- `npm run check` : type-check (svelte-check / tsc)
- `npm run build` / `npm run tauri build` : production build / installer

## Working style
- Work in small steps; after each step the app must still run (`npm run tauri dev`).
- Use the Context7 MCP to look up current Tauri v2, Svelte, and TipTap docs instead of guessing APIs.
- Ask before adding a dependency; prefer well-maintained, small ones.
- Commit-sized changes with clear messages (conventional commits: `feat:`, `fix:`, `docs:`, `chore:`).
- Definition of done: runs, type-checks, no console errors, matches the requirement ID, text still saves after a forced app close.
