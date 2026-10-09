# Requirements White Paper: A Cozy Desktop Writing Studio

**Name:** *Pensieve* (see Section 12)
**Version:** 0.3 (draft) | **Date:** 1 October 2026
**Platform:** Windows 10 or newer desktop (Tauri) | **Status:** Requirements phase

---

## 1. Purpose

Build a small, calm desktop application for writing and editing long-form text (books, stories, essays). It should feel as familiar as Microsoft Word for basic editing, but with far fewer features and a quiet, distraction-free interface. It borrows the best organizing ideas from tools like Scrivener and Atticus: chapters, notes, and a "whole book" view, without their complexity.

The primary user is a single writer who is comfortable with Word and wants a cozy place to write, organize, and finish a manuscript. The app is for personal use and is not planned for distribution. It must handle both long manuscripts (novels, short stories, non-fiction) and short pieces such as blog posts and articles, in English and Slovenian.

## 2. Goals and Non-Goals

### Goals
- Feel instantly familiar to a Word user (toolbar, shortcuts, behavior).
- Never lose the user's work (autosave and backups are core, not optional).
- Help organize a manuscript as a whole: chapters, notes, progress.
- Offer a distraction-free zen mode.
- Be genuinely **cozy**: smooth transitions, a calm and pleasant writing experience, and optional ambience, while staying as intuitive as Word.
- Install quickly, start fast, run smoothly on an older Windows laptop.

### Non-Goals (v1)
- Real-time collaboration or multi-user editing.
- Advanced Word features: mail merge, macros, tracked changes, complex tables, citations.
- Mobile or web versions.
- Publishing-grade typesetting (print-ready PDF/EPUB layout is a later consideration).
- AI features.

## 3. Users and Scenarios

**Primary persona:** a non-technical writer, experienced with Word, who writes for pleasure or toward a book.

Key scenarios:
1. Opens the app, sees her projects, and continues where she left off.
2. Writes a chapter in a clean editor with basic formatting.
3. Jots an idea in a note, links it to a chapter, and marks follow-ups as todo.
4. Reorders chapters by drag and drop as the story takes shape.
5. Switches to book view to see how the text reads as pages.
6. Enters zen mode to write with nothing else on screen.
7. Exports the manuscript to Word to share or print.

## 4. Functional Requirements

Priority key (MoSCoW): **M** = Must (v1), **S** = Should (v1 if time allows), **C** = Could (later), **W** = Won't (for now).

### 4.1 Editor

| ID | Requirement | Priority |
|----|-------------|----------|
| ED-1 | Rich text editing: bold, italic, underline, strikethrough | M |
| ED-2 | Headings (H1-H3), paragraph styles, block quotes. Since 6 October a Heading 1 marks a part, a Heading 2 a chapter (one lower down starts a new chapter once it is named), and a Heading 3 a subheading. In a writing with "Split into chapters" off, which is one page, headings stay headings | M |
| ED-3 | Bulleted and numbered lists | M |
| ED-4 | Text alignment (left, center, right, justify) | M |
| ED-5 | Font family, font size, text color, highlight | S |
| ED-6 | Undo/redo with deep history. Undo goes back about a word at a time, as in Word (8 October): each space and new paragraph starts a step, and a paste is a step of its own | M |
| ED-7 | Familiar shortcuts (Ctrl/Cmd + B, I, U, Z, Y, S, F) | M |
| ED-8 | Find and replace within a chapter and across the project | S |
| ED-9 | Live word and character count (chapter and project) | M |
| ED-10 | Paste from Word with sensible formatting retained | S |
| ED-11 | Spell check in **English and Slovenian** | M |
| ED-13 | Language setting per project, chapter, or selection, with spell check switching accordingly; personal dictionary for added words | M |
| ED-12 | Images, simple tables, footnotes | C |
| ED-14 | Comments on selected words, as in Word: written, edited and deleted beside the page; a comment can become a to-do or a note; comments go to and from Word files | M |

### 4.2 Project and Chapter Organization

| ID | Requirement | Priority |
|----|-------------|----------|
| CH-1 | A project holds writings (books, stories, articles; since 7 October), and a writing an ordered list of chapters | M |
| CH-2 | Sidebar "binder" showing chapters; click to open. The Chapters tab stays beside the library, to keep to the writing at hand, and its rows look like the library's tree (owner, 8 October): parts fold, a right-click or F2 renames. The Library tab comes first. In the library, what unfolds shows its own rows folded (writing folders, note groups, parts), except the way to the chapter on the page; the Chapters tab shows every part unfolded | M |
| CH-3 | Create, rename, delete, duplicate chapters | M |
| CH-4 | Drag-and-drop reordering | M |
| CH-5 | Optional grouping (parts/sections containing chapters, or scenes within chapters) | S |
| CH-6 | Per-chapter metadata: status (draft / revising / final), synopsis, word goal (set in the Goals list beside the page since 6 October). The status is hidden for now (owner, 8 October): it is kept with each chapter, but nothing shows or sets it | S |
| CH-7 | Collapsible sidebar | M |
| CH-8 | No project types since 7 October: each writing has a "Split into chapters" switch instead. On, a Heading 2 starts a new chapter; off, the writing is one page (an article or blog post), and its headings stay headings. Turning it off joins the chapters (an earlier version keeps them as they were), and for a writing over 20,000 words the question warns that typing in one page that long is slower; turning it on splits the page at its headings | S |
| CH-9 | A library folder, chosen in Settings (Documents\Pensieve by default, never inside a synced folder such as OneDrive or Google Drive), holds the projects, each in its own folder with one file. The library beside the page shows it as a tree: folders, projects, a project's writing folders and writings, a writing's parts and chapters, its Notes (by group) and To-dos, and a Deleted folder for writings taken out. Projects kept elsewhere are listed under "Elsewhere" and can be moved in (owner, 7 October). As in Explorer, folders and projects are renamed and dragged into other folders on disk, and empty folders deleted; a project goes by its folder's name. Writings are dragged into writing folders or into order, notes into groups. Her other files (pictures, PDFs, Word files) show in their folders and in a project's Files, open in their own program with a double click, and a Word file can come in as a new writing (owner, 7 October) | M |
| CH-10 | Notes and to-dos belong to the project and are shared by its writings. A note clicked in the tree opens in the full Notes view; the tree can make, rename, duplicate, move and delete notes, and Notes and each of its groups have a + for a new note there (8 October) (owner, 7 October) | M |

### 4.3 Notes and Todo System

| ID | Requirement | Priority |
|----|-------------|----------|
| NT-1 | Create free-form notes (rich text, same editor core) | M |
| NT-2 | Tags and simple categories (characters, places, ideas, research) | S |
| NT-3 | Link a note to one or more chapters | M |
| NT-4 | Todo state on notes and on standalone tasks: todo / doing / done | M |
| NT-5 | Todo overview: list or board view grouped by state | M |
| NT-6 | Idea connections: `[[wiki-style]]` links between notes | S |
| NT-7 | Side panel to view notes next to the editor while writing | S |
| NT-8 | Visual idea map / graph | C |

### 4.4 Views

| ID | Requirement | Priority |
|----|-------------|----------|
| VW-1 | **Writing view:** editor with optional sidebar and notes panel. The full toolbar is open until she closes it (8 October). Settings → Paper chooses one continuous page or sheets of A4 or A5 (owner, 8 October): on sheets the text flows from one to the next where it would print, with the desk between them and each one numbered; Zen stays one continuous page, and the Word file takes the same paper. The toolbar's View group ("Pogled") chooses the paper too and opens Zen, in the full toolbar and the short one; on a laptop's screen the full toolbar folds its alignments into one menu, as Word's ribbon does, so it stays one row | M |
| VW-2 | **Book view:** read-only paginated preview with configurable page size (e.g. 5x8 in, A5), facing pages. Since 8 October it is set as a printed book (owner): page 1 on the right, the narrower margin at the spine and the deeper one at the foot, justified text with first-line indents flowing from page to page with no single line left alone at a page's foot or head, each chapter opening a new page, running heads (the book's title on the left, the chapter's on the right) and page numbers | S |
| VW-3 | **Outline view:** chapters as cards with synopsis and status (the status hidden for now, see CH-6). Since 8 October (owner): cards or a list (remembered), each with its number, title, words toward its goal, synopsis, part and goal; chapters dragged into order or moved with the arrow keys on their handle, renamed with a double click, opened in Write; a new chapter named where it appears; parts as headings | S |
| VW-4 | **Dashboard:** project cards, progress, todo summary, recently edited | M |
| VW-5 | Editable book view (type directly in paginated layout) | C |

### 4.5 Zen Mode

| ID | Requirement | Priority |
|----|-------------|----------|
| ZN-1 | Toggle fullscreen with all UI hidden except the text. Since 6 October, at the owner's Grammarly example, a quiet bar stays at the bottom (ZN-5) | M |
| ZN-2 | Centered text column with adjustable width | M |
| ZN-3 | Themes: light, sepia, dark | M |
| ZN-4 | Optional typewriter scrolling (cursor stays vertically centered) | C |
| ZN-5 | Hover at screen edge to reveal minimal controls; Esc to exit. The owner chose an always-visible quiet bar instead (6 October): bold, italic, underline, headings, lists, the word count, the column width and Leave zen | M |

### 4.6 Saving, Backup, and Export

| ID | Requirement | Priority |
|----|-------------|----------|
| SV-1 | Autosave to local disk every few seconds after changes and on window close | M |
| SV-2 | Crash-safe writes (write to temp file, then atomic rename) | M |
| SV-3 | Automatic local backups: rolling snapshots (e.g. hourly, daily) with easy restore | M |
| SV-4 | Version history per chapter (restore older text) | S |
| SV-5 | User-selectable project location (e.g. Documents or a synced folder) | M |
| SV-6 | Export project or chapters to .docx | M |
| SV-7 | Export to PDF, Markdown, plain text | S |
| SV-11 | "Copy as clean HTML / Markdown" and HTML export, for pasting finished articles into a blog | S |
| SV-8 | Import from .docx (split into chapters by headings) | S |
| SV-9 | Backup of snapshots to a Google Drive-synced folder (see Section 8) | S |
| SV-12 | Direct Google Drive backup through the Drive API | C |
| SV-10 | EPUB export | C |

### 4.7 Atmosphere and Cozy UX

Coziness is the top product priority. All effects must stay within the performance budget in Section 5.

| ID | Requirement | Priority |
|----|-------------|----------|
| AT-1 | Smooth transitions between views, panels, and zen mode (soft fades and slides) | M |
| AT-2 | Warm themes (paper, sepia, dark, candlelit) with bundled serif writing fonts. The app has Daylight, Sunset (owner, 7 October), Candlelit and Moonlit, and Day and night, which is Daylight by day and Candlelit after dark | M |
| AT-3 | Ambient sound: a few looping tracks (rain, fireplace, cafe, soft piano) with volume and fade controls. Pensieve always starts quiet; the volume starts at 10 of 100, and the slider's 100 plays at half of full loudness, never more (owner, 8 October) | S |
| AT-4 | Subtle visual ambience: slow gradients, vignette, paper texture, optional drifting particles or candle flicker | S |
| AT-5 | Theme bundles pairing colors, font, and ambience (e.g. "Rainy Library", "Fireside") | C |
| AT-6 | "Gentle mode" toggle that disables particles and heavy effects; honors the Windows "reduce animations" setting. It leaves the chosen ambience playing (7 October): Silence is how the sound goes off | M |
| AT-7 | Optional Harry Potter-flavored labels for features (e.g. Zen mode = "Nox", Notes = "Pensieve" panel, Todos = "Remembrall"); off by default, switchable in settings | C |
| AT-8 | A pomodoro in the floating bar (owner, 8 October): a click starts the writing time with a clock's tick-tock, then a soft chime, a word on the page and a break, and a chime when the break ends. While it runs, icons pause or resume it, start the phase again and stop it, and Zen shows its time. Its lengths (25 and 5 minutes to start with) are in Settings → Writing & goals. The floating bar no longer shows the words in the book, the language or Saved (the title bar says when all is saved; a problem saving still shows in the bar) | S |
| AT-9 | Keystroke sounds as she types on the page (owner, 8 October): off to start with; Settings → Ambience chooses a typewriter (keys strike, space thumps, Enter returns the carriage with its bell), a mechanical keyboard or a soft one, each a recording the owner chose (Mechvibes packs, static/keys/CREDITS.txt), a keyboard with a sound for each key; its own volume at up to half. Shortcuts and arrows stay quiet, and a key is no slower with them on | C |
| AT-10 | Smooth typing (owner, 8 October; Settings → Appearance, on to start with; its own switch, which Gentle mode leaves alone, 9 October): the caret glides to where the next letter goes and blinks only once she pauses, and each letter inks in under a fading veil of paper, as in Word. Drawn over the page, never in the text, so a key is no slower even on a long chapter; it moves even where Windows animations are off, since she chose it | S |

### 4.8 Settings and Polish

| ID | Requirement | Priority |
|----|-------------|----------|
| ST-1 | Default font, size, line spacing, page margins. Since 6 October the text starts at 12 pt, with sizes in points as in Word, lines 1.5 apart, and paragraphs a little apart with no first-line indent | S |
| ST-2 | Language selection. The interface starts in Slovenian (owner, 6 October); English is in Settings | S |
| ST-3 | Daily writing goal and simple streak display. The owner dropped the streak on 5 October. The daily goal went on 6 October and came back that evening, kept simple: the Goals list beside the page in Write shows the words written today toward it (500 to start with, 0 for none), with the chapter's words toward its own goal (CH-6) | C |
| ST-4 | Keyboard shortcut cheat sheet | C |
| ST-5 | Tutorial tips the first time she reaches Home, Write, Notes and the Book: each points at the part it is about and leaves the window free to use, with "Ne prikazuj več namigov" to stop them; Settings → General turns them on and off and shows them all again (owner, 8 October) | S |

## 5. Non-Functional Requirements

- **Performance:** target an older Windows 10 laptop. Cold start under 3 seconds; typing latency imperceptible; manuscripts of 150,000+ words stay responsive (chapters load lazily). Animate only `opacity` and `transform`; avoid animating blur or shadows and limit `backdrop-filter`. Particles and canvas effects are throttled (about 30 fps) and run separately from the editor so ambience never slows typing.
- **Reliability:** no data loss on crash, power loss, or forced quit; autosave failures are surfaced clearly.
- **Install size and speed:** installer in the low tens of MB; one-click install, no admin-heavy setup or runtime prerequisites for the end user.
- **Privacy:** all data local by default; no telemetry; no account required.
- **Usability:** a Word user can write and format within minutes without a tutorial; every action discoverable from the toolbar or menu.
- **Accessibility:** keyboard navigable, adjustable text size, sufficient contrast in all themes.
- **Portability:** Windows 10 or newer is the target (Tauri uses the system WebView2 runtime, included in Windows 11 and installable on Windows 10, ideally bundled in the installer). macOS and Linux remain possible later from the same codebase.
- **Maintainability:** small, well-structured codebase that a single developer can maintain.

## 6. Proposed Architecture

| Layer | Choice | Reason |
|-------|--------|--------|
| Shell | **Tauri** | Small installers, fast startup, native file access |
| UI framework | **Svelte** (TypeScript) | Ships less code and runs faster on older hardware; built-in transitions suit the cozy goal |
| Ambience | CSS animations, small throttled canvas, HTML audio | Cheap on CPU and GPU |
| Editor core | **TipTap** (ProseMirror) | Mature rich text, extensible, Word-like behavior |
| Pagination (book view, Pages in Write) | Measured in the page itself: the Book view cuts each chapter's blocks into pages, and Write adds empty blocks where a sheet ends, worked out once typing pauses | No dependency; typing never waits for it |
| Local storage | SQLite (via Tauri SQL plugin) or a folder of JSON/HTML files | See Section 7 |
| DOCX export | `docx` library | Programmatic Word generation |
| Spell check | WebView2 built-in spell check if it supports Slovenian; otherwise Hunspell dictionaries (en, sl) via a JS library such as nspell | Must be verified early (see risks) |
| Native backend | Rust (Tauri commands) | File I/O, backups, window control |

Principle: keep the Rust side thin (file system, backups, windows) and put app logic in TypeScript.

## 7. Data Model and Storage

**Entities:** Project, Chapter (ordered, optional parent), Note, Task, Tag, Link (note to chapter / note to note), Snapshot (version history), Settings.

**Storage options:**

1. **SQLite single file per project** (recommended). One portable file; transactions give strong crash safety; easy queries for search, tags, and todos; simple to back up and, later, to sync.
2. **Folder of files** (one file per chapter, plus JSON for metadata). Human-readable and friendly to existing sync tools, but weaker consistency and harder to query.

Chapter content is stored as TipTap/ProseMirror JSON (lossless) with a derived HTML or plain-text copy for search and export. Add a schema version number from day one to allow future migrations.

## 8. Cloud Backup (Google Drive)

The writer already uses Google Drive, so backups target it.

**Important rule:** the live project file stays on the **local disk** (in the app's data folder or Documents), *not* inside the Google Drive folder. Sync clients can upload a database file mid-write or create "conflicted copy" duplicates, which risks corruption. Instead, the app writes **snapshots** (a compressed copy of the project) into a backup folder that Google Drive for desktop syncs.

Plan:

1. **v1: Drive-synced backup folder.** The user picks a folder inside her "Google Drive" folder (Drive for desktop must be installed). The app writes timestamped snapshot files there, keeps the last N, and shows "last backup: time, success or failure". No cloud code needed.
2. **Later: direct Drive API** (OAuth, restricted to the app's own folder) so backups work without Drive for desktop. Optional.
3. **Optional:** encrypt snapshots before they leave the machine.

Design hooks for the future: all persistence sits behind a storage interface (`save`, `load`, `list snapshots`, `restore`); snapshots are immutable; restore from a snapshot is a tested feature, not an afterthought.

## 9. UX Principles

- **Calm first:** muted palette, generous whitespace, one primary action per screen.
- **Familiar:** toolbar icons and menu names match Word where possible.
- **Cozy motion:** gentle, short transitions; nothing flashy or sudden.
- **Quiet defaults:** no pop-ups, no nagging; errors are gentle but never hidden.
- **Content over chrome:** panels collapse; the text is always the hero.
- **Dashboard:** project cards, a "continue writing" button, small progress bars, todo count.

## 10. Roadmap

| Phase | Scope | Outcome |
|-------|-------|---------|
| **0. Foundations** | Tauri + TipTap scaffold, project structure, SQLite storage, autosave, spell-check test for English and Slovenian | Typing is saved safely; spell check approach confirmed |
| **1. Writing core** | Toolbar, formatting, word count, chapters sidebar, zen mode, warm themes, smooth transitions | Usable daily writing tool |
| **2. Organization** | Dashboard, notes, tags, chapter links, todo board, local snapshots | Whole-manuscript workflow |
| **3. Views and export** | Book view, outline view, .docx and PDF export, .docx import | Complete v1 |
| **4. Cloud** | Snapshots to a Google Drive-synced folder; optional direct Drive API later | Off-site safety |
| **5. Polish** | Ambient sound and visuals, Gentle mode, version history UI, goals, settings, installer | Release quality |

## 11. Risks and Open Questions

**Risks**
- *Book view pagination* is technically the hardest feature; mitigate by shipping a read-only preview first.
- *Word fidelity:* .docx round-trips are never perfect; set expectations and test with real documents.
- *Slovenian spell check:* the built-in WebView2 spell checker depends on installed Windows languages and may not cover Slovenian reliably. Verify in Phase 0; fall back to bundled Hunspell dictionaries (English and Slovenian).
- *Scope creep:* the main risk to a "cozy and simple" product; enforce the MoSCoW list.
- *Data loss:* mitigate with atomic writes, snapshots, and tested restore.

**Resolved**
- Target OS: Windows 10 or newer.
- Interface language: switchable between English and Slovenian, starting in Slovenian (owner, 6 October).
- Writing languages: English and Slovenian, with spell check.
- Content types: novels, short stories, non-fiction, plus blog posts and articles, as writings of a project, with no types (owner, 7 October).
- Projects and the library (owner, 7 October): a library folder of projects; a project holds as many writings as she wants, optionally in writing folders ("Drafts", "Published"); notes and to-dos belong to the project; Home's Continue writing opens the item opened last. Home itself is to be redone later, around projects.
- Cloud: Google Drive.
- Distribution: personal use only, so installer signing and licensing are not needed.
- The chapter list stays as a tab beside the library, looking like the library's tree (owner, 8 October).

**Still open**
1. Windows version (10 or 11) and RAM of the laptop, to set the effects budget. The laptop is an HP ProBook 650 G2 (owner, 8 October): a 2016 15.6-inch laptop, usually with a 6th-generation Core i5, whose screen is 1366×768 or 1920×1080 (about 1536×864 at Windows' usual 125%), so layouts are checked at 1366 and 1536 pixels wide.
2. Which Word features beyond the current list are must-haves (shortlist provided separately).
3. Does the writer use Word's page numbers, headers, or a table of contents in her manuscripts?

## 12. Naming

**Chosen name: Pensieve.** In Harry Potter, the Pensieve is the basin where thoughts and memories are stored and revisited, which matches what the app does: gathering, storing, and connecting ideas and text.

Notes:
- Other Harry Potter-inspired labels (Nox for zen mode, Remembrall for todos, Common Room for the cozy ambience) are optional and off by default (AT-7).
- *Pensieve* is a trademarked term from the books. That is fine for a personal gift. If the app is ever distributed publicly, consider a generic name instead.
- Earlier candidates considered: Selah, Patmos, Ezra, Baruch, Siloam, Kairos, Manna, Bezalel, Genesis, Flourish, The Common Room.

## 13. Success Criteria

- She can write, organize, and export a chapter in her first session without help.
- No lost work over months of use, including after crashes.
- The app launches quickly, runs smoothly on her computer, and she chooses it over Word for her writing.

---

*End of document.*
