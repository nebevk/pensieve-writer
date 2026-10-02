# Suggested improvements

Ideas for making Pensieve safer, faster and nicer to write in, beyond matching the design. Written 2 October 2026 after reviewing the code at `8d7da8c` plus the uncommitted changes in the working tree.

- Design gaps live in `docs/design-gaps.md`; this list doesn't repeat them, except where an item there matters for safety.
- Requirement IDs in brackets point to `docs/requirements.md`.
- Each item has an ID (IMP-1, …) so you can ask for it by name. They're ordered by importance within each section, and the sections follow the principles in `AGENTS.md`: never lose text first, then typing speed, then everything else.

## 1. Never lose the writer's text

These come first because one lost chapter would undo all the goodwill the app earns.

| ID | Suggestion | Why |
|---|---|---|
| **IMP-1** Snapshot before restoring (SV-3) | Take a "Before restore" snapshot of the current book, then restore | `restore()` in `src/lib/storage/sqlite.ts` overwrites the chapters without saving the current version first. Restoring the wrong snapshot loses everything written since the last hourly snapshot, and that can't be undone |
| **IMP-2** Keep settings out of browser storage | Store the settings, above all the project file location and backup folder, in a small JSON file in the app config folder or in the project database | `src/lib/prefs.ts` keeps them in the WebView's `localStorage`. If WebView2 data is cleared or reset, the app opens an empty default project, and to the writer that looks like the book is gone |
| **IMP-3** Save notes when the app closes | Give note edits the same flush-on-close as chapters | `src/lib/views/Notes.svelte` saves a note 800ms after typing stops, and nothing flushes that timer when the window closes. Closing straight after typing loses the last words of a note |
| **IMP-4** Automatic Drive backup with visible status (SV-9) | Back up to the Drive folder on a timer (for example hourly while writing) and on close, and show "Backed up · 12 min ago" or a clear failure | Today it only happens on "Back up now", which is easy to forget. Same as HOME-5 in the gaps list |
| **IMP-5** Atomic backup files (SV-2) | Write each backup to a temp file and rename it, as `relocate_project` already does | `src-tauri/src/backup.rs` writes straight to the final file, so a crash mid-write leaves a broken backup that looks valid |
| **IMP-6** Store images once, and smaller | Shrink images on insert (for example to 1600px wide) and keep them in their own table, not inside the chapter | Images are stored as data inside the chapter text, so every save and every hourly or daily snapshot (up to 78 kept) copies them again |
| **IMP-7** A restore drill | Add a test, and a one-line check in the release steps, that restores a snapshot and a Drive backup and compares the text | The requirements call restore "a tested feature, not an afterthought". Right now nothing tests it |

## 2. Keep typing instant

The target is an older laptop with manuscripts of 150,000+ words.

| ID | Suggestion | Why |
|---|---|---|
| **IMP-8** Stop recounting the whole book on each keystroke | Store a word count per chapter, update it only for the chapter being edited, and add them up | In `src/routes/+page.svelte`, every keystroke replaces the project object, which recounts every chapter's words (`projectWords`) and re-sorts the chapter list |
| **IMP-9** Lighter editor updates | Mark the chapter dirty on each keystroke, and serialise it (`getJSON()` and `getText()`) only when autosave runs or the counts need refreshing | `src/lib/editor/Editor.svelte` serialises the whole chapter on every keystroke. On a long chapter that's the most expensive thing happening while typing |
| **IMP-10** Measure on the real laptop | Time typing in a 10,000-word chapter of a 150,000-word book on the writer's laptop, in Candlelit with particles on | The answers to open questions 1 and 2 (laptop model and RAM) decide how much ambience the app can afford |

## 3. Writing features worth adding next

All of these are already in `requirements.md`, but the app doesn't have them yet.

| ID | Suggestion | Requirement |
|---|---|---|
| **IMP-11** Find and replace across the whole book, with a list of matches by chapter | ED-8 (find and replace currently searches only the open chapter) |
| **IMP-12** Version history for one chapter: browse its older versions from the snapshots and restore just that chapter | SV-4 |
| **IMP-13** Export to PDF, Markdown and plain text, plus "Copy as clean HTML" for blog posts | SV-7, SV-11 (only Word export and printing exist) |
| **IMP-14** Word goal per chapter, shown in the chapter list and Outline | CH-6 |
| **IMP-15** Project templates, including a one-document "Article" with no chapter list | CH-8 (pairs with HOME-2) |
| **IMP-16** Parts or scenes to group chapters | CH-5 |
| **IMP-17** Manage the personal dictionary: remove a word, see which language it belongs to | ED-13 (words can be added, not removed) |
| **IMP-18** Check that pasting from Word keeps headings, italics and paragraphs, using a real manuscript | ED-10 |

## 4. Notes and to-dos

| ID | Suggestion | Why |
|---|---|---|
| **IMP-19** Edit and delete to-dos | Rename a to-do, change its chapter or note, or remove it | Today a to-do can only be added and moved between columns, so a typo stays on the board for good |
| **IMP-20** Backlinks | On a note, list the notes that link to it, not only the ones it links to | Makes [[links]] useful in both directions; cheap once NOTE-1 exists |
| **IMP-21** Notes for this chapter | In the side panel, show the notes linked to the chapter being written first | That's what the writer usually needs while writing, and NT-3 already stores the link |

## 5. Comfort and polish

| ID | Suggestion | Why |
|---|---|---|
| **IMP-22** Slovenian interface | Offer the menus and labels in Slovenian as well as English | Open question 3 in the requirements; the writer works in both languages |
| **IMP-23** Recorded ambience loops | Replace the generated rain and fire noise with short recorded loops (rain, fireplace, café, soft piano), faded in and out | AT-3; generated noise sounds harsh next to the rest of the app's warmth |
| **IMP-24** Keyboard cheat sheet | List the shortcuts in Settings and on Ctrl+/ | ST-4 and SET-1 |
| **IMP-25** Keyboard and screen-reader pass | Trap focus inside Settings while it's open, return focus when it closes, and make sure every tool can be reached with Tab | The requirements ask for a keyboard-navigable app |
| **IMP-26** First-run welcome | On a new project, put one short page on the desk that explains chapters, notes, Zen and where backups go, and that can be deleted | Success criterion: write, organise and export in the first session without help |

## 6. Code health

| ID | Suggestion | Why |
|---|---|---|
| **IMP-27** Tests for the data paths | Add a test runner (Vitest is small and standard; ask before adding it) and cover save, load, restore, backup content, Word export and import | CI already runs `npm test --if-present`, but there are no tests, so data-safety changes rely on manual checking |
| **IMP-28** Split `+page.svelte` | Move chapter actions, find, Zen and project handling into their own modules | At about 1,150 lines it holds most of the app's logic, which makes changes risky |
| **IMP-29** One save path for notes and to-dos | Route notes and to-dos through the same autosave and error reporting as chapters | Each view saves on its own with its own error message today, which is how IMP-3 slipped in |
| **IMP-30** Remove unused settings | Drop `streak` and `lastWriteDay` from `src/lib/prefs.ts` | Nothing reads them since the streak was removed |

## Suggested order

1. **Data safety:** IMP-1, IMP-2 and IMP-3 are small, and each prevents real data loss. Do them before anything else.
2. **Backups:** IMP-4, IMP-5, then IMP-7.
3. **Speed:** IMP-8 and IMP-9, then IMP-10 on the real laptop.
4. **Tests and structure:** IMP-27, before the bigger features.
5. Features, by what the writer asks for first.
