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

| | Fix | Size | Needs, or done |
|---|---|---|---|
| **1** | **ARCH-13, stop the old copy.** `showNote`, `changeNote` and `duplicateNote` wait for a fresh read of the notes when the note isn't the one open beside the page, and Home reads them again when it opens. A browser check for both ways it happened | S | **Done** 15 Oct |
| **2** | **Book view links.** A navigation guard on the window keeps it on Pensieve and opens web links in her browser (the opener crate is already there for Show in Explorer), and the Book view's links open beside it. A check that the window stays | S | **Done** 15 Oct |
| **3** | **ARCH-2, one copy.** Tauri's `tauri-plugin-single-instance` 2.5 (it matches the Tauri 2.12 already used): a second start brings the open window forward, restored if minimised, and quits. Only in installed builds, so `tauri dev` still runs beside an installed Pensieve | S | **Done** 15 Oct, with your yes |
| **4** | **ARCH-3, a save at least every 10 seconds** while she types, not only at a pause. It waits while she is still naming a new chapter's heading, because a save there splits the chapter under her cursor | S | **Done** 15 Oct |
| **5** | **ARCH-1, a way out.** a) A failed open is tried again at the next save, without creating a missing file. b) Export and Copy HTML work from the text in memory when saving fails. c) At close, a failed save leaves a rescue copy (the open writing, its notes and to-dos) in the app's folder, she is asked once, and Pensieve closes; the next start offers the copy back through the existing restore | M | **Done** 15 Oct: the copy is written as soon as a save fails, not only at close |
| **6** | **The backup, in one pass:** ARCH-16 (a backup that worked is never reported as failed, and pruning goes on past an error), ARCH-10 (the backup runs off the window's thread, as do the Word copy and prefs), ARCH-17 (files written through to disk before a rename; prefs.json replaced in one step). After a failed automatic backup, the next try a quarter of an hour later | S | **Done** 15 Oct |
| **7** | **ARCH-5, delete for good keeps a copy** in the app's folder, in the backup format; nothing is deleted if the copy fails. Shares the writer of 5c | S | **Done** 15 Oct: kept with no time limit |
| **8** | **ARCH-6, move into the library** with `VACUUM INTO` inside the save queue, and back to the old file if the new one won't open | S–M | **Done** 16 Oct |
| **9** | **ARCH-18, back up the project she leaves**, with a backup signature per project so switching back and forth makes no duplicates | S–M | **Done** 16 Oct |
| **10** | **ARCH-14, tests where her text is kept:** a stand-in for the SQL plugin on sql.js so `sqlite.ts` and autosave run under Vitest, about eight cases (a save round trip with č, š, ž and a picture; never touching another writing's chapters; a failed split leaves text in both chapters; snapshots taken and pruned; restore; a save queued before a switch; the move's failure paths; an upgrade). CI on every push, with `cargo test` | M | **Done** 16 Oct: 11 cases; each fails when the rule it guards is broken |
| **11** | **ARCH-11, speed checks that see her case:** the long book with Pages and comments on, bursts and pauses, key-to-paint timed with the browser's Event Timing against 40 ms; the stand-in database fixed first | M | **Done** 16 Oct: `typing-speed-check`, the stand-in database in a worker. A key shows in 48 ms (median), 19 in 20 within 72 ms, against 16 ms for a bare editable box. Keys in a burst cost the most, not pauses or saves: the welcome page takes the same 48 ms (ARCH-24). The Pages pass takes 80–200 ms at each pause, 60% of it forced layout. A save of the whole long book takes 250–610 ms, yet keys meeting one are 48 ms at the median too |
| **12** | **Typing, by what 11 shows:** every key's own work first (ARCH-24): smooth typing's ink was most of it, **done** 16 Oct (one veil size, one animation per veil, measured before drawn; the middle key 48 → 40 ms); what is left on a key is spread thin, most of it ProseMirror's own. The save walked the whole book through Svelte's proxies: `writing` as `$state.raw`, **done** 16 Oct (a save's own work 194 → 38 ms); writing only changed chapters goes with 15 (ARCH-4). The Pages pass measured the whole chapter at every pause: **done** 17 Oct, skipped when nothing moved, else begun on the sheet the edit is on (writing at a chapter's end, its passes under a quarter of what they were). The rest of the work at a pause, measured on 18 Oct, is small and stays: the comment rail's read 54 ms over a whole typing check, the notes beside the page counted again 18 ms a pause. The Notes tab searched the whole book for "Appears in" on every key typed in a note: **done** 18 Oct, it now depends on the note's names only (a key there 64 → 32 ms, the middle one) | S–M | **Done** 18 Oct |
| **13** | **ARCH-12, one place for the open project:** storage stops reading and writing prefs (S), **done** 18 Oct: it is given the open file and nothing else, and opens none before the page opens a project. Then a session module owns switching (M), **done** 18 Oct (`session.svelte.ts`): the open project's file, the one flag that holds saves back, and every switch (the start, the library, the samples, moving into the library, a folder moved), each remembered for the next start only once it opened and going back the same way when it won't. That way back now reads the project's shelf again, which moving into the library forgot: after a copy that wouldn't open, her notes and to-dos were refused until she switched projects | S, then M | **Done** 18 Oct |
| **14** | **ARCH-13's store:** one copy of the notes for every view, keystrokes kept in a draft so typing doesn't redraw the list. **Done** 18 Oct (`notes.svelte.ts`): the page, the panel beside it, both trees, Home's to-dos and the To-dos, Ideas and Notes views show and change one copy, read again on the way into each view; the note open beside the page is its draft while she types. On the way: a note open in the panel no longer saves its old chapter back after a join, and a to-do ticked on Home counts down in the tree beside it at once. A key typed in a note in the Notes tab 32 → 24 ms (the middle one) | M–L | **Done** 18 Oct |
| **15** | **ARCH-4, one transaction per save:** **done** 19 Oct, without a dependency. A writing's chapters go to the file in one statement, which SQLite writes whole or not at all, with one sync to the disk instead of one per chapter; a save stopped halfway leaves the chapters as they were last saved. The way chosen, one call holding `BEGIN … COMMIT`, was dropped on reading the plugin: a call that fails after its `BEGIN` leaves the transaction open on one connection of the pool, out of the page's reach, and later saves on that connection would never be committed. One statement needs no transaction. A restore gets the same writing by writing, after its "Before restore" version: one stopped between writings leaves each whole, and restoring again finishes it | M | **Done** 19 Oct |
| **16** | **The small ones** (ARCH-15, 20, 21 and 22 done 16 Oct, in 0.5.2; ARCH-19 done 19 Oct): ARCH-15 (the old migrations go; it restarts your `tauri dev` once), ARCH-19 (moving and deleting a folder only inside the library, as the Recycle Bin already was, with no `..` leading out of it; a test that reads every error text the Rust side words and finds its Slovenian, which found 8 without one; a content security policy that lets in only Pensieve's own scripts, with pictures from the web still shown as before; the browser checks run under it and fail on anything it refuses), ARCH-20 (the goal bar and the Tour move by `transform`), ARCH-21 (the Ribbon's questions from one derived summary), ARCH-22 (the storage rule rewritten to say what the code does) | S each | **Done** 19 Oct |

1 to 4 and 6 went out in 0.5.1 (15 October). 5 and 7, which share their rescue-copy writer, were done the
same day, after it.

## For you to decide

1. ~~**ARCH-2:** may the single-instance plugin come in?~~ Yes (15 October); it is in.
2. ~~**ARCH-1:** when a save fails at close and a rescue copy is kept, close after asking once, or keep
   refusing?~~ Close after asking once (15 October); it refuses only while no copy of her words exists.
3. ~~**ARCH-4:** one call holding the transaction (recommended, no dependency) or `sqlx` in Cargo.toml?~~ No
   dependency (19 October); it became one statement per save, as one call can't hold a transaction safely.
4. ~~**ARCH-5:** keep erased writings' copies for how long: 30 days, say, or for good?~~ For good, in
   Pensieve's own folder, with a way in Settings to remove them (15 October).
5. ~~**ARCH-3:** is 10 seconds the right longest wait?~~ Yes (15 October).
6. ~~**ARCH-16:** after an automatic backup fails, try again in 15 minutes rather than every minute?~~ Yes
   (15 October); it is in.

## Not checked

- The laptop's own timings (IMP-10): the typing check's 48 ms is with the processor slowed four times in headless Edge.
- Two copies of the app, Drive's file locks and a shutdown during a save can only be tried on Windows itself.
  By hand, on the installed 0.5.1: with Pensieve minimised, start it again from its icon; the open window
  comes back and no second one opens. In the Book view, a link opens in the browser and the window stays.
- The review's note that a failed note save says nothing unless Notes or Ideas was opened wasn't checked again.
- The content security policy (ARCH-19) in the installed window, by hand once, as in [backlog.md](backlog.md).
