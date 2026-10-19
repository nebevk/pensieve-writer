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
| ED-5 | Font, size, text colour, highlight. As in Word, the toolbar's font and size go on the selected words, or on what is typed next, and their boxes show the font and size where the cursor is (owner, 13 October). The manuscript's own font and size (Settings → Appearance) are what words without their own have; choosing them in the boxes takes the words' own away. A Pensieve Word file keeps words' fonts and sizes both ways; another writer's file, or pasted text, takes the manuscript's. The text colour's A and the highlight put on the colour last chosen, and each one's arrow opens its colours (owner, 13 October): the look's own colour, red, orange, green, blue, purple and grey for text, yellow, green, blue, pink and orange for highlights, with Automatic and No colour to take them off. They go to Word and come back as character styles | S | Done |
| ED-6 | Undo and redo with deep history, about a word per step as in Word; a paste is a step of its own | M | Done |
| ED-7 | Word's shortcuts: Ctrl+B, I, U, Z, Y, S, F, H; Ctrl+L, E, R and J align left, centre, right and justify, as the toolbar does (never on a title or part line), and Ctrl+P prints the writing as Print / PDF does (owner, 14 October); also Ctrl+Alt+M for a comment, Ctrl+Shift+N for a quick idea, Ctrl+Shift+F to search everything and Ctrl+/ for the list of shortcuts. F5 and Ctrl+R never reload the window, which would lose the moment's typing (14 October) | M | Done |
| ED-8 | Find and replace (owner, 13 October): a box under the toolbar's Find, which is lit while it is open; it starts with the selected words, as in Word. In This chapter every match on the page is marked and counted ("2 of 7"), and Enter, Shift+Enter and the arrows go round them; Aa matches the capitals, ab whole words only. Replace (Ctrl+H) has Replace and All, and one Ctrl+Z takes All back. This project and All projects list every place project by project, each with its words in their sentence and its chapter (or page, in a writing of one page); Enter opens one on that very match. This project's All replaces in every writing of the project, never in their names or the notes, after keeping each writing's earlier version | S | Done |
| ED-9 | Live word counts for the chapter, the writing and the project; with words selected, the floating bar says "12 of 1,240 words", as Word's does | M | Done |
| ED-10 | Paste from Word keeps headings, paragraphs, bold and italics. Word's lists become lists (Word types each bullet or number in front of a paragraph), its footnotes Pensieve's footnotes, its empty lines empty lines; its fonts and colours don't come in, nor the language it marks every run with, unless it differs from the document's. In a writing split into chapters a pasted Heading 2 starts a chapter and a Heading 1 a part, as when typed. Checked with Word 365's clipboard HTML (word-paste-check) | S | Done |
| ED-11 | Spell check in English and Slovenian | M | Done |
| ED-12 | Images and footnotes; simple tables | C | Partial: images and footnotes; no tables |
| ED-13 | A writing language per project, chapter or selection, which spell check follows; a personal dictionary | M | Done |
| ED-14 | Comments on selected words, as in Word, written beside the page; a comment can become a to-do or a note; comments go to and from Word files | M | Done |
| ED-15 | A small bar above selected text, as Word's mini toolbar, shown once the selection settles: bold, italic, underline and highlight; a comment; Make a note (a name becomes a note linked to those words, or is linked to the note of that name; a passage is quoted in a new note); and Find, which lists the words' places in the project. A title line offers only Find, Zen only the formatting. Ctrl+Shift+V pastes plain text | S | Done |
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
| CH-9 | A library folder, chosen in Settings (Documents\Pensieve to start; a cloud-synced folder is refused), holds the projects, each in its own folder with one file. Beside the page it is a tree, as in Explorer: folders, projects, a project's writing folders and writings, a writing's parts and chapters, its Notes by group, To-dos, a Deleted folder, and the project's own files, which open in their program. Projects kept elsewhere are listed under Elsewhere and can be moved in, or taken off the list (their files stay). Moving one in copies it whole, through SQLite itself, with the words typed a moment before; a copy that won't open leaves her on the old file and goes to the Recycle Bin (ARCH-6, 16 October). A project of the library is deleted from its menu (in the library, or on its card on Home) or with Del, after a question: its folder goes to the Recycle Bin, from where it comes back as it was (where there is no Recycle Bin, Windows asks before deleting it for good); never the open project. Folders and projects are renamed and dragged on disk; writings are dragged into folders and order, notes into groups; a Word, text or Markdown file can come in as a new writing | M | Done |
| CH-10 | Notes and to-dos belong to the project and are shared by its writings. The tree makes, renames, duplicates, moves and deletes notes, with a + on Notes and on each of its groups | M | Done |
| CH-11 | New project is a window (owner, 12 October; two starts, 14 October), from Home's + New and its new-project card, the library's + and a library folder's menu: a line saying what a project is, a name, where it goes (the library or one of its folders), and how it starts, each saying what it makes: a blank page, or From Word, one or several Word, OpenDocument, text or Markdown documents she picks (one names the project, several their folder, unless she typed a name). They are read as soon as they are chosen, and the window says what they hold (chapters, words and the first titles) before anything is made; several are each their own writing or one book with a chapter for each, in the order Explorer shows them. One that can't be read says why, and of several those stay out, she is told which | S | Done |
| CH-12 | Search everything (owner, 12 October), from Home's button or Ctrl+Shift+F, and in Write as find's All projects (Ctrl+Shift+F there): every project's chapters (their titles too) and notes, what she has just written included, matched as Find matches (any case; č, š, ž apart from c, s, z), every place listed project by project with the words shown in place, the first few of each project and the rest a click away. A chapter opens with find on the page at that match, a note beside the page; the arrow keys and Enter choose. Other projects' files are read and let go at once, so their folders can still be moved | S | Done |

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
| NT-8 | A map of ideas (owner, 13 October), in the Ideas tab beside Cards: this project's ideas as cards she drags where she wants them, in rows until she moves one, a line with an arrow for each [[link]] between two ideas. A line drawn from an idea's dot onto another links them with a [[link]] in the first one's text; a line clicked can be taken away, with the [[link]]. A double click makes an idea there; a search fades the ideas without its words. Their places are kept in the project, apart from the ideas' text | C | Done |
| NT-9 | Quick ideas (owner, 12 October): a small window that Ctrl+Shift+N opens from anywhere (in the Ideas tab, a new idea right there) keeps what she jots down as a note among the open project's Ideas, tied to no chapter | S | Done |
| NT-10 | An Ideas tab (owner, 13 October), after Notes: the ideas as cards, newest first, a link's words shown plainly, with one open beside them to write in, its links both ways, Open in Notes, and Delete after asking. New idea, and search by their words. This project, or All projects, which adds every other project's ideas, named by project, only to read; one opens in its own project to be written there. Cards or Map (NT-8) | S | Done |

### 4.4 Views

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| VW-1 | Write: the page with the library or chapter list, the toolbar (the full one until she closes it; on a laptop's screen it folds the alignments into one menu, as Word does) and the panel. The paper is one continuous page, or A4 or A5 sheets on which the text flows from sheet to sheet, each numbered; it is chosen in Settings and in the toolbar's View group, which also opens Zen. The Word file takes the same paper | M | Done |
| VW-2 | Book: read-only, set as a printed book: facing pages with page 1 on the right, a book's margins, justified text with first-line indents and no line left alone at a page's foot or head, each chapter on a new page, running heads and page numbers | S | Done |
| VW-3 | Outline: chapters as cards or a list (remembered), each with its number, title, words toward its goal, synopsis and part; dragged into order or moved with the arrow keys, renamed in place, opened in Write; a new chapter named where it appears; parts as headings | S | Done |
| VW-4 | Home, around projects (owner, 12 October; drawn again 13 October). On the left: the large Basin mark, moving except in Gentle mode, its basin on the column's edge, and beside it the date, a verse in large letters (the King James Bible in English, the Slovenski standardni prevod in Slovenian, marked "(SSP)" as its publisher asks) and, in line under it, her greeting, small, with a few words of encouragement for the time of day, a different line each time; the words written today and in the book; the Continue card (the writing, its chapter and the page her last line is on, as Write's sheets of A4 count it ("Pogl. III · str. 4"), when it was written in, her last line, the sound that starts with writing, Continue writing, which opens what was open last, and Zen); and a short list of open to-dos. The two sides are as wide as each other. The window bar has a small still mark and the name, the search as a field with its shortcut, the theme switch and a chip while there is no backup yet. On the right: every project, as cards (its name, its writings, their words, when it was last written in; the open one marked) with one for a new project, a right-click on a card (or the menu key) giving the library's menu for it (Open, Show in Explorer, and Delete or Remove from the list), or as a table (Name, Words, Edited): folders and projects each on a line saying what they hold, the open project marked Open with its writings, chapters (in Roman), notes and to-dos, which open in Write, and a ⋯ with each row's menu; the choice is remembered. No chapter strip, chapter statuses or progress bars | M | Done |
| VW-5 | A Book view she can type in | C | Not started; Pages in Write (VW-1) may be enough |

### 4.5 Zen

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| ZN-1 | Full screen with only the text, on one plain page like Grammarly's, which stands on the look's still scene (owner, 13 October, from the design's art): dawn hills in Daylight, the sunset sea in Sunset, the candlelit room, the moonlit sea, the forest. The text is as wide as she set it; the scene is a still picture, so a key is no slower (a speed check times it) | M | Done |
| ZN-2 | A centred column with an adjustable width | M | Done |
| ZN-3 | Light and dark looks | M | Done (the app's themes, AT-2) |
| ZN-4 | Typewriter scrolling: the line being written stays in the middle (Settings) | C | Done |
| ZN-5 | A quiet bar at the bottom: bold, italic, underline, headings, lists, the word count, the column width, the pomodoro's time and Leave Zen; Esc leaves too | M | Done |

### 4.6 Saving, backup and export

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| SV-1 | Autosave two seconds after she stops typing, and at least every 10 seconds while she types on (ARCH-3, 15 October: not while she is naming a new chapter in its heading, which waits for her pause), and on close | M | Done |
| SV-2 | Crash-safe writes: a save writes a writing's chapters in one statement, all of them or none (ARCH-4, 19 October) | M | Done |
| SV-3 | Automatic snapshots (hourly, daily) with an easy restore | M | Done |
| SV-4 | Earlier versions: a window listing the snapshots, showing the open chapter as it was, and restoring that chapter or the whole book (after keeping the book as it is as a "Before restore" snapshot) | S | Done |
| SV-5 | Projects live in the library folder (CH-9), never in a cloud-synced folder | M | Done |
| SV-6 | Export to Word as the page looks (parts, chapters and subheadings as Heading 1, 2 and 3), and an optional Word copy in a chosen folder, kept up to date until it is changed in Word; changes made there come back with Bring back from Word (SV-8). Each writing has its own copy, named "Project - Writing" (just the writing when the two are the same); when another writing's copy has that name, two projects of the same name say, it is "… (2)", and keeps that name | M | Done |
| SV-7 | PDF (printing from the Book view), Markdown and plain text | S | Done |
| SV-8 | Import from Word, OpenDocument (.odt, as LibreOffice saves; owner, 14 October), text and Markdown, split into chapters at their headings or at lines such as "3. poglavje". An OpenDocument file is read as a Word file is: its title, headings, lists, quotes, footnotes, comments, tables, pictures, bold, italics and highlights, an index of contents left out. Markdown keeps its bold, italics, lists, quotes, links, pictures and footnotes; a blog post (front matter, or text before its first heading) stays one page. Text in Windows' old Central European code page reads with its č, š and ž. Word comes in where it acts (owner, 14 October), each window saying first what the documents hold: New project › From Word (CH-11); New writing from Word… (the library's + and the open project's menu) and a Word file's Import as a new writing in the library add them as writings of the open project; Bring back from Word… in a writing's menu replaces its chapters with a document's, its Word copy changed in Word say, after keeping an earlier version, a chapter of the same title keeping its place, notes and to-dos, and a one-page writing staying one page; documents dropped on Pensieve come in, on Home as a new project, elsewhere as writings of the open project, other files refused with a word. Settings only exports | S | Done |
| SV-9 | Backups to a folder that Google Drive syncs, hourly, on close and as she leaves a project for another, and a restore from one (Section 7). Each project's last backup is remembered on its own, so a project unchanged since gets no second copy (ARCH-18, 16 October) | S | Done |
| SV-10 | EPUB export | C | Not started |
| SV-11 | Copy as clean HTML for a blog, and a Markdown export | S | Done |
| SV-12 | Backups straight to Google Drive through its API | C | Not started |
| SV-13 | When saving fails (the project's folder renamed in Explorer, a full disk), a rescue copy of the page's words, with the notes and to-dos not saved yet, goes to Pensieve's own folder at once, and again every ten seconds while it keeps failing and the words change; a save that works takes it away. Closing asks once, says the words are safe, and closes; a second close while saving waits for it. The next time the project opens, the copy is offered back: over the writing, after what is there now is kept in Earlier versions, or beside it, as a writing of its own, when the writing has been saved since. A copy put off is never written over or taken away by a later one. With no rescue copy either, the window stays open until the words are copied or saved as a Word file elsewhere. Export and copying work from the page while saving fails, and a file that failed to open is tried again at the next save, never made again empty (ARCH-1, 15 October) | M | Done |
| SV-14 | Delete for good keeps one copy of the writing as it was in Pensieve's own folder, with no time limit, and nothing is deleted if that copy can't be written. Settings → Backup & export counts these copies, brings one back as a backup is restored, and removes them after asking; rescue copies, which may hold words in no project, go only once brought back (ARCH-5, 15 October) | S | Done |

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
| AT-11 | Vrt zgodb / Garden of stories (owner, 14 October; [garden-concept.md](garden-concept.md)): one tree grows out of the Pensieve basin as she writes, through eight stages, and each thing she does well leaves a keepsake around it (flowers for words, fireflies for writing days, books for chapters, birds for notes, butterflies for ideas, stones for to-dos, teacups for pomodoros). The Goals panel becomes the garden, her goals under it; Home's large mark shows her tree. Never a streak, nothing ever lost, nothing while she types; a little chime. Only words written in Pensieve count, never those brought in from Word | S | Not started: the art first |

### 4.8 Settings and polish

| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| ST-1 | The manuscript's font and size in points (12 to start with), lines 1.5 apart, paragraphs flush left with a little space between them, and the page's width | S | Done |
| ST-2 | The interface in Slovenian (to start with) or English | S | Done |
| ST-3 | A daily word goal and the chapter's goal in the Goals list beside the page; the words written today on Home and in the floating bar. No streak | C | Done |
| ST-4 | A list of the shortcuts (Settings → Shortcuts, Ctrl+/), every one there is and tried in the app, in four groups: on the page, finding, anywhere, and the library, chapters and lists. Each key is drawn as it is printed. The numbered list's Ctrl+Shift+7 is left out: on a Slovenian keyboard that is Ctrl+/, which opens the list and leaves the page as it was (14 October) | C | Done |
| ST-5 | Tutorial tips the first time she reaches Home, Write, Notes and Book, each pointing at what it is about, with "Ne prikazuj več namigov" to stop them; Settings → General turns them on and off and shows them again | S | Done |
| ST-6 | What opens over the page is a window like Settings: its name and ✕ at the top, its buttons at the foot; Escape or a click beside it closes it, and the keyboard goes back to what opened it. Settings and Earlier versions do; notes and to-dos open in the panel beside the page instead (NT-7) | S | Done |
| ST-7 | Updates: Pensieve looks for a newer signed version on GitHub Releases, offers it quietly in the window bar, and installs it with one click, keeping her projects and settings | S | Done |
| ST-8 | Example books, and a long test book of about 151,000 words for checking speed (Settings → General) | C | Done |
| ST-9 | A welcome the first time Pensieve opens (owner, 13 October, with the design's art for the look on now): three steps over Home, the scene and a welcome, her writing and its notes, and the five looks to pick from, which change at once; then the tips (ST-5). Skip, ✕ or Esc end it too. It never comes again, nor to someone whose settings are kept from before it | C | Done |
| ST-10 | Places with nothing in them yet show the design's picture for the look on now, its ground fading into the window, with a kind line and, where it helps, the button that makes the first one (owner, 13 October): Notes (New note), To-dos (instead of three empty columns), Ideas (New idea), the notes and to-dos beside the page, Home's to-dos (the picture beside the words, reaching into Home's margin, so Home keeps its height at 1366 × 768), and a library with no projects (New project) | C | Done |

## 5. Non-functional requirements

- **Speed:** the target is Eva's laptop, an HP ProBook 650 G2 (2016, a 6th-generation Core i5) with
  Windows 10 and 8 GB of memory, at 1366×768 or about 1536×864. Layouts are checked at 1366 and 1536 pixels wide and speed with the processor slowed
  four times. Typing feels instant, also in a 10,000-word chapter of a 150,000-word book: about 40 ms a key
  there, from the key to the page showing it (the typing check times it, ARCH-11), the same with a panel open, a note pinned, key sounds or smooth typing. Home appears before the
  editor's code is read. Only `opacity` and `transform` are animated, and nothing decorative runs on the
  typing path.
- **Reliability:** no lost text after a crash, a power cut or a forced close; a failed save or backup says so.
  When Windows shuts down or signs out, it waits, saying "Pensieve is saving your words", until her last words
  are saved (or in a rescue copy), then Pensieve closes (ARCH-23); a forced shutdown can't be held.
  Where her text is kept is tested against a real SQLite (sql.js standing in for the SQL plugin): saves with
  č, š, ž and pictures, other writings' chapters left alone, a save cut short, earlier versions and their
  limits, restores, switching and moving projects, and an older file upgraded. CI runs these and the Rust
  tests on every push (ARCH-14, 16 October).
- **Install:** one small installer with no prerequisites to install by hand; updates as in ST-7. The
  installer speaks Slovenian on a Slovenian Windows and English otherwise, and shows Daylight's Basin mark on
  its first and last page. The app's Windows icon is the mark alone, filling its square as Windows' own icons
  do, drawn at each size Windows shows (`scripts/brand-images.mjs`).
- **Privacy:** everything stays on her computer; no telemetry and no account.
- **Usability:** a Word user can write and format within minutes; every action can be found in the toolbar
  or a menu.
- **Accessibility:** usable from the keyboard, readable contrast in every theme, adjustable text size. A walk
  with Tab through every view and window (keys-walk-check) finds every stop named, on screen and showing
  where the keyboard is; windows keep the keyboard and Escape gives it back; menus open with Shift+F10 or
  the menu key and move with the arrows. svelte-check reports no accessibility warnings.
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
| Updates, files and the window | Tauri's updater plugin (signed updates), opener plugin (used from Rust only: her files, Show in Explorer, and links, which open in her browser while the window stays on Pensieve) and single-instance plugin (one Pensieve at a time, in installed builds) |

## 7. Data and backups

- **The library** is a folder of project folders. Each project folder holds one SQLite file, `pensieve.db`,
  and whatever files she keeps there.
- **In a project file:** the project (`shelf`), its writings (`projects`, a name from before a project held
  several), chapters, notes and their chapter links, to-dos, snapshots and the personal dictionary.
  Chapters still carry the status they had before statuses were dropped; nothing reads it. A
  chapter is kept as ProseMirror JSON with a plain-text copy for counts, search and export. The file has a
  schema version, and older files are upgraded after a copy of them is kept beside them.
- **Pictures** (shrunk to 1600 px when put in) are kept once per project file, in a `pictures` table by
  the SHA-256 of their data: a chapter, note or snapshot names them, however many saves and snapshots there
  are (IMP-6). None is ever deleted, so every snapshot finds its pictures. Backups and Word copies carry the
  pictures themselves. A file from before keeps its pictures in its chapters until each is saved again.
- **Snapshots** hold a writing with the project's notes and to-dos as they were. A restore never changes
  notes and to-dos that still exist; it brings back the ones deleted since.
- **Backups:** the live file never sits in a synced folder, where a sync could copy it mid-write. Instead
  Pensieve writes a backup file of each project into a folder she picks inside Google Drive (Drive for
  desktop syncs it), hourly while open and on close, keeping each project's latest 20. One that failed is
  tried again a quarter of an hour later; one that was written never counts as failed because an older
  one couldn't be tidied away. Settings → Backup & export restores from one.
- **Kept copies:** apart from her projects, in Pensieve's own folder (`Kept copies` in its app data), a
  rescue copy of each project whose saves are failing (SV-13), and a copy of each writing deleted for good
  (SV-14). Both are backup files; a rescue copy's notes and to-dos replace older versions of themselves
  when it is brought back.

## 8. UX principles

- **Calm first:** a muted palette, room to breathe, one main action per screen.
- **Familiar:** Word's icons, names and shortcuts where possible.
- **Gentle motion:** short and soft, never sudden.
- **Quiet:** no nagging; problems are said gently but never hidden.
- **The text first:** panels fold away and the page is the hero.

## 9. Decisions

The owner's decisions that shaped the app, newest first. Each replaced what the original plan or the
design system said.

- **19 Oct:** Saves stay without a new dependency: a writing's chapters go to the file in one statement, all of
  them or none, rather than in a transaction held by Rust's `sqlx`.
- **16 Oct:** The Windows icon is the Basin mark alone, larger and without the tile, which shrank to a pale
  square on the taskbar. The installer comes in Slovenian and English and wears the mark; its uninstaller says
  that deleting Pensieve's own folder takes the copies it keeps, not her projects.
- **15 Oct:** One Pensieve at a time: starting it again, while it sits minimised say, brings the open window
  back (Tauri's single-instance plugin, in installed builds). A save comes at least every 10 seconds while
  she types without a pause. An automatic backup that failed is tried again a quarter of an hour later, not
  every minute. When saving fails, a rescue copy is written at once, and closing asks once and then closes
  rather than refusing; it refuses only while no copy of her words exists. Writings deleted for good leave a
  copy in Pensieve's own folder, kept with no time limit.
- **14 Oct:** A garden of stories (Vrt zgodb) for cozy rewards: one tree for every look growing out of the
  basin, keepsakes for what she does, a little chime, shown on Home in the large mark; words brought in from
  Word don't count. New project starts from a blank page or From Word, each saying what it makes, and the window
  says what the documents hold before anything is made; the folder of files goes, as picking several
  documents does it. Word comes in where it acts: New writing from Word adds documents to the open
  project, Bring back from Word replaces a writing's chapters after keeping an earlier version, and
  documents dropped on Pensieve come in; Settings' Backup & export only exports. Settings are rows like
  Appearance's, and Shortcuts lists them all. Word's Ctrl+L, E, R and J align, and Ctrl+P prints.
- **13 Oct:** Home has no Ideas box: ideas have their own tab, as cards with one open beside, This project or
  All projects (other projects' ideas only read, written in their own project), and links between them as
  [[links]], drawn on a map. The Notes group Zamisli is Ideje. The floating bar has the looks as icons, and
  the sound and the keys' sound with their volumes. Find is a box under the toolbar's Find: This chapter
  (every match marked and counted), This project or All projects (every place listed), with Aa and ab; the
  project's Replace all changes every writing, never names or notes. Home drawn again: the large moving
  mark beside the verse in large letters, her greeting small under it with words of encouragement instead
  of the chapter waiting (the Continue card names that, and its page); the window bar's mark small and still; the
  projects' list a table (Name, Words, Edited) with a ⋯ on each row. Chapter statuses stay out. The
  installer wears the Basin mark too. A project is deleted to the Recycle Bin, never outright and never the
  open one; one kept elsewhere can be taken off the list. Zen's plain page stands on the look's still scene,
  from the design's art, and the first start has a welcome of three steps with it, the look picked there.
  Empty places show its pictures too. The toolbar's font, size, text colour and highlight work as in Word: on
  the selected words, with a choice of colours; Settings keep the manuscript's own font and size.
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
