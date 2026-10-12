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
| **IMP-10** Speed on the real laptop | Time typing in a chapter of the long test book on her laptop, in Candlelit with the sparks on, with the panel open and a note pinned; time the start with that book open. The browser checks (processor slowed four times) give about 40 ms a key; this confirms it on the hardware that matters (Windows 10, 8 GB of memory) | Open | P2 |
| **IMP-6** Pictures stored once | Pictures are shrunk to 1600 px when put in, but still kept inside the chapter, so every save and each of the up to 78 automatic snapshots copies them again. Keep them in a table of their own that chapters and snapshots refer to | Partial | P2 |
| **IMP-7** A restore drill | Tests cover the restore logic and backup files (with č, š, ž), but none writes a book to a real database, restores a snapshot and a Drive backup, and compares the text | Partial | P2 |
| **WIN-1** One window bar | The app draws its own window bar (Windows' is off). Check it in the desktop window: dragging, a double-click to maximise, the three buttons, and resizing from the edges | Check | P2 |
| **IMP-83** Projects, what is left | The Word copy is named after the writing only, so two projects with a writing of the same name would share one (Home was redone around projects on 12 October) | Partial | P2 |
| **TOOL-5** Text colour and highlight (ED-5) | The design has Word's "A" with a colour bar and a highlight swatch; each applies one fixed colour, with no choice | Partial | P3 |
| **TOOL-6** Font and size (ED-5) | The toolbar's font and size change the whole manuscript (as Settings does), not the selected text as in Word | Differs | P3 |
| **WIN-3** Language badge | The design's badge shows the project's writing language; the app's marks the selected text, or the open chapter, as EN or SL. Decide which | Differs | P3 |
| **HOME-11** Place on the Continue card | The design says "Ch. III · p. 47"; the app says "Ch. III". Pages and the Book view have page numbers now, so the page could be added | Partial | P3 |
| **HOME-15** Remove or delete a project | Home and the library can't drop a project from the list or delete it (only an empty folder can be deleted) | Open | P3 |
| **IMP-18** Paste from Word (ED-10) | Paste a chapter from a real manuscript and check headings, italics and paragraphs survive; an automatic test would need a browser-like document in the tests (a test-only package such as `happy-dom`) | Open | P3 |
| **IMP-25** Keyboard and screen reader | Settings and the windows trap the keyboard and give it back; buttons have spoken names; svelte-check reports no accessibility warnings. Still to do: someone tabbing through the running app | Partial | P3 |
| **IMP-28** Split `+page.svelte` | At about 4,000 lines it is by far the largest file. Move find and replace, earlier versions, the windows, projects, backups, the Word copy and Zen into their own modules | Partial | P3 |
| **LOOK-4** A design pass | The design system doesn't draw these yet, so they were built in the app's own way: the library tree, Outline, Book, Zen, Settings other than Appearance, the find bar, footnotes, comments, the Earlier versions window, the notes and to-dos panel, the selection bar, the pomodoro, error states, and Home in the dark themes | Open | P3 |

Requirements marked *Not started* (NT-8, VW-5, SV-10, SV-12, AT-7, tables in ED-12, scenes in CH-5) wait
until the owner asks for them.

## Known differences from the design system

On purpose: keep them when matching the design.

- **The page:** plain, with no running head, chapter label, drop cap or first-line indents; 12 pt, lines 1.5
  apart, paragraphs a little apart. Pages are wider (Book 760–960 px) and grow with the room.
- **Paper:** no second sheet drawn under the page; Pages (A4 or A5) instead.
- **Goals:** no streak and no goal meter in the floating bar; a Goals list beside the page.
- **The floating bar:** a theme menu and the pomodoro; no book total, language or save state.
- **Themes and sound:** a Sunset theme and "Day and night"; sound is its own choice in any theme (no Night
  rain).
- **Write:** the panel shows one list at a time; no chapter statuses; both side lists have a hide
  button; scrollbars are slim; the library's + has a menu in words; sparks drift over the desk in Candlelit.
- **The brand:** the phoenix in the app's bars, not a "P" square.
- **Home:** hers on the left (the greeting, the Continue card, a short to-do list), every project on the
  right as cards or the library's tree; no chapter strip, recent notes or progress bars.

## Parked ideas

From the design's early rounds, until the owner asks for one: one search for chapters and notes, headings
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
   chapters and subheadings at 12 pt); import it back with Replace this book's chapters.
9. **Word copy:** choose a folder, type, switch windows (the copy updates); change it in Word and save
   (Pensieve stops updating it and says why).
10. **Print / PDF** prints every chapter.
11. **Spell check** underlines in both languages; a word removed from the dictionary in Settings → Language
    is underlined again. Windows 10 checks Slovenian only with its Slovenian language added (Settings → Time
    & Language → Language); without it, Slovenian words aren't underlined.
12. **Sound:** ambience starts with the first click and keeps playing in Gentle mode; keystroke sounds
    follow the keys.
13. **The library:** rename and drag the open project's folder; her files open with a double click; a Word
    file comes in as a new writing; a file dragged in from Explorer is refused.
14. **New project** from one of her real Word files, and from a folder of her Word and text files as one
    book: the chapters come in order, with their headings, italics and pictures, and č, š, ž.
15. **Pages** (A4) on the long test book: no flicker while opening chapters and typing.
