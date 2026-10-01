# Phase 0 prompt (paste into Cursor Agent)

Read AGENTS.md and docs/requirements.md first.

Goal: Phase 0 from the roadmap, nothing more.

1. Scaffold a Tauri v2 app with Svelte + TypeScript (npm). App name "Pensieve", identifier `com.pensieve.app`.
2. Add TipTap with StarterKit and show a basic editor in a centered, paper-colored column.
3. Add SQLite via the Tauri SQL plugin. Create a project file with tables for projects, chapters (ordered), and a schema_version. Put all persistence behind a storage interface (save/load/listSnapshots/restore).
4. Implement debounced autosave (every ~2 seconds after the last change, and on close) with a small "saved" indicator, using crash-safe writes.
5. Add one chapter list in a collapsible sidebar (create, rename, select). No drag-and-drop yet.
6. Spike: a minimal page/test that checks whether spell check works for English AND Slovenian inside the WebView2 on Windows. Report the result in docs/spellcheck-spike.md.
7. Configure the Windows NSIS bundle with the WebView2 bootstrapper embedded.

Use the Context7 MCP to check Tauri v2, Svelte, and TipTap docs. Work in small steps and make sure `npm run tauri dev` runs after each step. Commit after each step with conventional commit messages. Stop after Phase 0 and summarize what exists and what is untested.
