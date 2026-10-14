# The architecture review: what holds, and the fixes

The other session's review (ARCH-1 to ARCH-22 in [backlog.md](backlog.md), 14 October) read the code but
ran nothing. Each finding has since been checked again in the code, with a fix designed for it, and the two
that could lose text silently were tried in the app (the browser checks' harness). This is the plan that
came out of it.

## What changed in the review's picture

- **ARCH-13 loses note text today, reproduced.** Home's list view shows the page's older copy of the notes.
  A note edited in the Notes tab and then renamed in Home's tree went back to its old text; the new words
  were gone. Opening that note from Home's tree and typing does the same. The review called this tidiness.
- **New: a link in the Book view takes the whole window away, reproduced.** A click sent Pensieve's window
  to the web page. The window has no Back button, so Eva could only kill Pensieve. The Book view's links
  have no `target`, and nothing guards the window's navigation.
- **ARCH-2, two copies of the app, is the likeliest silent overwrite in normal use.** Clicking the icon
  while Pensieve sits minimised starts a second copy. Typing in the older window then puts the writing back
  to its text and deletes chapters made in the other. The two copies also overwrite each other's prefs.json.
- **ARCH-1's cause is a little different.** The database's connections close after 10 minutes idle, so a
  folder renamed in Explorer during a tea break makes every later save fail. Switching projects fails too,
  because it saves first.
- **ARCH-4's risk is lower than written.** The order chapters are written in means a crash doubles text
  rather than losing it, and every restore keeps a "Before restore" version first. Its real gain is one disk
  sync per save instead of one per chapter.
- **ARCH-9's tool is wrong and ARCH-21 is small.** `requestIdleCallback` doesn't help: a key that arrives
  while the idle work runs still waits. Recounting a note's mentions per paragraph does help. The Ribbon's
  checks cost tens of microseconds a key.
- **ARCH-11 has a trap.** The checks' stand-in database (sql.js) runs on the page's own thread, so a timed
  save in a check blames the stand-in for work the real app does in Rust. It has to give way, or run in a
  worker, before pauses are timed.

Every other finding holds as written.

## The fixes, most urgent first

| | Fix | Size | Needs |
|---|---|---|---|
| **1** | **ARCH-13, stop the old copy.** `showNote`, `changeNote` and `duplicateNote` wait for a fresh read of the notes when the note isn't the one open beside the page, and Home reads them again when it opens. A browser check for both ways it happened | S | — |
| **2** | **Book view links.** A navigation guard on the window keeps it on Pensieve and opens web links in her browser (the opener crate is already there for Show in Explorer), and the Book view's links open beside it. A check that the window stays | S | — |
| **3** | **ARCH-2, one copy.** Tauri's `tauri-plugin-single-instance` 2.5 (it matches the Tauri 2.12 already used): a second start brings the open window forward, restored if minimised, and quits. Only in installed builds, so `tauri dev` still runs beside an installed Pensieve | S | your yes to the plugin |
| **4** | **ARCH-3, a save at least every 10 seconds** while she types, not only at a pause. It waits while she is still naming a new chapter's heading, because a save there splits the chapter under her cursor | S | — |
| **5** | **ARCH-1, a way out.** a) A failed open is tried again at the next save, without creating a missing file. b) Export and Copy HTML work from the text in memory when saving fails. c) At close, a failed save leaves a rescue copy (the open writing, its notes and to-dos) in the app's folder, she is asked once, and Pensieve closes; the next start offers the copy back through the existing restore | M | your choice: close after the rescue copy, or keep refusing |
| **6** | **The backup, in one pass:** ARCH-16 (a backup that worked is never reported as failed, and pruning goes on past an error), ARCH-10 (the backup runs off the window's thread, as do the Word copy and prefs), ARCH-17 (files written through to disk before a rename; prefs.json replaced in one step) | S | — |
| **7** | **ARCH-5, delete for good keeps a copy** in the app's folder, in the backup format; nothing is deleted if the copy fails. Shares the writer of 5c | S | where the copies live, and for how long |
| **8** | **ARCH-6, move into the library** with `VACUUM INTO` inside the save queue, and back to the old file if the new one won't open | S–M | — |
| **9** | **ARCH-18, back up the project she leaves**, with a backup signature per project so switching back and forth makes no duplicates | S–M | — |
| **10** | **ARCH-14, tests where her text is kept:** a stand-in for the SQL plugin on sql.js so `sqlite.ts` and autosave run under Vitest, about eight cases (a save round trip with č, š, ž and a picture; never touching another writing's chapters; a failed split leaves text in both chapters; snapshots taken and pruned; restore; a save queued before a switch; the move's failure paths; an upgrade). CI on every push, with `cargo test` | M | — |
| **11** | **ARCH-11, speed checks that see her case:** the long book with Pages and comments on, bursts and pauses, key-to-paint timed with the browser's Event Timing against 40 ms; the stand-in database fixed first | M | — |
| **12** | **Typing, by what 11 shows:** `writing` as `$state.raw` and the Notes tab not searching the book on every key (ARCH-8), both S and certain; then mentions counted per paragraph (ARCH-9, M) and only changed chapters written (ARCH-7, M) | S–M | — |
| **13** | **ARCH-12, one place for the open project:** storage stops reading and writing prefs (S), then a session module owns switching (M). Takes ARCH-15 with it | S, then M | — |
| **14** | **ARCH-13's store:** one copy of the notes for every view, keystrokes kept in a draft so typing doesn't redraw the list | M–L | — |
| **15** | **ARCH-4, one transaction per save:** one call holding `BEGIN IMMEDIATE … COMMIT` (no dependency), or a Rust command with `sqlx` | M | your choice of the two |
| **16** | **The small ones:** ARCH-15 (the old migrations go; it restarts your `tauri dev` once), ARCH-19 (a test that each Rust error text matches its translation, library paths checked; a CSP last, as insurance only), ARCH-20 (the goal bar and the Tour move by `transform`), ARCH-21 (the Ribbon's questions from one derived summary), ARCH-22 (the storage rule rewritten to say what the code does) | S each | — |

1 to 4 and 6 are small and could go out together as 0.5.1. 5 and 7 share their rescue-copy writer, so they
go together.

## For you to decide

1. **ARCH-2:** may the single-instance plugin come in? The fallback is about 40 lines of our own Windows code.
2. **ARCH-1:** when a save fails at close and a rescue copy is kept, close after asking once (recommended), or
   keep refusing?
3. **ARCH-4:** one call holding the transaction (recommended, no dependency) or `sqlx` in Cargo.toml?
4. **ARCH-5:** keep erased writings' copies for how long: 30 days, say, or for good?
5. **ARCH-3:** is 10 seconds the right longest wait?
6. **ARCH-16:** after an automatic backup fails, try again in 15 minutes rather than every minute?

## Not checked

- No timings: what makes up a key's 40 ms on her laptop is still unknown (IMP-10, then fix 11).
- Two copies of the app, Drive's file locks and a shutdown during a save can only be tried on Windows itself.
- The review's note that a failed note save says nothing unless Notes or Ideas was opened wasn't checked again.
