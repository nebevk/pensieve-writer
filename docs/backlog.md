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
| **WIN-1** One window bar | The app draws its own window bar (Windows' is off). Check it in the desktop window: dragging, a double-click to maximise, the three buttons, and resizing from the edges | Check | P2 |
| **WIN-3** Language badge | The design's badge shows the project's writing language; the app's marks the selected text, or the open chapter, as EN or SL. Decide which | Differs | P3 |
| **IMP-28** Split `+page.svelte` | Find and replace, earlier versions, updates, the folder backup, the Word copy and a project's writings (`writingActions`: made, renamed, deleted and put back, split or joined, put in order, a file brought in as one) have their own modules, and what a folder's move or a project's leaving does to the settings is a tested function: 4,354 lines down to about 3,700. Left: the library's folders and projects on disk (renamed, moved, deleted) and notes from the tree, which change several pieces of the page's state at once; then the windows and Zen | Partial | P3 |
| **AT-11** Vrt zgodb, the garden | Waiting for the art: the eight plant stages first, then the five backdrops and the keepsakes, as [garden-concept.md](garden-concept.md) describes; then it is built | Open | P2 |
| **LOOK-4** A design pass | The design system doesn't draw these yet, so they were built in the app's own way: the library tree, Outline, Book, footnotes, comments, the Earlier versions window, the notes and to-dos panel, the selection bar, the pomodoro, error states, and Home in the dark themes. Settings other than Appearance follow its rows (14 October): a name, what it is for under it, its control on the right | Open | P3 |

Requirements marked *Not started* (VW-5, SV-10, SV-12, AT-7, tables in ED-12, scenes in CH-5) wait
until the owner asks for them.

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
14. **New project** from one of her real Word files, and from a folder of her Word and text files as one
    book: the chapters come in order, with their headings, italics and pictures, and č, š, ž.
    Then paste a chapter of her manuscript from Word: its headings, italics, lists and footnotes come in, and
    nothing of Word's (the check uses Word's clipboard format, not her own Word).
15. **Pages** (A4) on the long test book: no flicker while opening chapters and typing.
