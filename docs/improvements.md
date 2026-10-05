# Suggested improvements

Ideas for making Pensieve safer, faster and nicer to write in, beyond matching the design. Written 2 October 2026; rechecked 5 October against commit `22d85eb` and updated several times that day, most recently after IMP-17, IMP-26, IMP-29, IMP-45, IMP-48 and IMP-49 were done.

- Design gaps live in `docs/design-gaps.md`; this list doesn't repeat them.
- Requirement IDs in brackets point to `docs/requirements.md`.
- Each item has an ID (IMP-1, …) so you can ask for it by name. IDs stay fixed; finished items move to "Done".

**Status:** *Open*: not started. *Partial*: started, not finished. **Priority:** *P1*: can lose the writer's text, do first. *P2*: noticeable. *P3*: polish.

## Summary

49 suggestions: 41 done, 6 partly done, 2 open. No P1 items are left.

Every round of changes on 5 October passed the type check (no errors or warnings), the tests (54 now), `cargo check` and a production build. The Word work was also checked in Word 2021: exported books, drop caps at 13, 17 and 24 px in all three fonts, and an edit saved in Word and imported back. Removing a dictionary word was checked against the Windows spell checker itself. Nobody has clicked through the running app since then, so try these once by hand:

1. Type in a note, switch to another note and type straight away; both notes keep their text.
2. Delete a note, then restore the "Kept" snapshot on Home; the note comes back.
3. In "Earlier versions", restore the open chapter; the page shows the older text and keeps it after you type.
4. Start a new project; it opens on the welcome page.
5. Settings → Backup & export → "Restore from a backup…" with a recent backup file.
6. Settings → "Print / PDF"; every chapter prints, not just the first page.
7. Settings → General → "Add example books"; three books appear on Home.
8. Settings → Backup & export → "Export Word…", save, and open the file in Word; it looks like the page in Pensieve.
9. Choose a Word copy folder, type in a chapter and switch to another window; the copy updates. Change the copy in Word and save it; Pensieve stops updating it and says why.
10. "Import Word…" that copy and choose "Replace this book's chapters"; the change made in Word appears in the chapter.
11. Start the app; it opens on Home, and "Continue writing" opens the chapter you worked on last.
12. Type in a note that is also a to-do, switch to To-dos straight away and change its state; the note keeps the words you just typed.
13. Put a picture in a chapter; it shows in the Book view and in print, and it's in the Markdown export and in "Copy HTML".
14. Remove a word in Settings → Language; the page underlines it again (perhaps only after restarting Pensieve).

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
| **IMP-18** Paste from Word (ED-10) | Paste a chapter from a real manuscript and check headings, italics and paragraphs survive | The tests cover Word export and re-import, not pasting. An automatic test needs a browser-like document in the tests (a test-only package such as `happy-dom`) | Open | P3 |

## 4. Comfort and polish

| ID | Suggestion | Why | Status | Pri |
|---|---|---|---|---|
| **IMP-22** Slovenian interface | Translate the rest of the interface | Done so far: Settings → General switches about 30 labels (view tabs, greetings, Home buttons, Settings sections, the chapter list heading). The toolbar, notes, to-dos, floating bar, Settings contents and messages are still English only | Partial | P3 |
| **IMP-23** Recorded ambience loops (AT-3) | Add short recordings as `static/ambience/rain.ogg`, `fire.ogg`, `cafe.ogg` and `piano.ogg` | Done so far: the app plays those files when they exist. None are there yet, so all four sounds are still generated noise | Partial | P3 |
| **IMP-25** Keyboard and screen-reader pass | Check that every tool can be reached with Tab and has a clear name | Done so far: Settings traps focus, focuses its first control, and returns focus when it closes. Toolbar buttons that show a letter or symbol (B, I, A, +, –, “) and Settings' × now have spoken names, and svelte-check reports no accessibility warnings. What's left needs someone tabbing through the running app | Partial | P3 |

## 5. Code health

| ID | Suggestion | Why | Status | Pri |
|---|---|---|---|---|
| **IMP-28** Split `+page.svelte` | Move find and replace, history and restores, projects, backups, the Word copy and Zen into their own modules | Done so far: chapter changes moved to `src/lib/chapters/mutate.ts`. The page is still the largest file in the app, at about 1,770 lines | Partial | P3 |

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
| IMP-13 More export formats (SV-7, SV-11) | Markdown, plain text and "Copy HTML" in Settings → Backup & export. Markdown and plain text ask where to save |
| IMP-14 Word goal per chapter (CH-6) | Set under the chapter list or in Outline; the list shows words against the goal |
| IMP-15 Project templates (CH-8) | Novel, Short stories and Article; an Article has no chapter list |
| IMP-16 Parts (CH-5) | Chapters can belong to a named part, shown as a heading in the chapter list |
| IMP-17 Manage the personal dictionary (ED-13) | Removing a word in Settings removes it from Pensieve's list and from the Windows spell checker. Checked against Windows: the word is flagged again afterwards |
| IMP-19 Edit and delete to-dos | Edit on a slip renames it, changes its chapter or note, or deletes it |
| IMP-20 Backlinks | A note lists the notes that link to it, under "Linked from" |
| IMP-21 Notes for this chapter | The side panel puts notes linked to the open chapter first and marks them "This chapter" |
| IMP-24 Keyboard cheat sheet (ST-4) | Settings → Shortcuts, also opened with Ctrl+/ |
| IMP-26 First-run welcome | Every new book file, including the one made on first launch, opens on the welcome page with an empty first chapter after it. "Start something new" uses the same code (`firstChapters` in `src/lib/chapters/welcome.ts`) |
| IMP-27 Tests for the data paths | Vitest, run by CI: 43 tests covering restore, notes in snapshots, backup files, the note save queue, counts, find and replace, exports, pictures, Word export and import, and the example books |
| IMP-29 One save path for notes and to-dos | Every note and to-do change, including deleting a to-do, goes through one queue in `src/lib/storage/organize.ts`. The latest change to each wins, and a failed write is tried again. Lists and backups wait for pending saves. This closed a gap where the To-dos view could read a note before its last words were saved, then write that older copy back when you changed the to-do's state |
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
| IMP-44 Safer book switching and moving | Found while applying the fixes: switching books now saves pending note edits first, and the database switch waits for queued writes, so they can't land in the next book's file. After "Move project…", the old copy is dropped from Home's list. Opening a remembered book whose file is gone shows an error instead of creating an empty book. If the next book fails to open, the app now goes back to the one it left |
| IMP-45 Pictures in exports and the Book view (ED-12) | Pictures reach Word, HTML, Markdown, plain text (as "[Picture]"), the Book view and printouts. The same pass keeps line breaks, links, superscript, highlights, horizontal rules, quotes with several paragraphs and nested lists, which were lost or run together before. Lists and quotes come out as one list or quote each, and only web and mail links reach the HTML |
| IMP-46 Word files that open in Word (SV-6, SV-8) | Asked for on 5 October. "Export Word…" asks where to save and writes the book as it looks on the page: the manuscript font packed into the file, the app's text size and spacing, chapter labels, drop caps, first-line indents, each chapter on a new page, and a running head with page numbers. Word keeps the fonts when it saves the file again. A **Word copy** in a chosen folder is rewritten when the window loses focus, on a book switch and on close. Automatic updates stop, and say why, when the copy was changed in Word or a file Pensieve didn't write has its name. "Update now" replaces it; the message asks you to import the Word changes first. "Import Word…" lists the chapters it found, then either replaces the book's chapters (after a snapshot, keeping each chapter's status, goal and part) or adds them. Files from elsewhere are split at headings or chapter lines. Fonts: static Literata and EB Garamond from Google Fonts (SIL Open Font License) in `static/fonts/word/`. Word ignores variable fonts |
| IMP-47 Example books | Asked for on 5 October. Settings → General → "Add example books" adds a novel (*The Lantern House*), a Slovenian story collection (*Zgodbe ob reki*) and an article. Each is its own book file, with notes and to-dos, so every view has something in it. Clicking again doesn't make copies |
| IMP-48 Chapter labels in the book's language | Labels follow the book's language ("Prvo poglavje", "13. poglavje"), and story collections label stories ("Story One", "Prva zgodba"), on the page and in Word. Word import also recognises Slovenian chapter lines such as "3. poglavje" |
| IMP-49 Load the Word writer when it's needed | The `docx` library loads on the first Word export or Word copy update. The page's startup script went from 908 kB to 549 kB |

## Suggested order

1. **Try the fixes by hand:** the checks in the summary, on the real laptop.
2. **Speed:** IMP-10 on the same laptop.
3. **Finish the safety items:** IMP-7, then IMP-6.
4. The rest, by what the writer asks for first.
