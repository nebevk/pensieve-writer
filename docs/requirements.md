# Pensieve requirements

**What:** a cozy, minimal desktop writing app for one writer, Eva, the owner's wife.
**Platform:** Windows 10 or newer (Tauri).
**Status:** in daily use; installed copies update from GitHub Releases ([releasing.md](releasing.md)).
**Last reviewed:** 12 October 2026.

Open work (design gaps, improvements, checks still to do by hand) is in [backlog.md](backlog.md). How the
app is built and run is in [SETUP.md](SETUP.md).

## 1. Purpose

A calm place to write and finish long texts (novels, story collections, non-fiction) and short ones (blog
posts, articles), in English and Slovenian. Editing feels as familiar as Microsoft Word, with far fewer
features. It borrows the best organising ideas of Scrivener and Atticus (chapters, notes, a whole-book
view) without their complexity. It is for personal use and is not distributed.

## 2. Goals and non-goals

**Goals**

- Familiar to a Word user: the toolbar, the shortcuts, how text behaves.
- Never lose her work: autosave, snapshots and backups are core.
- Organise a manuscript as a whole: chapters, parts, notes, to-dos, progress.
- A distraction-free Zen mode.
- Cozy: smooth, quiet, warm, with optional sound, and never at the cost of typing speed.
- Start fast and run smoothly on an older laptop.

**Non-goals**

- Collaboration or several users.
- Word's advanced features: mail merge, macros, tracked changes, complex tables, citations.
- Mobile or web versions.
- Print-ready typesetting beyond the Book view and Word export.
- AI features.

## 3. Scenarios

1. She opens Pensieve on Home and continues where she left off.
2. She writes a chapter on a clean page with Word's basic formatting.
3. She notes an idea, links it to a chapter, and keeps a to-do for later.
4. She reorders chapters and parts as the story takes shape.
5. She reads the book as printed pages in the Book view.
6. She writes in Zen with nothing else on screen.
7. She exports the manuscript to Word to share or print.

## 4. Functional requirements

**Priority** (MoSCoW): M = must, S = should, C = could. **Status:** Done, Partial (what is missing is
said), Not started, Dropped. IDs are fixed; code comments and the backlog refer to them.

### 4.1 Editor

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| ED-1 | Bold, italic, underline, strikethrough | M | Done |
| ED-2 | Headings, paragraph styles and block quotes. On a book's page a Heading 1 starts a part, a Heading 2 a chapter (once it is named) and a Heading 3 is a subheading; in a one-page writing headings stay headings | M | Done |
| ED-3 | Bulleted and numbered lists | M | Done |
| ED-4 | Alignment: left, centre, right, justify | M | Done |
| ED-5 | Font, size, text colour, highlight | S | Partial: font and size apply to the whole manuscript, not the selection as in Word; text colour and highlight each apply one fixed colour (TOOL-5, TOOL-6) |
| ED-6 | Undo and redo with deep history, about a word per step as in Word; a paste is a step of its own | M | Done |
| ED-7 | Word's shortcuts: Ctrl+B, I, U, Z, Y, S, F; also Ctrl+Alt+M for a comment, Ctrl+Shift+N for a quick idea, Ctrl+Shift+F to search everything and Ctrl+/ for the list of shortcuts | M | Done |
| ED-8 | Find and replace in the chapter or across the book, with a list of matches; it starts with the selected words, as in Word | S | Done |
| ED-9 | Live word counts for the chapter, the writing and the project; with words selected, the floating bar says "12 of 1,240 words", as Word's does | M | Done |
| ED-10 | Paste from Word keeps headings, italics and paragraphs | S | Partial: works, but not tried with a real manuscript (IMP-18) |
| ED-11 | Spell check in English and Slovenian | M | Done |
| ED-12 | Images and footnotes; simple tables | C | Partial: images and footnotes; no tables |
| ED-13 | A writing language per project, chapter or selection, which spell check follows; a personal dictionary | M | Done |
| ED-14 | Comments on selected words, as in Word, written beside the page; a comment can become a to-do or a note; comments go to and from Word files | M | Done |
| ED-15 | A small bar above selected text, as Word's mini toolbar, shown once the selection settles: bold, italic, underline and highlight; a comment; Make a note (a name becomes a note linked to those words, or is linked to the note of that name; a passage is quoted in a new note); and Find in the book. A title line offers only Find, Zen only the formatting. Ctrl+Shift+V pastes plain text | S | Done |
| ED-16 | Repetitions (owner, 12 October), switched on in the toolbar's View group: a word said again within forty words (both times, and a long word in another form) is dotted under, and a sentence of more than forty words faintly tinted, each saying what it is when pointed at. Small words and the verbs of dialogue are left out; English and Slovenian, all on her computer. Off to start with, and hidden in Zen. Only what she sees is marked, at most 150 words at once, worked out when she pauses and not in the paragraph she types in, so typing stays as quick | S | Done |

### 4.2 Projects, writings and chapters

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| CH-1 | A project holds writings (books, stories, articles), and a writing an ordered list of chapters | M | Done |
| CH-2 | A Chapters tab beside the Library tab (which comes first), for the writing at hand, its rows drawn like the library's tree: parts fold, a right-click or F2 renames | M | Done |
| CH-3 | Create, rename, delete and duplicate chapters. The open book's row in the library has a + for a chapter at its end, and each part one for a chapter at the part's end; the new chapter opens on the page | M | Done |
| CH-4 | Drag chapters into order | M | Done |
| CH-5 | Parts that hold chapters; scenes within chapters | S | Partial: parts (a Heading 1 on the page); no scenes |
| CH-6 | Per chapter: a synopsis and a word goal, shown in the Outline and the Goals list. No status (draft, revising, final): dropped | S | Done |
| CH-7 | The side lists can be hidden and brought back | M | Done |
| CH-8 | No project types: each writing has a "Split into chapters" switch. On, a Heading 2 starts a chapter; off, the writing is one page and its headings stay headings. Turning it off joins the chapters (an earlier version keeps them as they were), with a warning over 20,000 words that one long page types slower; turning it on splits the page at its headings | S | Done |
| CH-9 | A library folder, chosen in Settings (Documents\Pensieve to start; a cloud-synced folder is refused), holds the projects, each in its own folder with one file. Beside the page it is a tree, as in Explorer: folders, projects, a project's writing folders and writings, a writing's parts and chapters, its Notes by group, To-dos, a Deleted folder, and the project's own files, which open in their program. Projects kept elsewhere are listed under Elsewhere and can be moved in. Folders and projects are renamed and dragged on disk; writings are dragged into folders and order, notes into groups; a Word, text or Markdown file can come in as a new writing | M | Done |
| CH-10 | Notes and to-dos belong to the project and are shared by its writings. The tree makes, renames, duplicates, moves and deletes notes, with a + on Notes and on each of its groups | M | Done |
| CH-11 | New project is a window (owner, 12 October), from Home's + New and its new-project card, the library's + and a library folder's menu: a name, where it goes (the library or one of its folders), and what it starts with: an empty page, a Word, text or Markdown file (which names it, unless she typed a name), or a folder of them, each file its own writing or one book with a chapter for each, in the order Explorer shows them. The files are read before anything is made; a folder's files that can't be read stay out, and she is told which | S | Done |
| CH-12 | Search everything (owner, 12 October), from Home's button, Ctrl+Shift+F anywhere, or the find bar's In all projects: every project's chapters (their titles too) and notes, what she has just written included, matched as Find matches (any case; č, š, ž apart from c, s, z), project by project with the words shown in place. A chapter opens with the find bar on the words, a note beside the page; the arrow keys and Enter choose. Other projects' files are read and let go at once, so their folders can still be moved | S | Done |

### 4.3 Notes and to-dos

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| NT-1 | Free-form notes, in the same editor as the page | M | Done |
| NT-2 | Groups (characters, places, research, ideas), a short description, fields, and other names that count as mentions | S | Done |
| NT-3 | A note linked to chapters; "Appears in" lists the chapters that mention it | M | Done |
| NT-4 | A to-do state (to do, doing, done) on notes and on to-dos of their own, for a chapter, a note or the whole project | M | Done |
| NT-5 | A to-dos board grouped by state, with filters and quick add | M | Done |
| NT-6 | `[[Links]]` between notes, and from words on the page to notes, with "Linked from" | S | Done |
| NT-7 | Notes and to-dos while writing, in one panel beside the page, so the page stays free: Notes, To-dos or Goals, one at a time. Notes lists the chapter's notes first (with how often it mentions them), then every other note, with a search through all of them and a + for a new one. A note opens there to read and change its kind, name, description and text, with back to the list, the previous and next note, and "Open in Notes" for the rest; a note opened anywhere while writing (the library, a linked name on the page, the selection bar) opens there too, never in a window. To-dos lists the chapter's or the whole project's, each with an add field, the board a link away; the library's To-dos opens it on the whole project's | S | Done |
| NT-8 | A visual map of ideas | C | Not started |
| NT-9 | Quick ideas (owner, 12 October): a small window that Ctrl+Shift+N opens from anywhere (in the Ideas tab, a new idea right there) keeps what she jots down as a note among the open project's Ideas, tied to no chapter | S | Done |
| NT-10 | An Ideas tab (owner, 13 October), after Notes: the ideas as cards, newest first, a link's words shown plainly, with one open beside them to write in, its links both ways, Open in Notes, and Delete after asking. New idea, and search by their words. This project, or All projects, which adds every other project's ideas, named by project, only to read; one opens in its own project to be written there | S | Done |

### 4.4 Views

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| VW-1 | Write: the page with the library or chapter list, the toolbar (the full one until she closes it; on a laptop's screen it folds the alignments into one menu, as Word does) and the panel. The paper is one continuous page, or A4 or A5 sheets on which the text flows from sheet to sheet, each numbered; it is chosen in Settings and in the toolbar's View group, which also opens Zen. The Word file takes the same paper | M | Done |
| VW-2 | Book: read-only, set as a printed book: facing pages with page 1 on the right, a book's margins, justified text with first-line indents and no line left alone at a page's foot or head, each chapter on a new page, running heads and page numbers | S | Done |
| VW-3 | Outline: chapters as cards or a list (remembered), each with its number, title, words toward its goal, synopsis and part; dragged into order or moved with the arrow keys, renamed in place, opened in Write; a new chapter named where it appears; parts as headings | S | Done |
| VW-4 | Home, around projects (owner, 12 October). On the left: the date and a greeting naming the chapter Continue opens, a verse (the King James Bible in English, the Slovenski standardni prevod in Slovenian, marked "(SSP)" as its publisher asks), the words written today and in the book, the Continue card with the last lines she wrote (Continue writing opens what was open last; Zen beside it), and a short list of open to-dos. The two sides are as wide as each other. The window bar has the larger mark over the page's left edge, the theme switch and a chip while there is no backup yet. On the right: every project, as cards (its name, its writings, their words, when it was last written in; the open one marked) with one for a new project, or as the library's tree, whose chapters, notes and to-dos open in Write; the choice is remembered. No chapter strip or progress bars | M | Done |
| VW-5 | A Book view she can type in | C | Not started; Pages in Write (VW-1) may be enough |

### 4.5 Zen

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| ZN-1 | Full screen with only the text, on the paper's colour from edge to edge, like Grammarly | M | Done |
| ZN-2 | A centred column with an adjustable width | M | Done |
| ZN-3 | Light and dark looks | M | Done (the app's themes, AT-2) |
| ZN-4 | Typewriter scrolling: the line being written stays in the middle (Settings) | C | Done |
| ZN-5 | A quiet bar at the bottom: bold, italic, underline, headings, lists, the word count, the column width, the pomodoro's time and Leave Zen; Esc leaves too | M | Done |

### 4.6 Saving, backup and export

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| SV-1 | Autosave a few seconds after a change, and on close | M | Done |
| SV-2 | Crash-safe writes | M | Done |
| SV-3 | Automatic snapshots (hourly, daily) with an easy restore | M | Done |
| SV-4 | Earlier versions: a window listing the snapshots, showing the open chapter as it was, and restoring that chapter or the whole book (after keeping the book as it is as a "Before restore" snapshot) | S | Done |
| SV-5 | Projects live in the library folder (CH-9), never in a cloud-synced folder | M | Done |
| SV-6 | Export to Word as the page looks (parts, chapters and subheadings as Heading 1, 2 and 3), and an optional Word copy in a chosen folder, kept up to date until it is changed in Word | M | Done |
| SV-7 | PDF (printing from the Book view), Markdown and plain text | S | Done |
| SV-8 | Import from Word, text and Markdown, split into chapters at their headings or at lines such as "3. poglavje". Markdown keeps its bold, italics, lists, quotes, links, pictures and footnotes; a blog post (front matter, or text before its first heading) stays one page. Text in Windows' old Central European code page reads with its č, š and ž | S | Done |
| SV-9 | Backups to a folder that Google Drive syncs, hourly and on close, and a restore from one (Section 7) | S | Done |
| SV-10 | EPUB export | C | Not started |
| SV-11 | Copy as clean HTML for a blog, and a Markdown export | S | Done |
| SV-12 | Backups straight to Google Drive through its API | C | Not started |

### 4.7 Atmosphere

Coziness is the top product priority, within the performance budget in Section 5.

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| AT-1 | Soft transitions between views, panels, windows and Zen | M | Done |
| AT-2 | Warm themes with bundled serif fonts (chosen in Settings, on Home and in the floating bar, as the icon set draws them): Daylight, Sunset, Candlelit, Moonlit and Forest, and Day and night (Daylight by day, Candlelit after dark), each with its own Basin mark, which moves on Home (except in Gentle mode or with Windows' animations off) and stands still in Write; Literata, EB Garamond and a typewriter face | M | Done |
| AT-3 | Ambient sound (rain, fireplace, café, piano), looping, with a volume and fades. It always starts quiet: the volume starts at 10 of 100, and the slider's top is half of full loudness. The floating bar shows the sound's icon and name; a click opens every sound as an icon, and the volume (owner, 13 October) | S | Done |
| AT-4 | Quiet visual ambience: lamp glow, vignette, paper grain, and sparks drifting over the desk in Candlelit | S | Done |
| AT-5 | Theme bundles pairing colours, font and sound | C | Dropped: sound stays its own choice |
| AT-6 | Gentle mode: no sparks and no motion; Windows' "animations off" setting does the same. Sound and smooth typing keep their own switches | M | Done |
| AT-7 | Harry Potter-flavoured labels (Nox for Zen, Remembrall for to-dos), off by default | C | Not started |
| AT-8 | A pomodoro in the floating bar: a click starts the writing time with a clock's tick-tock, then a chime, a word on the page and a break, and a chime when the break ends; icons pause, restart and stop it; Zen shows its time; the lengths (25 and 5 minutes to start with) are in Settings → Writing & goals | S | Done |
| AT-9 | Keystroke sounds, off to start with: a typewriter (with its carriage return and bell), a mechanical keyboard or a soft one, each recorded, with a sound for each key and a volume of up to half. Shortcuts and arrows stay quiet. The floating bar has a keyboard, lit while the keys sound, opening their kinds and volume (owner, 13 October) | C | Done |
| AT-10 | Smooth typing (on to start with): the caret glides to where the next letter goes and blinks only once she pauses, and each letter inks in under a fading veil, as in Word; drawn over the page, never in the text | S | Done |

### 4.8 Settings and polish

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| ST-1 | The manuscript's font and size in points (12 to start with), lines 1.5 apart, paragraphs flush left with a little space between them, and the page's width | S | Done |
| ST-2 | The interface in Slovenian (to start with) or English | S | Done |
| ST-3 | A daily word goal and the chapter's goal in the Goals list beside the page; the words written today on Home and in the floating bar. No streak | C | Done |
| ST-4 | A list of the shortcuts (Settings → Shortcuts, Ctrl+/) | C | Done |
| ST-5 | Tutorial tips the first time she reaches Home, Write, Notes and Book, each pointing at what it is about, with "Ne prikazuj več namigov" to stop them; Settings → General turns them on and off and shows them again | S | Done |
| ST-6 | What opens over the page is a window like Settings: its name and ✕ at the top, its buttons at the foot; Escape or a click beside it closes it, and the keyboard goes back to what opened it. Settings and Earlier versions do; notes and to-dos open in the panel beside the page instead (NT-7) | S | Done |
| ST-7 | Updates: Pensieve looks for a newer signed version on GitHub Releases, offers it quietly in the window bar, and installs it with one click, keeping her projects and settings | S | Done |
| ST-8 | Example books, and a long test book of about 151,000 words for checking speed (Settings → General) | C | Done |

## 5. Non-functional requirements

- **Speed:** the target is Eva's laptop, an HP ProBook 650 G2 (2016, a 6th-generation Core i5) with
  Windows 10 and 8 GB of memory, at 1366×768 or about 1536×864. Layouts are checked at 1366 and 1536 pixels wide and speed with the processor slowed
  four times. Typing feels instant, also in a 10,000-word chapter of a 150,000-word book: about 40 ms a key
  there, the same with a panel open, a note pinned, key sounds or smooth typing. Home appears before the
  editor's code is read. Only `opacity` and `transform` are animated, and nothing decorative runs on the
  typing path.
- **Reliability:** no lost text after a crash, a power cut or a forced close; a failed save or backup says so.
- **Install:** one small installer with no prerequisites to install by hand; updates as in ST-7.
- **Privacy:** everything stays on her computer; no telemetry and no account.
- **Usability:** a Word user can write and format within minutes; every action can be found in the toolbar
  or a menu.
- **Accessibility:** usable from the keyboard, readable contrast in every theme, adjustable text size.
- **Languages:** English and Slovenian everywhere, in UTF-8 (č, š, ž).
- **Maintainability:** small, readable code that one developer can look after.

## 6. Architecture

| Part | Choice |
|------|--------|
| Shell | Tauri 2. The Rust side stays thin: files, the library on disk, backups, the window, the spell-check dictionary |
| Interface | Svelte 5 and TypeScript; the views load once Home is on screen |
| Editor | TipTap 3 (ProseMirror) with the app's own extensions: the chapter page, sheets (pagination), smooth typing, undo steps, comments, footnotes, note links |
| Storage | SQLite through Tauri's SQL plugin, one file per project; the settings in the window's storage and in `prefs.json` |
| Spell check | Windows' own spell checker through WebView2, following the `lang` of the text. A test on 1 October found English and Slovenian (č, š, ž) both work; a computer without the Slovenian language pack would need bundled Hunspell dictionaries |
| Word | `docx` to write (loaded on first use) and `mammoth` to read |
| Pages | Measured in the page itself: the Book view cuts chapters into pages, and Pages in Write adds room where a sheet ends once typing pauses |
| Sound | Ambience: looping recordings in `static/ambience/`. Keystrokes: Web Audio playing parts of one recording per keyboard, in `static/keys/` |
| Updates and files | Tauri's updater plugin (signed updates) and opener plugin (used from Rust only) |

## 7. Data and backups

- **The library** is a folder of project folders. Each project folder holds one SQLite file, `pensieve.db`,
  and whatever files she keeps there.
- **In a project file:** the project (`shelf`), its writings (`projects`, a name from before a project held
  several), chapters, notes and their chapter links, to-dos, snapshots and the personal dictionary.
  Chapters still carry the status they had before statuses were dropped; nothing reads it. A
  chapter is kept as ProseMirror JSON with a plain-text copy for counts, search and export. The file has a
  schema version, and older files are upgraded after a copy of them is kept beside them.
- **Snapshots** hold a writing with the project's notes and to-dos as they were. A restore never changes
  notes and to-dos that still exist; it brings back the ones deleted since.
- **Backups:** the live file never sits in a synced folder, where a sync could copy it mid-write. Instead
  Pensieve writes a backup file of each project into a folder she picks inside Google Drive (Drive for
  desktop syncs it), hourly while open and on close, keeping each project's latest 20. Settings → Backup &
  export restores from one.

## 8. UX principles

- **Calm first:** a muted palette, room to breathe, one main action per screen.
- **Familiar:** Word's icons, names and shortcuts where possible.
- **Gentle motion:** short and soft, never sudden.
- **Quiet:** no nagging; problems are said gently but never hidden.
- **The text first:** panels fold away and the page is the hero.

## 9. Decisions

The owner's decisions that shaped the app, newest first. Each replaced what the original plan or the
design system said.

- **13 Oct:** Home has no Ideas box: ideas have their own tab, as cards with one open beside, This project or
  All projects (other projects' ideas only read, written in their own project), and links between them as
  [[links]], drawn on a map. The Notes group Zamisli is Ideje. The floating bar has the looks as icons, and
  the sound and the keys' sound with their volumes.
- **12 Oct:** Chapter statuses dropped, so a writing's progress on Home is its words against its target.
  Eva's laptop runs Windows 10 with 8 GB of memory. A bar above selected text, with formatting, a comment,
  a note and find, and the selected words counted, as in Word. Notes and to-dos open in the panel beside
  the page, never in a window, so nothing needs pinning: notes with a search and the previous and next
  note, to-dos the chapter's or the project's in one list. The toolbar keeps Notes, To-dos, Goals and Link
  a note. Home redone around projects: hers on the left (greeting, the Continue card, a short to-do
  list), every project on the right as cards or the library's tree; no chapter strip, progress bars or
  recent notes. New project is a window, and a project can start from a Word, text or Markdown file or a
  folder of them (each file a writing, or one book with a chapter for each). Quick ideas, a search across
  every project, and gentle marks for repetitions. Home's verse in Slovenian
  from the SSP. Home's two sides as wide as each other. A Forest theme, and the owner's new icon set: the
  Basin mark for each theme (the app's icon is Daylight's), the theme switch and Home's New project button
  as it draws them.
- **9 Oct:** Earlier versions, a note and the to-dos open in windows like Settings. A note or the to-dos can
  be pinned beside the page, on the right only, as the library keeps the left (since 12 October they open
  there always). The tree has a + for chapters. Smooth typing has its own switch, apart from Gentle mode.
- **8 Oct:** Chapter statuses hidden (dropped on 12 October). The Library tab first. The full toolbar open to start with.
  Pages (A4 or A5) instead of a second sheet drawn under the page. The Book view set as a printed book. Undo
  a word at a time. Tutorial tips, a pomodoro, recorded keystroke sounds and smooth typing. Updates through
  GitHub Releases. The laptop is an HP ProBook 650 G2.
- **7 Oct:** Projects hold several writings, with no project types but a "Split into chapters" switch. A
  library folder of projects, drawn like VS Code's file explorer, with her own files in it. Notes and to-dos
  belong to the project. A Sunset theme, with the old Follow sunset renamed Day and night. Gentle mode no
  longer mutes the sound.
- **6 Oct:** A plain page: no running head, chapter label, drop cap or first-line indents; a chapter's
  title is its first line (Heading 2) and a part's a Heading 1. Text at 12 pt with lines 1.5 apart. Wider
  pages. Zen like Grammarly. The interface in Slovenian from the start. No streak; the daily goal only in the
  Goals list beside the page. Sound stays a choice apart from the theme. One list at a time in the panel.
- **5 Oct:** Pensieve opens on Home. Sparks drift over the desk in Candlelit while writing.
- **1 Oct:** Windows 10 or newer, personal use only, English and Slovenian, backups through Google Drive.

## 10. Open questions

1. Which Word features beyond this list are must-haves.
2. Does she use Word's page numbers, headers or a table of contents in her manuscripts?

## 11. Name

**Pensieve:** in Harry Potter, the basin where thoughts and memories are kept and looked at again, which
is what the app does with ideas and text. It is a trademarked term from the books, which is fine for a
personal gift; a public release would need another name.

## 12. Success

- She can write, organise and export a chapter in her first session without help.
- No lost work over months of use, crashes included.
- It starts quickly, runs smoothly on her laptop, and she chooses it over Word for her writing.
