# Design system gaps

What the app is still missing compared with the design system in `design-system/`. Review date: 2 October 2026.

- **Design source:** the UI kit in `design-system/ui_kits/desktop/`, the components in `design-system/components/`, and rounds 3–4 plus the Home screen (2c) in `design-system/Pensieve Directions.dc.html`. Earlier rounds are superseded and were not used.
- **App:** commit `8d7da8c`, "feat: apply the paper-desk design to the writing app".
- **IDs:** each gap has an ID (HOME-4, TOOL-2, …) so you can ask for it by name. Requirement IDs in brackets (ED-12, VW-4, …) point to `docs/requirements.md`.

**Status:** *Missing*: not in the app. *Partial*: started, not finished. *Placeholder*: the button exists but does something else. *Differs*: works, but not the way the design shows; decide whether to change it.

**Priority:** *P1*: core to daily use, do first. *P2*: a clear, visible gap. *P3*: polish.

## Summary

44 gaps: 5 P1, 14 P2, 25 P3.

Already matching the design:

- Tokens come straight from `design-system/tokens/`, and the fonts are self-hosted as the design readme asks.
- Daylight, Candlelit and Moonlit themes, plus Follow sunset.
- The manuscript page: running head with folio, chapter label, centred title, drop cap, indents, the next sheet underneath, grain, vignette and lamp glow.
- The 34px title bar, the quiet toolbar and the grouped "All tools" row.
- The chapter list with numbers, status dots and word counts.
- The floating bar with today's goal meter.
- Notes as index cards with fields, to-dos, "Appears in" and "Linked notes", and the Notes / To-dos switch.
- The To-dos board with filters, quick add, and chapter and note chips.
- Settings as a window over a scrim, with the Appearance section complete.
- Decor circles only on Home and Settings, the accent focus ring, and reduced motion.

Biggest gaps:

1. Home works for one project only, and that project can't be renamed (HOME-1 to HOME-3).
2. "Continue writing" can open a different chapter than the one its card shows (HOME-4).
3. Backups to the Google Drive folder only happen when you press "Back up now", and the time of the last backup isn't shown (HOME-5).
4. Three "All tools" buttons pretend: Footnote, Comment and Link a note (TOOL-1 to TOOL-3).
5. [[Links]] between notes are plain text (NOTE-1).
6. Icons and motion don't follow the system yet, and Outline and Book still use the old styles (LOOK-1 to LOOK-3).
7. The native Windows title bar sits above the app's own bar (WIN-1).

## 1. Home

Design: Directions 2c, `HomeScreen` in `ui_kits/desktop/screens.js`, `components/home/`. App: `src/lib/views/Dashboard.svelte`, `src/lib/storage/sqlite.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **HOME-1** Several projects (VW-4) | The Projects grid lists every project with a count; each card opens its own book | One project only: the loader takes the oldest project (`ORDER BY created_at LIMIT 1`). The grid always shows one card and a hard-coded "1" | Missing | P1 |
| **HOME-2** New project (CH-8) | "+ New project" beside the heading and a dashed "Start something new" tile | Neither exists; there is no way to start a second project | Missing | P1 |
| **HOME-3** Project title | Each project has a title, shown in the title bar, the running head and its card | Fixed at "Untitled". Nothing in the app renames the project, so every page's running head reads UNTITLED | Missing | P1 |
| **HOME-4** Continue writing | The card shows the last two lines you wrote; the button takes you there | The card shows the most recently edited chapter, but the button only switches to Write and keeps whichever chapter is open (chapter 1 after launch) | Missing | P1 |
| **HOME-5** Drive backup and its status (SV-9) | Header line: "Backed up to Google Drive · 12 min ago" | Backups to the chosen folder only happen on "Back up now". The last backup time isn't stored or shown (requirements §8 asks for the time and success or failure) | Missing | P1 |
| **HOME-6** Home header | Its own 60px header: P mark with the "Pensieve" wordmark, backup line, large language badge, settings. No view tabs, because Home sits above all projects | Home shows the project title bar with the view tabs, none selected | Missing | P2 |
| **HOME-7** Start on Home | The app opens on Home (UI kit default; scenario 1 in requirements) | Opens in Write on chapter 1 | Differs | P2 |
| **HOME-8** Project kind (CH-8) | Each card names its kind (Novel, Kratke zgodbe, Article) in a tone colour | Hard-coded "Book", or "Knjiga" for Slovenian projects | Missing | P2 |
| **HOME-9** Target and progress | "48,930 / 80,000" with a bar for words against a target; "6 of 12 stories · SL"; "1,240 words · Final" | No word target. The bar shows the share of chapters that have any text, and the stats show total words only | Missing | P2 |
| **HOME-10** Greeting | "Good evening." plus a short line about the book: "Ana is still in the kitchen." | The greeting plus your last paragraph, cut at 88 characters, which repeats the line on the Continue card beside it. AI is a non-goal, so use the chapter synopsis or a one-line note you write | Partial | P3 |
| **HOME-11** Place on the card | "Ch. III · p. 47" | "Ch. 3" (no page numbers exist; see PAGE-1) | Partial | P3 |

## 2. Window and title bar

Design: `components/chrome/TitleBar.jsx`, `ViewTabs.jsx`, `components/core/LangBadge.jsx`. App: `src/lib/editor/TitleBar.svelte`, `src-tauri/tauri.conf.json`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **WIN-1** One window bar | The 34px bar is "the single window bar"; nothing sits above it | The native Windows title bar stays (`decorations` isn't turned off), so two bars stack. The app's bar can't drag the window and has no minimise, maximise or close buttons | Missing | P2 |
| **WIN-2** Four view tabs | Write · Outline · Book · Notes. To-dos opens from the Notes / To-dos switch inside Notes | Five tabs: Write · Notes · To-dos · Outline · Book (the switch also exists) | Differs | P3 |
| **WIN-3** Language badge | The project's writing language | Switches only the open chapter between EN and SL | Differs | P3 |

## 3. Toolbar

Design: `components/chrome/Toolbar.jsx` (quiet row and "All tools"), Directions 3a and 3b. App: `src/lib/editor/Ribbon.svelte`, `src/lib/editor/marks.ts`.

TOOL-1 to TOOL-3 look finished but do something else. Until they're built, hide them so the writer doesn't rely on them.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **TOOL-1** Footnote (ED-12) | ¹ adds a footnote | Types a superscript "1": no numbering and no footnote text | Placeholder | P2 |
| **TOOL-2** Comment | Comment tool in the Insert group | Applies the yellow highlight; there is no comment text. Comments aren't in `requirements.md`, so decide whether to build or drop it | Placeholder | P2 |
| **TOOL-3** Link a note (NT-6) | [[ ]] links text to a note; the link shows in accent with an underline and opens the note | Types the characters "[[ ]]" into the chapter. No note picker, nothing clickable | Placeholder | P2 |
| **TOOL-4** New note, Add to-do | One click from the page, in the Pensieve group | Both leave the page for the Notes or To-dos screen. The to-do is filed under "Whole book", not the chapter you're writing | Partial | P2 |
| **TOOL-5** Text colour, highlight (ED-5) | "A" with a colour bar, and a highlight swatch, as in Word | Each applies one fixed colour; you can't pick another | Partial | P3 |
| **TOOL-6** Font and size (ED-5) | Paragraph style, font and size dropdowns in the Text group | Font and size change the whole manuscript (same as Settings → Appearance), not the selected text as in Word | Differs | P3 |
| **TOOL-7** Image, link (ED-12) | Image and Link tools | Both ask for a web address in a browser prompt. Images can't come from the computer and aren't stored in the project | Partial | P3 |
| **TOOL-8** Alignment in the quiet row | One button titled "Alignment" | It only aligns left; centre, right and justify are only in "All tools" | Partial | P3 |

## 4. Chapter list

Design: `components/navigation/ChapterList.jsx`, `ChapterItem.jsx`, `StatusDot.jsx`. App: `src/lib/chapters/Sidebar.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **CHAP-1** Status legend | "Final · Revising · Draft" with dots at the bottom | No legend. The bottom holds Duplicate and Delete links and a "Spell check test" link | Missing | P3 |
| **CHAP-2** Add button | Accent "+" beside the "Chapters" heading | A text button, "New" | Differs | P3 |
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
| **BAR-1** Ambience per theme (AT-3, AT-5) | Rain in Daylight, Fireplace in Candlelit, Night rain in Moonlit | Ambience is a separate setting (Off, Rain, Fire) that ignores the theme. There's no Night rain, and the sounds are generated noise, not recorded loops | Differs | P3 |
| **BAR-2** Icons | Rain or flame icon before the ambience name; moon icon on the Zen button | Text only: "Rain", "Fire", "Quiet", "Zen" | Missing | P3 |
| **BAR-3** Leaving Zen | In Zen the bar stays and its button reads "Exit Zen" | The bar hides in Zen; you leave with Esc or a bar that appears at the top edge (this meets ZN-5). The Zen layout isn't fully designed yet | Differs | P3 |
| **BAR-4** Contents | Ambience · chapter words · today's goal · Zen. Save state and language live in the title bar | Also shows the book total, the language name and the save state | Differs | P3 |

## 7. Notes

Design: Directions 4b, `NotesScreen` in `ui_kits/desktop/screens.js`, `components/notes/NoteCard.jsx`, `NoteLink.jsx`, `TodoItem.jsx`, `components/navigation/AsideList.jsx`. App: `src/lib/views/Notes.svelte`, `src/lib/storage/organize.ts`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **NOTE-1** Links in the text (NT-6) | [[Links]] in a note show in accent with an underline; clicking one opens that note | [[Title]] stays plain text. Links only work from the "Linked notes" column | Missing | P2 |
| **NOTE-2** Chapter on a note's to-do | A note's to-do can name its chapter ("Chapter 4"); on the board it carries a chapter chip and a note chip | To-dos added on a note are always "Whole book", and nothing can change that | Missing | P2 |
| **NOTE-3** Done tick | A done box is sage with a white tick | Sage box, no tick | Partial | P3 |
| **NOTE-4** Search icon | Magnifier at the start of the search field | Plain field | Missing | P3 |
| **NOTE-5** Right-column headings | "Appears in" and "Linked notes" in Young Serif | Small uppercase labels | Differs | P3 |

## 8. To-dos

Design: Directions 4c, `TodosScreen` in `ui_kits/desktop/screens.js`, `components/notes/BoardColumn.jsx`, `TodoSlip.jsx`, `QuickAdd.jsx`. App: `src/lib/views/Todos.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **TODO-1** Column dots | A status dot before "To do", "Doing" and "Done": hollow, accent, sage | No dots | Missing | P3 |
| **TODO-2** "By chapter" list | Only chapters that have to-dos, with "Whole book" last | Every chapter, with "Whole book" first | Differs | P3 |

## 9. Settings

Design: Directions 3d, `SettingsWindow` in `ui_kits/desktop/screens.js`, `components/forms/`. App: `src/lib/views/Settings.svelte`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **SET-1** Shortcuts (ST-4) | A seventh section, "Shortcuts" | No such section, and no shortcut list anywhere | Missing | P3 |
| **SET-2** Theme previews | Each swatch shows a small page with three lines of text; dark themes show the lamp glow | Blank page, no glow | Partial | P3 |

## 10. Across the app

Design: `design-system/readme.md` (Iconography, Motion), `components/core/Icon.jsx`, `tokens/base.css`. App: `src/lib/editor/Icon.svelte`, `src/app.css`.

| Gap | Design | App today | Status | Pri |
|---|---|---|---|---|
| **LOOK-1** Icons | Lucide outline icons at stroke 1.75. The paths are already in `components/core/Icon.jsx`, so no new dependency is needed | Hand-drawn icons, with many missing: sliders (settings), chevrons, image, link, comment, new note, replace, indent, outdent, rain, flame, x, arrow, plus. Tools borrow wrong icons: Image, Comment and New note use the Notes page icon, Link uses the magnifier, Replace uses Redo, Clear formatting uses a bin, indent and outdent are "+" and "–", "All tools" and "Fewer" use ▾ and ▴, Settings closes with "×", and "Continue writing" has no arrow | Partial | P2 |
| **LOOK-2** Motion and pressed states (AT-1) | 120ms colour fades on hover and press; 180ms lifts and toggles on `cubic-bezier(.2,.7,.2,1)`; 400ms theme change; solid buttons brighten on hover and darken on press (`tokens/base.css`) | `base.css` isn't imported and nothing replaces it. Hovers switch instantly, cards and slips jump when lifted, toggles snap, theme changes flash, and most buttons have no pressed state | Missing | P2 |
| **LOOK-3** Old styles left over | Every surface uses the `--pv-*` tokens: chrome colours on chrome, ink colours on paper | Outline, Book, the find bar, the Zen top bar, the chapter Duplicate and Delete links and "Opening…" still use the old variables (`--muted`, `--ink`, `--desk`) and 6px corners. On Outline cards this puts chrome text on paper, which is light on light and hard to read in Candlelit and Moonlit | Partial | P2 |

## Not designed yet

The design system doesn't cover these, so they aren't gaps. Each already works in the app and needs a design pass before it can match.

- Outline view (VW-3) and Book view (VW-2).
- Zen layout (ZN-1 to ZN-5). The UI kit only hides the chrome and keeps the floating bar.
- Settings sections other than Appearance: General, Writing & goals, Ambience, Backup & export, Language.
- The Notes and To-dos panel beside the page (NT-7), listed as "Try next" in round 4.
- The find and replace bar (ED-8).
- The snapshot list and restore (SV-3), now at the bottom of Home.
- Error states such as "Not saved" or a failed backup. The system has no error colour; the app defines its own `--danger`.
- Home in Candlelit and Moonlit.

## In the app, not in the design

Keep these; most come from `requirements.md`. They need a place in the design.

- The Chapters toggle in the quiet toolbar (CH-7).
- Duplicate and Delete under the chapter list (CH-3), and drag-to-reorder (CH-4).
- EN / SL and "Sel EN" / "Sel SL" language buttons in "All tools" (ED-13).
- "Notes panel" and "To-dos panel" buttons in "All tools" (NT-7).
- "Linked chapters" checkboxes and "Delete note" on the note card (NT-3).
- Drifting particles in Candlelit (AT-4). The design keeps decoration off the writing views, so decide whether they stay.

## Needed but not drawn

No screen shows these, but the design depends on them and the app can't do them yet.

- Edit or delete a to-do: rename it, change its chapter or note, or remove it. Today a to-do can only be added and moved between columns.
- Rename, delete and switch projects (follows HOME-1 to HOME-3).

## Small fixes noticed during the review

- Remove the "Spell check test" link from the chapter list; it's the Phase 0 spike.
- Delete `src/lib/editor/Toolbar.svelte`; nothing imports it since `Ribbon.svelte` replaced it.
- `src-tauri/src/backup.rs` writes backup files directly instead of writing a temp file and renaming it (SV-2).

## Suggested order

1. **Projects:** HOME-1, HOME-2, HOME-3, then HOME-7, HOME-6, HOME-8 and HOME-9. `AGENTS.md` keeps one SQLite file per project, so this needs a small index of project files.
2. **Safety and trust:** HOME-5 and HOME-4, and hide TOOL-1 to TOOL-3 until they're real.
3. **Links:** NOTE-1 and TOOL-3 can share one [[link]] mark for notes and the manuscript; then NOTE-2 and TOOL-4.
4. **Look:** LOOK-1, LOOK-2, LOOK-3 and WIN-1.
5. The P3 items, screen by screen.
