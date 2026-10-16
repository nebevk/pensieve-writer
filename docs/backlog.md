# Backlog

What is still open: gaps against the design system (`design-system/`), suggested improvements, and checks
to do by hand on Eva's laptop. Last reviewed 12 October 2026. What the app does is in
[requirements.md](requirements.md); finished items are in the git history (the old `design-gaps.md` and
`improvements.md`).

Each item keeps its ID so it can be asked for by name; a new one gets the next free number.
**Priority:** P1 can lose her text, P2 is noticeable, P3 is polish.

## Open items

| ID | What | Status | Pri |
|----|------|--------|-----|
| **IMP-10** Speed on the real laptop | Time typing in a chapter of the long test book on her laptop, in Candlelit with the sparks on, with the panel open and a note pinned; time the start with that book open. The typing check (processor slowed four times) gives 48 ms from key to paint, the median, and 72 ms for 19 keys in 20 (ARCH-11, 16 October); this confirms it on the hardware that matters (Windows 10, 8 GB of memory) | Open | P2 |
| **WIN-1** One window bar | The app draws its own window bar (Windows' is off). Check it in the desktop window: dragging, a double-click to maximise, the three buttons, and resizing from the edges | Check | P2 |
| **WIN-3** Language badge | The design's badge shows the project's writing language; the app's marks the selected text, or the open chapter, as EN or SL. Decide which | Differs | P3 |
| **IMP-28** Split `+page.svelte` | Find and replace, earlier versions, updates, the folder backup, the Word copy and a project's writings (`writingActions`: made, renamed, deleted and put back, split or joined, put in order, a file brought in as one) have their own modules, and what a folder's move or a project's leaving does to the settings is a tested function: 4,354 lines down to about 3,700. Left: the library's folders and projects on disk (renamed, moved, deleted) and notes from the tree, which change several pieces of the page's state at once; then the windows and Zen | Partial | P3 |
| **AT-11** Vrt zgodb, the garden | Waiting for the art: the eight plant stages first, then the five backdrops and the keepsakes, as [garden-concept.md](garden-concept.md) describes; then it is built | Open | P2 |
| **LOOK-4** A design pass | The design system doesn't draw these yet, so they were built in the app's own way: the library tree, Outline, Book, footnotes, comments, the Earlier versions window, the notes and to-dos panel, the selection bar, the pomodoro, error states, and Home in the dark themes. Settings other than Appearance follow its rows (14 October): a name, what it is for under it, its control on the right | Open | P3 |

Requirements marked *Not started* (VW-5, SV-10, SV-12, AT-7, tables in ED-12, scenes in CH-5) wait
until the owner asks for them.

## Architecture code review

A review of the whole app on 14 October 2026, in three read-only passes: data safety, the typing path and
the code's structure. Each finding was then checked in the code. Nothing was profiled or run. The plan made
from it, with the fixes in order, is [review-plan.md](review-plan.md). ARCH-2, 3, 10, 16 and 17 are done
(15 October, in 0.5.1), ARCH-1 and ARCH-5 later that day, ARCH-15, 20, 21 and 22 on 16 October (0.5.2), and ARCH-6,
18, 23, 14 and 11 after it; they are in the git history.

**Verdict:** the architecture stays. A thin Rust side, one SQLite file per project, the editor loaded after
Home and one queue for every database call suit one writer on an older laptop; nothing in the stack needs
replacing. What needs work is a few paths, listed below.

**Already sound, keep it:**

- **Saving:** WAL with full sync, so "Saved" means the text is on disk. A failed save keeps the text, says
  so and tries again.
- **Copies before anything risky:** a snapshot before every destructive edit, hourly and daily snapshots, a
  `VACUUM INTO` copy before a schema upgrade, backups written to a temporary file and then renamed, and
  deleted projects sent to the Recycle Bin.
- **The editor kept apart:** the chapter's JSON is read only when it saves, the word count waits for a
  pause, find and repetition marks cover only what is on screen, and no key calls Rust.
- **Loading:** TipTap, `docx` and `mammoth` load when first needed.
- **The code:** no import cycles, SQL only in `src/lib/storage/`, and a missing Slovenian string fails the
  type check.

| ID | What | Status | Pri |
|----|------|--------|-----|
| **ARCH-4** Saves and restores in one transaction | These are many statements, each committed on its own: a writing's save, a restore from a backup, a writing deleted for good and a sample project. JavaScript can't wrap them in a transaction: plugin-sql runs each call on any connection of its pool, so a `BEGIN` doesn't hold. A crash mid-restore leaves the writing half restored. A crash mid-save only doubles text, because of the order chapters are written in. Add Rust commands that save and restore a writing in one transaction, with one disk sync per save instead of one per chapter | Open | P2 |
| **ARCH-7** Save only what changed | Every 2-second pause sends the whole book to the file again. `writeWriting` turns every chapter into JSON, changed or not, and walks each one for pictures through Svelte's proxies (`writing` in `+page.svelte` is deep `$state`). On the long test book this is the likeliest hitch on the first key after a pause. Write only the chapters that changed, and make `writing` `$state.raw` (its updates already replace objects). Measure with ARCH-11 first | Open | P2 |
| **ARCH-8** Typing in the Notes tab | Each key in a note replaces the notes list, and "Appears in" (`Notes.svelte`) walks every chapter's JSON and text again. Keep a copy of the open note while she types, as the panel's note does. ARCH-13 does this for every view | Open | P2 |
| **ARCH-9** Work at each pause | The comment rail reads the whole chapter 150 ms after every key, whether there are comments or not (`CommentRail.svelte`). At 400 ms the chapter's text is read, one search per note runs over it, and the footnotes are walked. With Pages on, a pagination pass measures the page at 300 ms. Skip the comment read when the chapter has no comments, and move the 400 ms work to when the window is idle | Open | P2 |
| **ARCH-12** One place for the open project | The open project is kept in five places: `projectLocation` and `prefs.projectPath` in the page (read together 19 times), the plain `switchingBooks` flag, and `openPath` and `openProjectId` in `sqlite.ts`, which also reads `prefs` itself. No bug today, but a save into the wrong file would start here. A session module owns it, and storage is given the path. This is the first step of what is left of IMP-28 | Open | P2 |
| **ARCH-13** One copy of the notes | The page (`bookNotes`, `paneNote`) and Notes, To-dos, Ideas and Home each load and save their own notes, kept in step by reading them again. An old copy did get saved over newer words, from Home's tree; since 15 October the page reads a note again before it renames, copies or shows it. Left: one notes store that every view reads and writes. With a prefs store as well, it also shortens the lists of callbacks the page hands each module (IMP-28) | Partial | P2 |
| **ARCH-19** The Rust side's edges | Commands that move or delete folders accept any path. Rust's errors are matched by their English text, not by a code. `csp` is `null` in `tauri.conf.json` | Open | P3 |
| **ARCH-24** Every key's own work | The typing check (ARCH-11) shows a key typed in a burst in 48 ms, the median, with the processor slowed four times, where a bare editable box shows one in 16 ms. The short welcome page takes the same 48 ms as the long book, with Pages on or off and with or without comments, so this is work done for every key, not for the book's size. A profile puts about 13 ms of code on each key at that speed: ProseMirror reading the letter and applying it (about 6 ms, scrolling the cursor into view among it), Svelte updating the page after it (2.5 ms, the Ribbon's `can()` and summary among it), and the smooth-typing caret measuring where it is with `getClientRects` (4 ms, most of it a forced layout). Work that misses a frame waits for the next one, so a little less of it could bring a key from 48 ms to 32. Start with the caret, and `writing` as `$state.raw` (ARCH-7) | Open | P2 |

**Order:** as [review-plan.md](review-plan.md) has it: the typing fixes, by what ARCH-11 measured: every
key's own work first (ARCH-24), then the work at a pause (ARCH-9), then the save (ARCH-7).

**For the owner to decide:**

- One call holding the transaction, or Rust's `sqlx` as a new dependency (ARCH-4).

**Not checked:**

- The laptop's real numbers: the typing check's are with the processor slowed four times (IMP-10).
- How Drive for desktop locks files.
- One pass found that a failed note save says nothing unless Notes or Ideas was opened that session; this
  wasn't checked again.

## Known differences from the design system

On purpose: keep them when matching the design.

- **The page:** plain, with no running head, chapter label, drop cap or first-line indents; 12 pt, lines 1.5
  apart, paragraphs a little apart. Pages are wider (Book 760–960 px) and grow with the room.
- **Paper:** no second sheet drawn under the page; Pages (A4 or A5) instead.
- **Goals:** no streak and no goal meter in the floating bar; a Goals list beside the page.
- **The floating bar:** the looks as icons, the sound and the keys' sound with their volumes, and the
  pomodoro; no book total, language or save state.
- **Themes and sound:** Sunset and Forest themes and "Day and night"; sound is its own choice in any theme (no Night
  rain).
- **Write:** the panel shows one list at a time; no chapter statuses; both side lists have a hide
  button; scrollbars are slim; the library's + has a menu in words; sparks drift over the desk in Candlelit.
- **The brand:** the owner's Basin mark (`design-system/exports/pensieve-icons`), not a "P" square; it moves
  on Home only, so nothing moves beside the page she types on.
- **Home:** hers on the left (the large mark beside the greeting, the Continue card, a short to-do list),
  every project on the right as cards or a table, the two as wide as each other; no chapter strip, chapter
  statuses (the owner's drawing of 13 October shows "Osnutek"; statuses were dropped on 12 October), recent
  notes or progress bars. Another project from elsewhere opens from the library's +, not from Home.

## Parked ideas

From the design's early rounds, until the owner asks for one: headings
listed under each chapter, a synopsis and goal bar on the open chapter, a styles gallery, Paste, Cut and
Copy buttons, a ruler, to-do counts on the To-dos button and the Home cards.

## Check by hand on the laptop

The browser checks can't reach these: the desktop window, Windows, Word, Google Drive and the laptop
itself. Most worth doing once on Eva's laptop, with the installed release:

1. **Updates:** publish a newer release ([releasing.md](releasing.md)), then Settings → General → Check for
   updates. The window bar offers it; one click saves, installs it and opens Pensieve again, with
   everything as it was.
2. **First start** on a computer where Pensieve never ran: Slovenian, Documents\Pensieve\My first project,
   the welcome page.
3. **Speed:** IMP-10 above.
4. **The window bar:** WIN-1 above.
5. **Close and start again** with the long test book open: Home appears, and Continue writing opens the
   chapter straight away.
6. **Earlier versions:** restore the open chapter (the page shows the older text and keeps it after typing),
   then delete a note and restore the whole book (it asks first, and the note comes back).
7. **Backups:** pick a folder inside Google Drive, Back up now, then Settings → Backup & export → Restore
   from a backup.
8. **Word:** Export Word for a book with parts and open it in Word (the navigation pane shows parts,
   chapters and subheadings at 12 pt); bring it back with the writing's Bring back from Word.
9. **Word copy:** choose a folder, type, switch windows (the copy updates); change it in Word and save
   (Pensieve stops updating it and says why).
10. **Print / PDF** prints every chapter.
11. **Spell check** underlines in both languages; a word removed from the dictionary in Settings → Language
    is underlined again. Windows 10 checks Slovenian only with its Slovenian language added (Settings → Time
    & Language → Language); without it, Slovenian words aren't underlined.
12. **Sound:** ambience starts with the first click and keeps playing in Gentle mode; keystroke sounds
    follow the keys.
13. **The library:** rename and drag the open project's folder; her files open with a double click; a Word
    file comes in as a new writing.
14. **Dropped from Explorer:** drag her manuscript's Word file onto Home (New project from it) and into Write
    (a new writing); a picture dropped there is refused with a word, and nothing ever opens in Pensieve's place.
15. **OpenDocument:** a manuscript saved by LibreOffice (.odt), with a footnote, a comment and a picture,
    brought in as a new writing: the checks use files made the way LibreOffice writes them, not one from it.
14. **New project** from one of her real Word files, and from a folder of her Word and text files as one
    book: the chapters come in order, with their headings, italics and pictures, and č, š, ž.
    Then paste a chapter of her manuscript from Word: its headings, italics, lists and footnotes come in, and
    nothing of Word's (the check uses Word's clipboard format, not her own Word).
15. **Pages** (A4) on the long test book: no flicker while opening chapters and typing.
