# Suggested improvements

Ideas for making Pensieve safer, faster and nicer to write in, beyond matching the design. Written 2 October 2026; rechecked 5 October against commit `22d85eb`, then updated the same day after the fixes for IMP-31 to IMP-39 were applied.

- Design gaps live in `docs/design-gaps.md`; this list doesn't repeat them.
- Requirement IDs in brackets point to `docs/requirements.md`.
- Each item has an ID (IMP-1, …) so you can ask for it by name. IDs stay fixed; finished items move to "Done".

**Status:** *Open*: not started. *Partial*: started, not finished. **Priority:** *P1*: can lose the writer's text, do first. *P2*: noticeable. *P3*: polish.

## Summary

45 suggestions: 33 done, 9 partly done, 3 open. No P1 items are left.

The 5 October fixes were checked with the type check (no errors or warnings), 25 tests and a production build. Nobody has clicked through them in the running app yet, so try these once by hand:

1. Type in a note, switch to another note and type straight away; both notes keep their text.
2. Delete a note, then restore the "Kept" snapshot on Home; the note comes back.
3. In "Earlier versions", restore the open chapter; the page shows the older text and keeps it after you type.
4. Start a new project; it opens on the welcome page.
5. Settings → Backup & export → "Restore from a backup…" with a recent backup file.
6. Settings → "Print / PDF"; every chapter prints, not just the first page.

## 1. Never lose the writer's text

| ID | Suggestion | Why | Status | Pri |
|---|---|---|---|---|
| **IMP-6** Store images once, and smaller | Keep images in their own table, so chapters and snapshots refer to them instead of copying them | Done so far: pictures wider than 1600px are shrunk on insert, keeping transparency. They're still stored inside the chapter, so each save and each of up to 78 automatic snapshots copies them again | Partial | P2 |
| **IMP-7** A restore drill | Add a test that writes a book to a real database, restores a snapshot and a Drive backup, and compares the text | Done so far: tests cover the restore logic, notes in snapshots, and reading backup files back, including č, š and ž. No test touches the database | Partial | P2 |

## 2. Keep typing instant

| ID | Suggestion | Why | Status | Pri |
|---|---|---|---|---|
| **IMP-10** Measure on the real laptop | Time typing in a 10,000-word chapter of a 150,000-word book on the writer's laptop, in Candlelit with particles on | IMP-8 and IMP-9 removed the main per-keystroke costs; this confirms it on the hardware that matters. The answers to open questions 1 and 2 in the requirements (laptop model and RAM) decide how much ambience the app can afford | Open | P2 |

## 3. Writing features

| ID | Suggestion | Why | Status | Pri |
|---|---|---|---|---|
| **IMP-45** Pictures in exports and the Book view (ED-12) | Carry pictures through to Word, HTML, Markdown and the Book view | `documentToBlocks` in `src/lib/export/document.ts` has no case for pictures, so each one becomes an empty paragraph in every export, in the Book view and in printouts | Open | P3 |
| **IMP-17** Manage the personal dictionary (ED-13) | Also remove the word from the Windows spell checker | Done so far: Settings can remove a word from Pensieve's list, and says honestly that Windows may still accept it | Partial | P3 |
| **IMP-18** Paste from Word (ED-10) | Paste a chapter from a real manuscript and check headings, italics and paragraphs survive | The tests cover Word export and re-import, not pasting | Open | P3 |

## 4. Comfort and polish

| ID | Suggestion | Why | Status | Pri |
|---|---|---|---|---|
| **IMP-22** Slovenian interface | Translate the rest of the interface | Done so far: Settings → General switches about 30 labels (view tabs, greetings, Home buttons, Settings sections, the chapter list heading). The toolbar, notes, to-dos, floating bar, Settings contents and messages are still English only | Partial | P3 |
| **IMP-23** Recorded ambience loops (AT-3) | Add short recordings as `static/ambience/rain.ogg`, `fire.ogg`, `cafe.ogg` and `piano.ogg` | Done so far: the app plays those files when they exist. None are there yet, so all four sounds are still generated noise | Partial | P3 |
| **IMP-25** Keyboard and screen-reader pass | Check that every tool can be reached with Tab and has a clear name | Done so far: Settings traps focus, focuses its first control, and returns focus when it closes | Partial | P3 |
| **IMP-26** First-run welcome | Put the welcome page in the first book the app creates on install, too | Done so far: books made with "Start something new" open on a welcome page. The book created automatically on first launch, the one the writer sees first, still starts blank | Partial | P3 |

## 5. Code health

| ID | Suggestion | Why | Status | Pri |
|---|---|---|---|---|
| **IMP-28** Split `+page.svelte` | Move find and replace, history and restores, projects, backups and Zen into their own modules | Done so far: chapter changes moved to `src/lib/chapters/mutate.ts`. The page is still the largest file in the app, at over 1,500 lines | Partial | P3 |
| **IMP-29** One save path for notes and to-dos | Route to-dos through the same save queue as notes | Done so far: notes save through one queue (`src/lib/save/queue.ts`), and note and to-do errors reach the title bar. To-dos still save on their own | Partial | P3 |

## Done

| ID | What was built |
|---|---|
| IMP-1 Snapshot before restoring | A "Before restore" snapshot is taken before restoring the whole book, one chapter, or a Drive backup |
| IMP-2 Settings out of browser storage | Settings are also written to `prefs.json` in the app config folder, by temp file and rename, and the file wins at startup |
| IMP-3 Save notes when the app closes | Note edits are saved when the app closes, when the window loses focus, and when the Notes screen closes |
| IMP-4 Automatic Drive backup | Hourly while the app is open and again on close; Home shows the last backup time or failure |
| IMP-5 Atomic backup files | `backup.rs` writes a temp file, renames it, and cleans up leftovers |
| IMP-8 Word counts | Counts are cached per chapter and recounted only when that chapter's text changes |
| IMP-9 Lighter editor updates | The chapter is serialised at save time, and the text for counts is read 400ms after typing stops |
| IMP-11 Whole-book find and replace (ED-8) | Find switches between this chapter and the whole book, lists matches by chapter, and Replace all works across the book |
| IMP-12 Version history for one chapter (SV-4) | "Earlier versions" previews the open chapter in each snapshot and restores just that chapter (see IMP-40) |
| IMP-13 More export formats (SV-7, SV-11) | Markdown, plain text and "Copy HTML" in Settings → Backup & export |
| IMP-14 Word goal per chapter (CH-6) | Set under the chapter list or in Outline; the list shows words against the goal |
| IMP-15 Project templates (CH-8) | Novel, Short stories and Article; an Article has no chapter list |
| IMP-16 Parts (CH-5) | Chapters can belong to a named part, shown as a heading in the chapter list |
| IMP-19 Edit and delete to-dos | Edit on a slip renames it, changes its chapter or note, or deletes it |
| IMP-20 Backlinks | A note lists the notes that link to it, under "Linked from" |
| IMP-21 Notes for this chapter | The side panel puts notes linked to the open chapter first and marks them "This chapter" |
| IMP-24 Keyboard cheat sheet (ST-4) | Settings → Shortcuts, also opened with Ctrl+/ |
| IMP-27 Tests for the data paths | Vitest, run by CI: 25 tests covering restore, notes in snapshots, backup files, the note save queue, counts, find and replace, exports and pictures |
| IMP-30 Remove unused settings | The streak fields are gone and are dropped from old saved settings |
| IMP-31 Save every edited note | `src/lib/save/queue.ts` keeps one pending save per note, so switching notes quickly no longer drops the previous note's last words |
| IMP-32 Protect notes | "Delete note" asks first and keeps a snapshot. Snapshots now hold notes and to-dos, and restoring one brings back any notes and to-dos the book no longer has, without changing the ones it still has |
| IMP-33 Snapshot before a whole-book "Replace all" | A snapshot of the whole book is kept first; nothing happens if there are no matches |
| IMP-34 Restore from a Drive backup | Settings → Backup & export → "Restore from a backup…" reads a `pensieve-*.json` file, says which book and date it holds, and restores it into the open book after a "Before restore" snapshot. This also works on a fresh install |
| IMP-35 Load the settings file before opening the book | The settings from `prefs.json` are put into browser storage before the database opens, instead of relying on Svelte's timing |
| IMP-36 Skip backups when nothing changed | Automatic backups compare a fingerprint of the book, notes and to-dos and skip identical copies; "Back up now" always writes |
| IMP-37 Make "Print / PDF" print the book | It closes Settings, switches to the Book view and prints every chapter. Print styles no longer clip the document to one page, and the candle sparks stay off paper |
| IMP-38 Image details | Shrunk pictures keep their transparency, pictures are stored with their real type, and a failed insert shows a short message in the toolbar |
| IMP-39 Pass the chapter or note id into the editor | The editor remembers the chapter or note it opened and hands its text back with that id |
| IMP-40 Restoring the open chapter | Found while applying the fixes: "Restore this chapter" left the open editor showing the old text, and the next save wrote it back over the restore. Every restore now closes the editor first, saves, restores, then reopens it |
| IMP-41 Welcome page on new books | Found while applying the fixes: the editor opened on the blank first chapter before the welcome text was in place, then saved the blank text over it. A new book now opens only after its welcome page is set |
| IMP-42 Backups miss the last edits | Found while applying the fixes: a backup took the book from before saving the last edits, so it could miss up to two seconds of typing. It now saves notes and chapters first |
| IMP-43 Separate backups per book | Found while applying the fixes: all books shared the folder's 20-backup limit, so working on one book pruned another's backups. Files are now named `pensieve-<book>-<time>.json` and each book keeps its own 20. Older files without a book name are no longer pruned |
| IMP-44 Safer book switching and moving | Found while applying the fixes: switching books now saves pending note edits first, and the database switch waits for queued writes, so they can't land in the next book's file. After "Move project…", the old copy is dropped from Home's list. Opening a remembered book whose file is gone shows an error instead of creating an empty book |

## Suggested order

1. **Try the fixes by hand:** the six checks in the summary, on the real laptop.
2. **Speed:** IMP-10 on the same laptop.
3. **Finish the safety items:** IMP-7, then IMP-6.
4. The rest, by what the writer asks for first.
