# Design system gaps

What the app is still missing compared with the design system in `design-system/`. First review 2 October 2026; rechecked 2, 5 and 6 October.

- **Design source:** the UI kit in `design-system/ui_kits/desktop/`, the components in `design-system/components/`, and rounds 3–6 of `Pensieve Directions.dc.html` (5a/5b: Write with the chapter panel; 6a/6b: the revamped Home). The owner updated the UI kit and components on 5 October; the Directions canvas in the repo is still the 2 October copy, so rounds 5 and 6 were read from the kit and components. Rounds 1a–2b are superseded and out of scope (confirmed by the owner on 5 October); see "Earlier rounds" at the end.
- **App:** commit `22d85eb`, "feat: keep the manuscript safe and finish the writing tools", plus the work of 5 October: starting on Home, the Slovenian interface, recorded ambience, footnotes, note links, chapters on note to-dos, the design's icons, comments, the app's own window bar, the design's colours and motion everywhere, the chapter panel (round 5) and the revamped Home (round 6); and of 6 October: the P3 polish below, other names for notes, a faster start, the owner's decisions on the greeting, the view tabs, "Revising" and ambience, Home on the light background, no daily goals, snapshots only in Write, and later that day a calmer chapter panel, chapters made from headings on a plain page, wider pages, a Zen like Grammarly's, and greetings for Eva; and that evening Slovenian from the start, a simple daily goal beside the page, a hide button on both side lists, slim scrollbars, and closer lines at 12 pt. The Word work, the example books and the long test book don't change any designed screen.
- **IDs:** each gap has an ID (HOME-4, TOOL-2, …) so you can ask for it by name. IDs stay fixed; closed gaps move to "Closed" rather than being renumbered. Requirement IDs in brackets (ED-12, VW-4, …) point to `docs/requirements.md`.
- **Not design:** data-safety findings and other suggestions are in `docs/improvements.md`.

**Status:** *Missing*: not in the app. *Partial*: started, not finished. *Differs*: works, but not the way the design shows; decide whether to change it.

**Priority:** *P1*: core to daily use, do first. *P2*: a clear, visible gap. *P3*: polish.

## Summary

7 open gaps: no P1, 1 P2, 6 P3. Since the first review, 39 gaps and 2 small fixes are closed, and 8 differences were accepted. The owner settled HOME-10, WIN-2, CHAP-4 and BAR-1 on 6 October, dropped daily goals, and that evening brought a simple one back beside the page.

Already matching the design:

- Tokens come straight from `design-system/tokens/`, and the fonts are self-hosted as the design readme asks.
- Daylight, Candlelit and Moonlit themes, plus Follow sunset (called Day and night since 7 October), and a Sunset theme of the app's own.
- The next sheet under the manuscript page, grain, vignette and lamp glow. The owner took the page's running head, chapter label, title, drop cap and first-line indents off it (see Accepted differences).
- The 34px title bar as the only window bar, with the design's four view tabs, the quiet toolbar and the grouped "All tools" row, including Footnote, Comment and "Link a note".
- The design's Lucide icons.
- The chapter list with numbers, status dots and their legend, word counts, untitled chapters in faint italics, and the accent "+".
- The floating bar with its ambience and Zen icons.
- Notes as index cards with fields, [[links]], to-dos tied to chapters, "Appears in" and "Linked notes", and the Notes / To-dos switch.
- The To-dos board with column dots, filters, quick add, and chapter and note chips.
- Home on the design's light background, with its own header, the greeting that names the chapter you'll continue, project rows with their writings and words, "Start something new" tile and "Continue writing" card.
- Settings as a window over a scrim, with Appearance (its theme swatches show a page and the lamp glow) and Shortcuts.
- The lamp glow on the desk behind the page, the note card and the to-do board.
- Decor circles only on Home and Settings, the accent focus ring, the design's motion and pressed states, and reduced motion.
- Every surface on the `--pv-*` tokens: ink colours on paper, chrome colours on chrome.

Biggest open gap: the app's own window bar (WIN-1) is built but not yet checked in the desktop window. Everything else open is P3 polish.

## Closed

| ID | What changed | Checked |
|---|---|---|
| HOME-1 Several projects | Home lists the open book and every other book you've opened, with a count; each card opens its book. A book whose file is gone shows an error instead of opening empty | 5 Oct |
| HOME-2 New project | A "Start something new" tile and button. Since 7 October it opens the library in Write with a name to type: the new project gets its own folder in the library folder and opens on its first writing | 5 Oct |
| HOME-3 Project title | Click the title on the Home card to rename the book; the new title is saved with the project | 2 Oct |
| HOME-4 Continue writing | "Continue writing" and the card open what was open last: the project, the writing and the chapter (7 October) | 2 Oct |
| HOME-5 Drive backup and its status | Backs up to the Drive folder every hour while the app is open and again when it closes. Home shows "Backed up · 12 min ago", "No backup yet" or "Last backup failed" | 5 Oct |
| HOME-6 Home header | Home has its own 60px header: the logo with the Pensieve name, the backup line, a large language badge (it switches the interface language, which new books also start in), settings, and the window buttons. The project title bar and its view tabs are gone from Home | 5 Oct |
| HOME-7 Start on Home | The app opens on Home; "Continue writing" opens the chapter you worked on last | 5 Oct |
| HOME-8 Project kind (CH-8) | Kinds went on 7 October (owner): a row says how many writings a project holds and their words | 5 Oct |
| HOME-13 Revamped Home (round 6) | Home follows rounds 6a/6b: a theme switch in the header; the date with the time; words today and words in the book; the open book's chapters as status bars that open each chapter; the Continue card with a Zen button and "Rain plays when you start · Change"; then Open to-dos (tick them here), Recent notes, and Projects as rows with a tiny title page, language and progress. "+ New" offers a new project and "Open another project…" (the three kinds went on 7 October). The book's title in the chapter strip renames it | 5 Oct |
| HOME-14 Home background | Home sits on the light chrome colour, as the design's Home does, instead of the darker desk colour that belongs behind the page. Found by the owner | 6 Oct |
| HOME-10 Greeting | As designed, the greeting names the chapter Continue opens, and Eva, whose app it is: "Good evening, Eva. The Attic is waiting.", and from 23:00 to 5:00 "Late again, Eva." An untitled chapter goes by its number ("Chapter 5 is waiting."), and a new book's welcome page gets the greeting alone. In Slovenian: "Dober večer, Eva. »Podstrešje« čaka." A short King James verse sits under it, for Eva, as before | 6 Oct |
| HOME-9 Target and progress | The writing on Home shows its words against its target (Settings → Writing & goals) or its chapter goals added up. Since 7 October a project row shows its writings and words, and its bar a project of one writing's progress | 5 Oct |
| WIN-2 Four view tabs | Write · Outline · Book · Notes, as designed. To-dos open from the Notes / To-dos switch, which keeps Notes lit, from Open to-dos on Home, and beside the page | 6 Oct |
| TOOL-1 Footnote (ED-12) | ¹ in "All tools" adds a numbered footnote at the cursor; click one to edit or delete it in a small panel. The notes are listed under the chapter and in Book view. Word gets real footnotes, HTML, Markdown and plain text get numbered notes, and Word footnotes come back on import | 5 Oct |
| TOOL-2 Comment (ED-14) | Select words and use Comment in "All tools" or Ctrl+Alt+M, as in Word. The comment is a slip in the margin beside its words, which are tinted; the open one shows To-do and Note. To-do makes a to-do for the chapter; Note makes a note tied to the chapter and links the words to it. Comments go to Word as real comments and come back on import | 5 Oct |
| TOOL-3 Link a note (NT-6) | "[[ ]]" in "All tools" opens a list of notes: pick one to link the selected words to it, or, with nothing selected, to add its title as a link. The list also removes a link. Linked words show in accent with an underline, and clicking one opens the note beside the page | 5 Oct |
| TOOL-4 New note, Add to-do | Add to-do opens the chapter panel's add field. New note opens the Notes view with a note tied to the chapter you were writing, as the panel shows notes but doesn't edit them | 5 Oct |
| PANEL-1 Chapter panel (NT-7, round 5) | A 300px panel beside the page, opened with the To-dos and Notes toggles in the toolbar (with counts): the chapter's to-dos (tick, add; "From note · …" when one came from a note) and the notes it mentions, most mentioned first. A character counts by first name, so Ana Novak counts every "Ana". The top note is open, with its fields and first paragraph; clicking a linked name in the text opens its note there; "Open in Notes →" goes to the full note. It replaces the old Notes and To-dos dock. Made calmer on 6 October, when no note is open until it is clicked (see Accepted differences) | 5 Oct |
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
| TODO-2 "By chapter" list | Lists only the chapters that have open to-dos, with "Whole project" last | 5 Oct |
| BAR-3 Leaving Zen | Zen keeps a quiet bar at the bottom with "Leave zen", and Esc still leaves (ZN-5). Following the owner's Grammarly example, the bar holds bold, italic, underline, Heading 2 and 3, lists, the word count and the column width | 6 Oct |
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
| **PAGE-1** Page numbers | The setting is "Running head and page numbers"; Home shows "p. 47" | The page has no running head any more (see Accepted differences), and each chapter is one long sheet, so only Word has page numbers | Partial | P3 |

## 6. Floating bar

Design: `components/chrome/FloatingBar.jsx`, Directions 3a, 3c and 4a. App: `src/lib/editor/StatusBar.svelte`, `src/lib/ambience.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **BAR-4** Contents | Ambience · chapter words · today's goal · Zen. Save state and language live in the title bar | Today's words without a goal (daily goals are gone, see Accepted differences), and also a theme menu, the book total, the language name and the save state | Differs | P3 |

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
- **Daily goal (ST-3):** the design's floating bar has a meter for today's goal. The owner dropped daily goals on 6 October, and that evening asked for a simple one beside the page instead: a Goals list in the panel, next to To-dos and Notes, with the words written today toward the day's goal and the chapter's words toward its own. The bar and Home show only the words written today.
- **WIN-4 Brand mark:** the design now has the phoenix app icon (`design-system/assets/brand/`) for the taskbar and favicon, but keeps a "P" square in Young Serif inside the app's bars; the app shows the phoenix in its bars too, one PNG per theme (`static/brand/`, the same images as the design's exports).
- **BAR-1 Ambience per theme:** the design pairs Rain with Daylight, Fireplace with Candlelit and Night rain with Moonlit. The owner keeps ambience a separate choice (Off, Rain, Fireplace, Café, Piano) that plays in any theme (6 October), so there's no Night rain and AT-5's theme bundles stay unbuilt.
- **A plain page (6 October):** the design's manuscript page has a running head with folio, a chapter label, a centred title and a drop cap. The owner wants only the text on the paper: a chapter's title is the page's first line, a Heading 2, a Heading 2 further down starts a new chapter, and a part's name is a Heading 1 above the title. The two lines hold plain text, a heading starts its chapter once it is named, and an article's headings never split it. Word files follow the page: part Heading 1, chapter Heading 2, subheading Heading 3, with no labels or drop caps.
- **Wider pages (6 October):** the design's sheets are 520, 600 and 720px. The owner found them too narrow for everyday writing, so the page grows with the room it has: Book 760–960px, Narrow 600–760px, Wide 860–1160px, with narrower margins on a smaller page.
- **PANEL-1, one list at a time (6 October):** round 5 stacks the chapter's to-dos and notes, with the top note open as a card. The owner found it crowded, so the panel shows To-dos, Notes or (since that evening) Goals, switched with the toolbar buttons, and notes are plain lines that unfold in place.
- **Closer lines, no indents (6 October):** the design sets the manuscript at 16.5px with lines 1.85 apart and indents each paragraph after the first, as a printed book does. The owner found the paragraphs odd while writing and asked for closer lines and 12-point text, so the page is 12 pt (16px), lines are 1.5 apart, and paragraphs are flush left with a little space between them, as in Word and Grammarly. Text sizes are given in points, as Word gives them, and Word files are spaced the same way.
- **Hide buttons on both side lists (6 October):** the design opens and closes the chapter list and the panel from the toolbar only. The owner asked for a button on each: both have one in their top corner, and a hidden chapter list leaves a small tab at the desk's left edge to bring it back.
- **Slim scrollbars (6 October):** the design doesn't draw scrollbars, so Windows' grey ones showed. They are slim and rounded now, in the theme's text colour, with no track or arrows.
- **A Sunset theme (7 October):** the design has three looks and "Follow sunset", which only switches Daylight to Candlelit after dark. The owner asked for an actual sunset look, so the app adds Sunset (a light, golden-hour palette: peach chrome, an apricot desk, warm paper, a coral accent) between Daylight and Candlelit, and calls the switch "Day and night" ("Dan in noč"), so the two can't be taken for each other. Its colours live in `src/app.css`, not in the design system's tokens.
- **The library's +, in words (7 October):** three icons for a new writing, a new project and opening one couldn't be told apart (the owner asked which was which), so the library's head has one + with a menu that says it: New writing, New project, New folder, Open another project.
- **AT-4 Candlelit particles:** the design keeps decoration off the writing views; the owner wants the sparks drifting over the desk behind the page while writing (5 October). They stay off in Gentle mode and with Windows' reduced motion.

## Not designed yet

The design system doesn't cover these, so they aren't gaps. Each already works in the app and needs a design pass before it can match.

- The library beside the page (7 October): a second tab of the chapter list, drawn like VS Code's file explorer at the owner's wish: the library folder's projects, the open project's writing folders, writings, parts and chapters, its Notes and To-dos, with right-click menus, and folders, projects, writings and notes renamed and dragged as in Explorer. A one-page writing shows only the Library tab. Home is to be redone around projects later (owner).

- Outline view (VW-3) and Book view (VW-2).
- Zen layout (ZN-1 to ZN-5). The UI kit only hides the chrome and keeps the floating bar; on 6 October the owner asked for Grammarly's plain page instead: the paper's colour from edge to edge, a centred column, no sparks, and a quiet bar at the bottom.
- Settings sections other than Appearance: General, Writing & goals, Ambience, Backup & export, Language, and the new Shortcuts list. Backup & export now also holds Export Word, the Word copy and the Word import preview, and General has the example books (add or reset) and the long test book.
- The find and replace bar (ED-8), now with a whole-book mode and a list of matches, and the link field in "All tools".
- Footnotes on the page, the panel for editing one, and the list of notes under the chapter. The design shows only the ¹ button.
- The list of notes that "Link a note" opens.
- Comments beside the page, and turning one into a to-do or a note. The design shows only the Comment button.
- The window buttons (minimise, maximise, close), which follow Windows' own look, and the book target in Settings → Writing & goals.
- Snapshots and restoring (SV-3, SV-4): one "Earlier versions" panel in Write lists the book's snapshots and restores the open chapter or the whole book. Home stopped listing them on 6 October.
- Starting a project: the template choice and the welcome page.
- Editing a to-do on the board.
- Error states such as "Not saved" or a failed backup. The system has no error colour; the app defines its own `--pv-danger`.
- Home in Candlelit and Moonlit.

## In the app, not in the design

Keep these; most come from `requirements.md`. They need a place in the design.

- The Chapters toggle in the quiet toolbar (CH-7).
- Duplicate, "Earlier versions" and Delete under the chapter list (CH-3, CH-5, SV-4), and drag-to-reorder (CH-4). A part begins at a Heading 1 on the page, and the chapter's word goal is in the Goals list beside it (CH-6).
- "Notes panel" and "To-dos panel" buttons in "All tools", which switch the chapter panel between its two lists, as the toggles in the quiet row do (NT-7).
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
