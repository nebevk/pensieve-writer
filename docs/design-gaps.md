# Design system gaps

What the app is still missing compared with the design system in `design-system/`. First review 2 October 2026; rechecked 2 and 5 October.

- **Design source:** the UI kit in `design-system/ui_kits/desktop/`, the components in `design-system/components/`, and rounds 3–4 in `design-system/Pensieve Directions.dc.html`, plus the Home screen from 2c, which the readme and the UI kit adopt. Rounds 1a–2b are superseded and out of scope (confirmed by the owner on 5 October); see "Earlier rounds" at the end.
- **App:** commit `22d85eb`, "feat: keep the manuscript safe and finish the writing tools", plus the work of 5 October: starting on Home, the Slovenian interface, recorded ambience, footnotes, note links, chapters on note to-dos, and the design's icons. The Word work and example books don't change any designed screen.
- **IDs:** each gap has an ID (HOME-4, TOOL-2, …) so you can ask for it by name. IDs stay fixed; closed gaps move to "Closed" rather than being renumbered. Requirement IDs in brackets (ED-12, VW-4, …) point to `docs/requirements.md`.
- **Not design:** data-safety findings and other suggestions are in `docs/improvements.md`.

**Status:** *Missing*: not in the app. *Partial*: started, not finished. *Differs*: works, but not the way the design shows; decide whether to change it.

**Priority:** *P1*: core to daily use, do first. *P2*: a clear, visible gap. *P3*: polish.

## Summary

24 open gaps: no P1, 6 P2, 18 P3. Since the first review, 20 gaps and 2 small fixes are closed, the Comment placeholder is hidden, and 2 differences were accepted.

Already matching the design:

- Tokens come straight from `design-system/tokens/`, and the fonts are self-hosted as the design readme asks.
- Daylight, Candlelit and Moonlit themes, plus Follow sunset.
- The manuscript page: running head with folio, chapter label, centred title, drop cap, indents, the next sheet underneath, grain, vignette and lamp glow.
- The 34px title bar, the quiet toolbar and the grouped "All tools" row, including Footnote and "Link a note".
- The design's Lucide icons.
- The chapter list with numbers, status dots, word counts and the accent "+".
- The floating bar with its ambience and Zen icons and today's goal meter.
- Notes as index cards with fields, [[links]], to-dos tied to chapters, "Appears in" and "Linked notes", and the Notes / To-dos switch.
- The To-dos board with column dots, filters, quick add, and chapter and note chips.
- Home's project list, backup line, "Start something new" tile and "Continue writing" card.
- Settings as a window over a scrim, with Appearance and Shortcuts.
- Decor circles only on Home and Settings, the accent focus ring, and reduced motion.

Biggest open gaps:

1. Motion and pressed states don't follow the system, and Outline and Book still use the old styles (LOOK-2, LOOK-3).
2. The native Windows title bar sits above the app's own bar (WIN-1).
3. Home still opens under the project title bar instead of its own header (HOME-6).
4. Home cards don't show progress against a target, and other books' cards don't name their kind (HOME-8, HOME-9).

## Closed

| ID | What changed | Checked |
|---|---|---|
| HOME-1 Several projects | Home lists the open book and every other book you've opened, with a count; each card opens its book. A book whose file is gone shows an error instead of opening empty | 5 Oct |
| HOME-2 New project | A "Start something new" tile and button, with a choice of Novel, Short stories or Article. The new book gets its own file in a folder you pick, outside the backup folder, and opens on a welcome page | 5 Oct |
| HOME-3 Project title | Click the title on the Home card to rename the book; the new title is saved with the project | 2 Oct |
| HOME-4 Continue writing | "Continue writing" and the card open the chapter the card shows | 2 Oct |
| HOME-5 Drive backup and its status | Backs up to the Drive folder every hour while the app is open and again when it closes. Home shows "Backed up · 12 min ago", "No backup yet" or "Last backup failed" | 5 Oct |
| HOME-7 Start on Home | The app opens on Home; "Continue writing" opens the chapter you worked on last | 5 Oct |
| TOOL-1 Footnote (ED-12) | ¹ in "All tools" adds a numbered footnote at the cursor; click one to edit or delete it in a small panel. The notes are listed under the chapter and in Book view. Word gets real footnotes, HTML, Markdown and plain text get numbered notes, and Word footnotes come back on import | 5 Oct |
| TOOL-3 Link a note (NT-6) | "[[ ]]" in "All tools" opens a list of notes: pick one to link the selected words to it, or, with nothing selected, to add its title as a link. The list also removes a link. Linked words show in accent with an underline, and clicking one opens the note beside the page | 5 Oct |
| TOOL-4 New note, Add to-do | Both open the panel beside the page instead of leaving it, and a to-do added there is filed under the open chapter | 2 Oct |
| TOOL-7 Image, link | Image opens a file picker and stores the picture in the chapter; Link uses a small field in the toolbar instead of a browser prompt | 2 Oct |
| CHAP-2 Add button | An accent "+" beside the "Chapters" heading | 5 Oct |
| BAR-2 Icons | Rain and flame icons before the ambience name, and a moon on Zen. Café and Piano have no icon because the design has neither sound. The bar now says "Fireplace", as Settings does | 5 Oct |
| NOTE-1 Links in the text (NT-6) | [[Title]] in a note shows in accent with an underline; clicking it opens that note, or starts a new note with that title. The brackets stay, faint, because note text is edited as written. "Appears in" also counts words linked to the note | 5 Oct |
| NOTE-2 Chapter on a note's to-do | The add field on a note has a chapter list, set to the open chapter, and each to-do shows its chapter under it | 5 Oct |
| NOTE-3 Done tick | A done box is sage with a white tick | 5 Oct |
| NOTE-4 Search icon | The search field starts with a magnifier | 5 Oct |
| TODO-1 Column dots | Hollow, accent and sage dots before To do, Doing and Done | 5 Oct |
| TODO-2 "By chapter" list | Lists only the chapters that have open to-dos, with "Whole book" last | 5 Oct |
| SET-1 Shortcuts | Settings → Shortcuts lists the keys, and Ctrl+/ opens it | 5 Oct |
| LOOK-1 Icons | The toolbar, title bar, floating bar, chapter list, Notes, Settings and Home use the design's Lucide icons, copied from `components/core/Icon.jsx`, so no dependency was added. Icons the design doesn't draw, such as the Chapters toggle and the panel buttons, stay hand-drawn at a matching weight | 5 Oct |
| Small fix | The "Spell check test" link is gone from the chapter list | 2 Oct |
| Small fix | The unused `Toolbar.svelte` is deleted | 2 Oct |

TOOL-2 (Comment) was a placeholder; it's hidden now, so it no longer misleads. It stays below as Missing because the design includes it.

## 1. Home

Design: Directions 2c, `HomeScreen` in `ui_kits/desktop/screens.js`, `components/home/`. App: `src/lib/views/Dashboard.svelte`, `src/routes/+page.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **HOME-6** Home header | Its own 60px header: P mark with the "Pensieve" wordmark, backup line, large language badge, settings. No view tabs, because Home sits above all projects | Home shows the project title bar with the view tabs, none selected; the backup line sits under the date | Missing | P2 |
| **HOME-8** Project kind (CH-8) | Each card names its kind (Novel, Kratke zgodbe, Article) in a tone colour: accent for a novel, sage for stories, muted for an article | The open book's card names its kind in the book's language, always in the accent colour. Other books' cards still say "Book", because the app keeps only their title and file | Partial | P2 |
| **HOME-9** Target and progress | "48,930 / 80,000" with a bar for words against a target; "6 of 12 stories · SL"; "1,240 words · Final" | No book target. Chapters now have word goals, which could add up to one, but the bar still shows the share of chapters that have any text | Missing | P2 |
| **HOME-10** Greeting | "Good evening." plus a short line about the book: "Ana is still in the kitchen." | "Good evening." followed by a short King James Bible verse instead of a line about the book. If that's deliberate, it can move to Accepted differences | Differs | P3 |
| **HOME-11** Place on the card | "Ch. III · p. 47" | "Ch. 3" (no page numbers exist; see PAGE-1) | Partial | P3 |

## 2. Window and title bar

Design: `components/chrome/TitleBar.jsx`, `ViewTabs.jsx`, `components/core/LangBadge.jsx`. App: `src/lib/editor/TitleBar.svelte`, `src-tauri/tauri.conf.json`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **WIN-1** One window bar | The 34px bar is "the single window bar"; nothing sits above it | The native Windows title bar stays (`decorations` isn't turned off), so two bars stack. The app's bar can't drag the window and has no minimise, maximise or close buttons | Missing | P2 |
| **WIN-2** Four view tabs | Write · Outline · Book · Notes. To-dos opens from the Notes / To-dos switch inside Notes | Five tabs: Write · Notes · To-dos · Outline · Book (the switch also exists) | Differs | P3 |
| **WIN-3** Language badge | The project's writing language | Marks the selected text as EN or SL, or the open chapter when nothing is selected; the project language is only in Settings | Differs | P3 |

## 3. Toolbar

Design: `components/chrome/Toolbar.jsx` (quiet row and "All tools"), Directions 3a and 3b. App: `src/lib/editor/Ribbon.svelte`, `src/lib/editor/marks.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **TOOL-2** Comment | Comment tool in the Insert group | No comment tool (the placeholder is hidden). Comments aren't in `requirements.md`, so decide whether to build it or leave it out | Missing | P3 |
| **TOOL-5** Text colour, highlight (ED-5) | "A" with a colour bar, and a highlight swatch, as in Word | Each applies one fixed colour; you can't pick another | Partial | P3 |
| **TOOL-6** Font and size (ED-5) | Paragraph style, font and size dropdowns in the Text group | Font and size change the whole manuscript (same as Settings → Appearance), not the selected text as in Word | Differs | P3 |
| **TOOL-8** Alignment in the quiet row | One button titled "Alignment" | It only aligns left; centre, right and justify are only in "All tools" | Partial | P3 |

## 4. Chapter list

Design: `components/navigation/ChapterList.jsx`, `ChapterItem.jsx`, `StatusDot.jsx`. App: `src/lib/chapters/Sidebar.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **CHAP-1** Status legend | "Final · Revising · Draft" with dots at the bottom | No legend; the bottom now holds Duplicate, Delete, Part, Goal and "Earlier versions" | Missing | P3 |
| **CHAP-3** Untitled chapters | A chapter without a title shows "Untitled" in faint italics | Saves the word "Untitled" as the title and shows it like any other | Partial | P3 |
| **CHAP-4** Status names (CH-6) | Final, Revising, Draft, plus a hollow dot for empty chapters | Final, Revised, Draft (requirement CH-6 also says "revised") | Differs | P3 |

## 5. Page and desk

Design: `components/manuscript/Sheet.jsx`, `Paragraph.jsx`, `Desk.jsx`. App: `src/routes/+page.svelte`, `src/lib/editor/Editor.svelte`, `src/lib/views/Notes.svelte`, `src/lib/views/Todos.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **PAGE-1** Page numbers | The setting is "Running head and page numbers"; Home shows "p. 47" | The running head shows the chapter numeral. Each chapter is one long sheet, so there are no page numbers anywhere | Partial | P3 |
| **PAGE-2** Lamp glow behind notes and the board | The same desk, with its glow in Candlelit and Moonlit, sits behind the page, the note card and the to-do board | Only the writing desk has the glow | Partial | P3 |

## 6. Floating bar

Design: `components/chrome/FloatingBar.jsx`, Directions 3a, 3c and 4a. App: `src/lib/editor/StatusBar.svelte`, `src/lib/ambience.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **BAR-1** Ambience per theme (AT-3, AT-5) | Rain in Daylight, Fireplace in Candlelit, Night rain in Moonlit | Ambience is a separate setting (Off, Rain, Fireplace, Café, Piano) that ignores the theme, and there's no Night rain. All four are now real recordings | Differs | P3 |
| **BAR-3** Leaving Zen | In Zen the bar stays and its button reads "Exit Zen" | The bar hides in Zen; you leave with Esc or a bar that appears at the top edge (this meets ZN-5). The Zen layout isn't fully designed yet | Differs | P3 |
| **BAR-4** Contents | Ambience · chapter words · today's goal · Zen. Save state and language live in the title bar | Also shows a theme menu, the book total, the language name and the save state | Differs | P3 |

## 7. Notes

Design: Directions 4b, `NotesScreen` in `ui_kits/desktop/screens.js`, `components/notes/NoteCard.jsx`, `NoteLink.jsx`, `TodoItem.jsx`, `components/navigation/AsideList.jsx`. App: `src/lib/views/Notes.svelte`, `src/lib/storage/organize.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **NOTE-5** Right-column headings | "Appears in" and "Linked notes" in Young Serif | Small uppercase labels | Differs | P3 |

## 8. To-dos

Design: Directions 4c, `TodosScreen` in `ui_kits/desktop/screens.js`, `components/notes/BoardColumn.jsx`, `TodoSlip.jsx`, `QuickAdd.jsx`. App: `src/lib/views/Todos.svelte`.

No open gaps; TODO-1 and TODO-2 are closed.

## 9. Settings

Design: Directions 3d, `SettingsWindow` in `ui_kits/desktop/screens.js`, `components/forms/`. App: `src/lib/views/Settings.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **SET-2** Theme previews | Each swatch shows a small page with three lines of text; dark themes show the lamp glow | Blank page, no glow | Partial | P3 |

## 10. Across the app

Design: `design-system/readme.md` (Motion), `tokens/base.css`. App: `src/app.css`, `src/lib/views/Outline.svelte`, `src/lib/views/Book.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **LOOK-2** Motion and pressed states (AT-1) | 120ms colour fades on hover and press; 180ms lifts and toggles on `cubic-bezier(.2,.7,.2,1)`; 400ms theme change; solid buttons brighten on hover and darken on press (`tokens/base.css`) | `base.css` isn't imported and nothing replaces it. Hovers switch instantly, cards and slips jump when lifted, toggles snap, theme changes flash, and most buttons have no pressed state | Missing | P2 |
| **LOOK-3** Old styles left over | Every surface uses the `--pv-*` tokens: chrome colours on chrome, ink colours on paper | Outline, Book, the find bar, the Zen top bar, and the controls under the chapter list still use the old variables (`--muted`, `--ink`, `--desk`) and 6px corners. On Outline cards this puts chrome text on paper, which is light on light and hard to read in Candlelit and Moonlit | Partial | P2 |

## Accepted differences

These differ from the design on purpose and are not gaps.

- **HOME-12 Day streak:** the design shows "9 day streak" on Home; the app dropped the streak.
- **WIN-4 Brand mark:** the design uses a "P" set in Young Serif and has no logo file; the app uses a PNG logo for each theme (`static/brand/`).

## Not designed yet

The design system doesn't cover these, so they aren't gaps. Each already works in the app and needs a design pass before it can match.

- Outline view (VW-3) and Book view (VW-2).
- Zen layout (ZN-1 to ZN-5). The UI kit only hides the chrome and keeps the floating bar.
- Settings sections other than Appearance: General, Writing & goals, Ambience, Backup & export, Language, and the new Shortcuts list. Backup & export now also holds Export Word, the Word copy and the Word import preview, and General has "Add example books".
- The Notes and To-dos panel beside the page (NT-7), listed as "Try next" in round 4.
- The find and replace bar (ED-8), now with a whole-book mode and a list of matches, and the link field in "All tools".
- Footnotes on the page, the panel for editing one, and the list of notes under the chapter. The design shows only the ¹ button.
- The list of notes that "Link a note" opens.
- The snapshot list and restore (SV-3) on Home, and "Earlier versions" for one chapter (SV-4).
- Starting a project: the template choice and the welcome page.
- Editing a to-do on the board.
- Error states such as "Not saved" or a failed backup. The system has no error colour; the app defines its own `--danger`.
- Home in Candlelit and Moonlit.

## In the app, not in the design

Keep these; most come from `requirements.md`. They need a place in the design.

- The Chapters toggle in the quiet toolbar (CH-7).
- Duplicate, Delete, Part, Goal and "Earlier versions" under the chapter list (CH-3, CH-5, CH-6, SV-4), and drag-to-reorder (CH-4).
- "Notes panel" and "To-dos panel" buttons in "All tools" (NT-7).
- "Linked chapters" checkboxes, "Delete note" and "Linked from" on the note card (NT-3, NT-6).
- The theme menu on the floating bar (the design changes themes only in Settings).
- "Open another project…" on Home.
- The interface language switch in Settings → General.
- Drifting particles in Candlelit (AT-4). The design keeps decoration off the writing views, so decide whether they stay.

## Needed but not drawn

No screen shows these, but the design depends on them and the app can't do them yet.

- Remove a book from the Home list, or delete a book (follows HOME-1).

## Suggested order

1. **Projects:** HOME-6, HOME-8 and HOME-9. Other books' cards show only their title so far, so HOME-8 and HOME-9 apply to them too.
2. **Look:** LOOK-2, LOOK-3 and WIN-1.
3. The P3 items, screen by screen.

## Earlier rounds

Rounds 1a–2b are out of scope. They also sketch a few features that no later round has: one search for chapters and notes, headings listed under each chapter, a synopsis and goal bar on the open chapter, a styles gallery, Paste/Cut/Copy buttons, a ruler, a panel with only the open chapter's notes, and to-do counts on the To-dos button and the Home cards. They are parked, not gaps, until the owner asks for one.
