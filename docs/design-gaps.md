# Design system gaps

What the app is still missing compared with the design system in `design-system/`. First review 2 October 2026; rechecked 2, 5 and 6 October.

- **Design source:** the UI kit in `design-system/ui_kits/desktop/`, the components in `design-system/components/`, and rounds 3–6 of `Pensieve Directions.dc.html` (5a/5b: Write with the chapter panel; 6a/6b: the revamped Home). The owner updated the UI kit and components on 5 October; the Directions canvas in the repo is still the 2 October copy, so rounds 5 and 6 were read from the kit and components. Rounds 1a–2b are superseded and out of scope (confirmed by the owner on 5 October); see "Earlier rounds" at the end.
- **App:** commit `22d85eb`, "feat: keep the manuscript safe and finish the writing tools", plus the work of 5 October: starting on Home, the Slovenian interface, recorded ambience, footnotes, note links, chapters on note to-dos, the design's icons, comments, the app's own window bar, the design's colours and motion everywhere, the chapter panel (round 5) and the revamped Home (round 6); and of 6 October: the P3 polish below, other names for notes, a faster start, and the owner's decisions on the greeting, the view tabs, "Revising" and ambience. The Word work, the example books and the long test book don't change any designed screen.
- **IDs:** each gap has an ID (HOME-4, TOOL-2, …) so you can ask for it by name. IDs stay fixed; closed gaps move to "Closed" rather than being renumbered. Requirement IDs in brackets (ED-12, VW-4, …) point to `docs/requirements.md`.
- **Not design:** data-safety findings and other suggestions are in `docs/improvements.md`.

**Status:** *Missing*: not in the app. *Partial*: started, not finished. *Differs*: works, but not the way the design shows; decide whether to change it.

**Priority:** *P1*: core to daily use, do first. *P2*: a clear, visible gap. *P3*: polish.

## Summary

8 open gaps: no P1, 1 P2, 7 P3. Since the first review, 37 gaps and 2 small fixes are closed, and 4 differences were accepted. The owner settled HOME-10, WIN-2, CHAP-4 and BAR-1 on 6 October.

Already matching the design:

- Tokens come straight from `design-system/tokens/`, and the fonts are self-hosted as the design readme asks.
- Daylight, Candlelit and Moonlit themes, plus Follow sunset.
- The manuscript page: running head with folio, chapter label, centred title, drop cap, indents, the next sheet underneath, grain, vignette and lamp glow.
- The 34px title bar as the only window bar, with the design's four view tabs, the quiet toolbar and the grouped "All tools" row, including Footnote, Comment and "Link a note".
- The design's Lucide icons.
- The chapter list with numbers, status dots and their legend, word counts, untitled chapters in faint italics, and the accent "+".
- The floating bar with its ambience and Zen icons and today's goal meter.
- Notes as index cards with fields, [[links]], to-dos tied to chapters, "Appears in" and "Linked notes", and the Notes / To-dos switch.
- The To-dos board with column dots, filters, quick add, and chapter and note chips.
- Home's own header, the greeting that names the chapter you'll continue, project cards with kind and progress, "Start something new" tile and "Continue writing" card.
- Settings as a window over a scrim, with Appearance (its theme swatches show a page and the lamp glow) and Shortcuts.
- The lamp glow on the desk behind the page, the note card and the to-do board.
- Decor circles only on Home and Settings, the accent focus ring, the design's motion and pressed states, and reduced motion.
- Every surface on the `--pv-*` tokens: ink colours on paper, chrome colours on chrome.

Biggest open gap: the app's own window bar (WIN-1) is built but not yet checked in the desktop window. Everything else open is P3 polish.

## Closed

| ID | What changed | Checked |
|---|---|---|
| HOME-1 Several projects | Home lists the open book and every other book you've opened, with a count; each card opens its book. A book whose file is gone shows an error instead of opening empty | 5 Oct |
| HOME-2 New project | A "Start something new" tile and button, with a choice of Novel, Short stories or Article. The new book gets its own file in a folder you pick, outside the backup folder, and opens on a welcome page | 5 Oct |
| HOME-3 Project title | Click the title on the Home card to rename the book; the new title is saved with the project | 2 Oct |
| HOME-4 Continue writing | "Continue writing" and the card open the chapter the card shows | 2 Oct |
| HOME-5 Drive backup and its status | Backs up to the Drive folder every hour while the app is open and again when it closes. Home shows "Backed up · 12 min ago", "No backup yet" or "Last backup failed" | 5 Oct |
| HOME-6 Home header | Home has its own 60px header: the logo with the Pensieve name, the backup line, a large language badge (it switches the interface language, which new books also start in), settings, and the window buttons. The project title bar and its view tabs are gone from Home | 5 Oct |
| HOME-7 Start on Home | The app opens on Home; "Continue writing" opens the chapter you worked on last | 5 Oct |
| HOME-8 Project kind (CH-8) | Every card names its kind in the book's own language and in the design's tone: accent for a novel, sage for stories, muted for an article. Other books remember their kind from when they were last open; a book not opened since this change says "Book" until it is | 5 Oct |
| HOME-13 Revamped Home (round 6) | Home follows rounds 6a/6b: a theme switch in the header; the date with the time; words today and words in the book; the open book's chapters as status bars that open each chapter; the Continue card with a Zen button and "Rain plays when you start · Change"; then Open to-dos (tick them here), Recent notes, and Projects as rows with a tiny title page, language and progress. "+ New" offers the three kinds and "Open another project…". The book's title in the chapter strip renames it | 5 Oct |
| HOME-10 Greeting | As designed, the greeting names the chapter Continue opens: "Good evening. The Attic is waiting.", and from 23:00 to 5:00 "Late again." An untitled chapter goes by its number ("Chapter 5 is waiting."), and a new book's welcome page gets the greeting alone. In Slovenian: "Dober večer. »Podstrešje« čaka." The Bible verse is gone, as the owner chose | 6 Oct |
| HOME-9 Target and progress | A novel shows "48,930 / 80,000" against its book target (Settings → Writing & goals) or, without one, its chapter goals added up; stories show "6 of 12 stories"; an article shows "1,240 words · Final". The bar follows the same numbers, and a book in the other language adds " · SL" or " · EN" | 5 Oct |
| WIN-2 Four view tabs | Write · Outline · Book · Notes, as designed. To-dos open from the Notes / To-dos switch, which keeps Notes lit, from Open to-dos on Home, and beside the page | 6 Oct |
| TOOL-1 Footnote (ED-12) | ¹ in "All tools" adds a numbered footnote at the cursor; click one to edit or delete it in a small panel. The notes are listed under the chapter and in Book view. Word gets real footnotes, HTML, Markdown and plain text get numbered notes, and Word footnotes come back on import | 5 Oct |
| TOOL-2 Comment (ED-14) | Select words and use Comment in "All tools" or Ctrl+Alt+M, as in Word. The comment is a slip in the margin beside its words, which are tinted; the open one shows To-do and Note. To-do makes a to-do for the chapter; Note makes a note tied to the chapter and links the words to it. Comments go to Word as real comments and come back on import | 5 Oct |
| TOOL-3 Link a note (NT-6) | "[[ ]]" in "All tools" opens a list of notes: pick one to link the selected words to it, or, with nothing selected, to add its title as a link. The list also removes a link. Linked words show in accent with an underline, and clicking one opens the note beside the page | 5 Oct |
| TOOL-4 New note, Add to-do | Add to-do opens the chapter panel's add field. New note opens the Notes view with a note tied to the chapter you were writing, as the panel shows notes but doesn't edit them | 5 Oct |
| PANEL-1 Chapter panel (NT-7, round 5) | A 300px panel beside the page, opened with the To-dos and Notes toggles in the toolbar (with counts): the chapter's to-dos (tick, add; "From note · …" when one came from a note) and the notes it mentions, most mentioned first. A character counts by first name, so Ana Novak counts every "Ana". The top note is open, with its fields and first paragraph; clicking a linked name in the text opens its note there; "Open in Notes →" goes to the full note. It replaces the old Notes and To-dos dock | 5 Oct |
| TOOL-7 Image, link | Image opens a file picker and stores the picture in the chapter; Link uses a small field in the toolbar instead of a browser prompt | 2 Oct |
| TOOL-8 Alignment in the quiet row | One "Alignment" button, showing the paragraph's alignment, opens left, centre, right and justify; it closes after a choice, with Esc or a click elsewhere | 6 Oct |
| CHAP-2 Add button | An accent "+" beside the "Chapters" heading | 5 Oct |
| CHAP-1 Status legend | Final · Revising · Draft with their dots at the bottom of the chapter list, above the chapter's controls. In Slovenian, "Končano · V popravljanju · Osnutek" takes two rows | 6 Oct |
| CHAP-3 Untitled chapters | A chapter without a title shows "Untitled" in faint italics | 6 Oct |
| CHAP-4 Status names (CH-6) | "Revising", as designed, in the chapter list, its legend, the Outline and Home; "V popravljanju" in Slovenian. Only the name changed, so books keep their statuses. CH-6 says "revising" too. Empty chapters already had the fainter hollow dot | 6 Oct |
| PAGE-2 Lamp glow behind notes and the board | The note card and the to-do board sit on the same desk glow as the page in Candlelit and Moonlit. All three now fade out as the design's `Desk` does, so the glow shows around the card instead of hiding behind it | 6 Oct |
| BAR-2 Icons | Rain and flame icons before the ambience name, and a moon on Zen. Café and Piano have no icon because the design has neither sound. The bar now says "Fireplace", as Settings does | 5 Oct |
| NOTE-1 Links in the text (NT-6) | [[Title]] in a note shows in accent with an underline; clicking it opens that note, or starts a new note with that title. The brackets stay, faint, because note text is edited as written. "Appears in" also counts words linked to the note | 5 Oct |
| NOTE-2 Chapter on a note's to-do | The add field on a note has a chapter list, set to the open chapter, and each to-do shows its chapter under it | 5 Oct |
| NOTE-3 Done tick | A done box is sage with a white tick | 5 Oct |
| NOTE-4 Search icon | The search field starts with a magnifier | 5 Oct |
| NOTE-5 Right-column headings | "Appears in", "Linked notes" and "Linked from" are in Young Serif | 6 Oct |
| TODO-1 Column dots | Hollow, accent and sage dots before To do, Doing and Done | 5 Oct |
| TODO-2 "By chapter" list | Lists only the chapters that have open to-dos, with "Whole book" last | 5 Oct |
| SET-1 Shortcuts | Settings → Shortcuts lists the keys, and Ctrl+/ opens it | 5 Oct |
| SET-2 Theme previews | Each swatch shows a small page with three lines; Candlelit and Moonlit show the lamp glow, and Follow sunset is half Daylight, half Candlelit | 6 Oct |
| LOOK-1 Icons | The toolbar, title bar, floating bar, chapter list, Notes, Settings and Home use the design's Lucide icons, copied from `components/core/Icon.jsx`, so no dependency was added. Icons the design doesn't draw, such as the Chapters toggle and the panel buttons, stay hand-drawn at a matching weight | 5 Oct |
| LOOK-2 Motion and pressed states (AT-1) | Buttons fade their colour in 120ms and darken when pressed; solid buttons brighten and darken; cards and slips lift in 180ms; toggles slide; a theme change cross-fades in 400ms. Gentle mode and Windows' reduced motion turn all of it off | 5 Oct |
| LOOK-3 Old styles left over | Outline, Book, the find bar, the Zen bar and the chapter list's controls use the `--pv-*` tokens, with ink colours on paper, so Outline cards read well in Candlelit and Moonlit. The old names are gone; the app's own problem colour is now `--pv-danger` | 5 Oct |
| Small fix | The "Spell check test" link is gone from the chapter list | 2 Oct |
| Small fix | The unused `Toolbar.svelte` is deleted | 2 Oct |

## 1. Home

Design: Directions 2c, `HomeScreen` in `ui_kits/desktop/screens.js`, `components/home/`. App: `src/lib/views/Dashboard.svelte`, `src/routes/+page.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **HOME-11** Place on the card | "Ch. III · p. 47" | "Ch. III", in roman numerals as designed, but no page: page numbers don't exist yet (see PAGE-1) | Partial | P3 |

## 2. Window and title bar

Design: `components/chrome/TitleBar.jsx`, `ViewTabs.jsx`, `components/core/LangBadge.jsx`. App: `src/lib/editor/TitleBar.svelte`, `src-tauri/tauri.conf.json`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **WIN-1** One window bar | The 34px bar is "the single window bar"; nothing sits above it | Built on 5 October: Windows' own title bar is off, the app's bar (and Home's header) moves the window and maximises it on a double-click, and it has minimise, maximise and close buttons; close still saves and backs up first. Needs a check in the desktop window, which the browser preview can't show | Partial | P2 |
| **WIN-3** Language badge | The project's writing language | Marks the selected text as EN or SL, or the open chapter when nothing is selected; the project language is only in Settings | Differs | P3 |

## 3. Toolbar

Design: `components/chrome/Toolbar.jsx` (quiet row and "All tools"), Directions 3a and 3b. App: `src/lib/editor/Ribbon.svelte`, `src/lib/editor/marks.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **TOOL-5** Text colour, highlight (ED-5) | "A" with a colour bar, and a highlight swatch, as in Word | Each applies one fixed colour; you can't pick another | Partial | P3 |
| **TOOL-6** Font and size (ED-5) | Paragraph style, font and size dropdowns in the Text group | Font and size change the whole manuscript (same as Settings → Appearance), not the selected text as in Word | Differs | P3 |

## 4. Chapter list

Design: `components/navigation/ChapterList.jsx`, `ChapterItem.jsx`, `StatusDot.jsx`. App: `src/lib/chapters/Sidebar.svelte`.

No open gaps; CHAP-1 to CHAP-4 are closed.

## 5. Page and desk

Design: `components/manuscript/Sheet.jsx`, `Paragraph.jsx`, `Desk.jsx`. App: `src/routes/+page.svelte`, `src/lib/editor/Editor.svelte`, `src/lib/views/Notes.svelte`, `src/lib/views/Todos.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **PAGE-1** Page numbers | The setting is "Running head and page numbers"; Home shows "p. 47" | The running head shows the chapter numeral. Each chapter is one long sheet, so there are no page numbers anywhere | Partial | P3 |

## 6. Floating bar

Design: `components/chrome/FloatingBar.jsx`, Directions 3a, 3c and 4a. App: `src/lib/editor/StatusBar.svelte`, `src/lib/ambience.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **BAR-3** Leaving Zen | In Zen the bar stays and its button reads "Exit Zen" | The bar hides in Zen; you leave with Esc or a bar that appears at the top edge (this meets ZN-5). The Zen layout isn't fully designed yet | Differs | P3 |
| **BAR-4** Contents | Ambience · chapter words · today's goal · Zen. Save state and language live in the title bar | Also shows a theme menu, the book total, the language name and the save state | Differs | P3 |

## 7. Notes

Design: Directions 4b, `NotesScreen` in `ui_kits/desktop/screens.js`, `components/notes/NoteCard.jsx`, `NoteLink.jsx`, `TodoItem.jsx`, `components/navigation/AsideList.jsx`. App: `src/lib/views/Notes.svelte`, `src/lib/storage/organize.ts`.

No open gaps; NOTE-1 to NOTE-5 are closed.

## 8. To-dos

Design: Directions 4c, `TodosScreen` in `ui_kits/desktop/screens.js`, `components/notes/BoardColumn.jsx`, `TodoSlip.jsx`, `QuickAdd.jsx`. App: `src/lib/views/Todos.svelte`.

No open gaps; TODO-1 and TODO-2 are closed.

## 9. Settings

Design: Directions 3d, `SettingsWindow` in `ui_kits/desktop/screens.js`, `components/forms/`. App: `src/lib/views/Settings.svelte`.

No open gaps; SET-1 and SET-2 are closed.

## 10. Across the app

Design: `design-system/readme.md` (Motion), `tokens/base.css`. App: `src/app.css`.

No open gaps; LOOK-1 to LOOK-3 are closed. `tokens/base.css` itself isn't imported: its classes aren't used in the app, and its link colours would break links on the page, so the app follows its rules in its own styles instead.

## Accepted differences

These differ from the design on purpose and are not gaps.

- **HOME-12 Day streak:** the design shows "9 day streak" on Home; the app dropped the streak.
- **WIN-4 Brand mark:** the design now has the phoenix app icon (`design-system/assets/brand/`) for the taskbar and favicon, but keeps a "P" square in Young Serif inside the app's bars; the app shows the phoenix in its bars too, one PNG per theme (`static/brand/`, the same images as the design's exports).
- **BAR-1 Ambience per theme:** the design pairs Rain with Daylight, Fireplace with Candlelit and Night rain with Moonlit. The owner keeps ambience a separate choice (Off, Rain, Fireplace, Café, Piano) that plays in any theme (6 October), so there's no Night rain and AT-5's theme bundles stay unbuilt.
- **AT-4 Candlelit particles:** the design keeps decoration off the writing views; the owner wants the sparks drifting over the desk behind the page while writing (5 October). They stay off in Gentle mode and with Windows' reduced motion.

## Not designed yet

The design system doesn't cover these, so they aren't gaps. Each already works in the app and needs a design pass before it can match.

- Outline view (VW-3) and Book view (VW-2).
- Zen layout (ZN-1 to ZN-5). The UI kit only hides the chrome and keeps the floating bar.
- Settings sections other than Appearance: General, Writing & goals, Ambience, Backup & export, Language, and the new Shortcuts list. Backup & export now also holds Export Word, the Word copy and the Word import preview, and General has the example books (add or reset) and the long test book.
- The find and replace bar (ED-8), now with a whole-book mode and a list of matches, and the link field in "All tools".
- Footnotes on the page, the panel for editing one, and the list of notes under the chapter. The design shows only the ¹ button.
- The list of notes that "Link a note" opens.
- Comments beside the page, and turning one into a to-do or a note. The design shows only the Comment button.
- The window buttons (minimise, maximise, close), which follow Windows' own look, and the book target in Settings → Writing & goals.
- The snapshot list and restore (SV-3) on Home, and "Earlier versions" for one chapter (SV-4).
- Starting a project: the template choice and the welcome page.
- Editing a to-do on the board.
- Error states such as "Not saved" or a failed backup. The system has no error colour; the app defines its own `--pv-danger`.
- Home in Candlelit and Moonlit.

## In the app, not in the design

Keep these; most come from `requirements.md`. They need a place in the design.

- The Chapters toggle in the quiet toolbar (CH-7).
- Duplicate, Delete, Part, Goal and "Earlier versions" under the chapter list (CH-3, CH-5, CH-6, SV-4), and drag-to-reorder (CH-4).
- "Notes panel" and "To-dos panel" buttons in "All tools", which switch the chapter panel's two halves, as the toggles in the quiet row do (NT-7).
- "Linked chapters" checkboxes, "Delete note" and "Linked from" on the note card (NT-3, NT-6).
- Other names on the note card ("Also called: …"), under its one-line description. They count as mentions beside the page and in "Appears in", and search and "Link a note" find them.
- The theme menu on the floating bar (the design changes themes only in Settings).
- "Open another project…" in Home's "+ New" menu.
- The interface language switch in Settings → General.

## Needed but not drawn

No screen shows these, but the design depends on them and the app can't do them yet.

- Remove a book from the Home list, or delete a book (follows HOME-1).

## Suggested order

1. **Check WIN-1** in the desktop window: drag, double-click, the three buttons, and resizing from the edges.
2. The P3 items, screen by screen.

## Earlier rounds

Rounds 1a–2b are out of scope. They also sketch a few features that no later round has: one search for chapters and notes, headings listed under each chapter, a synopsis and goal bar on the open chapter, a styles gallery, Paste/Cut/Copy buttons, a ruler, a panel with only the open chapter's notes, and to-do counts on the To-dos button and the Home cards. They are parked, not gaps, until the owner asks for one.
