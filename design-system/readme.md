# Pensieve design system

Pensieve is a minimalist desktop writing app for long-form work: books split into chapters, notes (characters, places, research) with their own to-dos, a to-do board, Zen mode and per-project writing languages (EN, SL, …). This folder is the design system for building it: tokens, React primitives, specimen cards and a click-through UI kit.

**Source:** `Pensieve Directions.dc.html` in this project, rounds 3 and 4 (3a Daylight, 3b All tools, 3c Candlelit, 3d Settings, 4a Moonlit, 4b Notes, 4c To-dos) plus the Home screen from 2c. Earlier rounds (1a–2b) are superseded. The visual starting point was the Organic design system; Pensieve keeps its warm palette and soft circles (Home and Settings only) and replaces its heavy rounding with paper-and-desk styling.

**Not designed yet:** Outline view, Book view, Zen mode layout, Settings sections other than Appearance. The UI kit shows these as "Not designed yet".

## Using it in code (Cursor)

1. Link `styles.css` once. It only `@import`s `tokens/*.css`.
2. Set the theme on `<html>`: `data-theme="daylight" | "candlelit" | "moonlit"`. No attribute = daylight. Themes can also be scoped to any subtree (the Settings theme swatches do this).
3. Use the components in `components/**`. Each has `<Name>.jsx` (React, inline styles over `var(--pv-*)`), `<Name>.d.ts` (props) and `<Name>.prompt.md` (usage).
4. Hover, pressed and focus states come from utility classes in `tokens/base.css` (`.pv-i`, `.pv-solid`, `.pv-tab`, `.pv-lift`, `.pv-f`). Keep them on interactive elements.
5. `ds-loader.js` is only for the preview cards and UI kit (it compiles the JSX in the browser). Don't ship it.

## Index

- `styles.css` — entry point (imports only)
- `tokens/colors.css` — all colour, grain and shadow tokens, per theme
- `tokens/typography.css`, `tokens/spacing.css` — type, sizes, radii, dimensions, motion
- `tokens/fonts.css` — Google Fonts import
- `tokens/base.css` — resets, link colours, interaction-state classes, range slider
- `components/core` — Icon, Button, Tag, LangBadge, SavedIndicator, BrandMark, DecorCircles
- `components/chrome` — TitleBar, ViewTabs, Toolbar, ToolButton, ToolDivider, ToolGroup, StyleSelect, FloatingBar
- `components/navigation` — ChapterList, ChapterItem, StatusDot, SidebarItem, SectionLabel, AsideList
- `components/forms` — Segmented, SearchField, Toggle, Slider, Checkbox, FontChoice, ThemeSwatch, SettingRow
- `components/manuscript` — Desk, Sheet, Paragraph, Caret
- `components/notes` — NoteCard, NoteLink, TodoItem, TodoSlip, BoardColumn, QuickAdd
- `components/home` — Stat, ContinueCard, ProjectCard, NewProjectTile
- `guidelines/` — foundation specimen cards (colour, type, spacing, elevation, surfaces)
- `ui_kits/desktop/` — click-through app: Home → Write (quiet / all tools) → Notes → To-dos, Settings window with live theme switching
- `SKILL.md` — agent skill wrapper

## Content fundamentals

- Plain, calm, literary. The app speaks like a good editor's margin note, not a productivity tool.
- Sentence case everywhere: "All tools", "Continue writing", "Add a to-do…", "Start something new". Uppercase only as tracked eyebrows (CHARACTERS, CHAPTER THREE).
- Address the writer as "you" implicitly; avoid "I". Home greets with a line about the book itself: "Good evening. Ana is still in the kitchen."
- Numbers are concrete and small: "340 / 500 words today", "9 day streak", "1.4k", "22×". No percentages on chrome.
- Status words: Saved, Saving…, Final, Revising, Draft, To do, Doing, Done.
- Ellipsis for prompts ("Add a to-do…"), middle dot · as separator ("Grandmother's Keys · edited 2 h ago").
- No emoji. Unicode used as glyphs only where typographic: “ (quote tool), * * (scene break), ¹ (footnote), [[ ]] (note link), × (count).
- Manuscript copy is the writer's own; never style or rewrite it.

## Visual foundations

- **Metaphor:** a sheet of paper on a desk. Chrome is quiet; the page is the brightest thing on screen.
- **Colour:** three themes. Daylight — cream chrome `#f3eee5`, sand desk, white-cream paper, terracotta `#a94f2e` accent, sage `#5f7a5c` for done/saved. Candlelit — dark walnut chrome, amber `#e0975a` accent, paper toned like lamplight. Moonlit — ink-blue chrome, violet `#a99cf5` accent, cool blue-white paper, teal success. Accent is reserved for the active tab underline, add (+) actions, the caret, drop cap, chapter label, note links and the one primary button.
- **Two colour worlds:** chrome tokens (`--pv-text*`, `--pv-line*`) for window UI; ink tokens (`--pv-ink*`) for anything printed on paper (sheets, note cards, slips, project title pages). Paper stays light in every theme, so ink is always dark.
- **Type:** Young Serif (headings, weight 400 only), Hanken Grotesk (all UI, 400–700), Literata (manuscript and note body; EB Garamond and system mono are options). UI text is small: 12.5–14px.
- **Corners:** small. 3px tools/rows/chips, 4px buttons and segmented controls, 5px floating bar, 6px windows. Paper is square (0). Pills only for toggles.
- **Lines:** 1px hairlines between regions (`--pv-line`). A 1.5px accent-tinted rule under a note's kind label. No outlines around the page.
- **Elevation:** only paper casts shadow, in three soft layers (`--pv-shadow-sheet`). The next sheet peeks out underneath, offset 5/6px and rotated 0.6°. Dark themes use deeper, neutral black shadows.
- **Texture:** a faint fractal-noise grain on all paper (`--pv-grain`, toggle in Settings). Dark themes add a vignette to the sheet and a radial lamp glow on the desk behind it (`--pv-glow`).
- **Decoration:** Organic's soft circles (`DecorCircles`) appear only on Home and Settings. Never behind the manuscript, notes or board.
- **Layout:** fixed chrome — 34px title bar, 40px toolbar, 232px chapter sidebar (260px for notes), 250px context column. Content centres on the desk. Floating bar is pinned bottom-centre over the desk.
- **Hover:** background tints to `--pv-selected`; pressed `--pv-pressed`. Solid buttons brighten 8% on hover, darken on press. Tabs darken text on hover. Project cards lift 2px.
- **Focus:** 2px accent outline, 2px offset. Never the browser default.
- **Motion:** short and quiet. 120ms colour fades, 180ms lifts and toggles with `cubic-bezier(.2,.7,.2,1)`, 400ms for theme changes. No bounces. Respect reduced motion.
- **Transparency/blur:** none on chrome. Only the glow and decor circles use alpha; the Settings scrim dims the window.
- **Imagery:** none in the product so far. If photographs are added, follow Organic's washed treatment.

## Iconography

- Lucide (https://lucide.dev), outline, stroke 1.75, round caps and joins. 15px in toolbars, 13px in the floating bar and saved indicator, 18px in the Home header. Stroke 2–2.25 only inside small solid buttons.
- The paths used by the designs are embedded in `components/core/Icon.jsx` (`Icon.names` lists them). For more icons, install `lucide-react` and keep stroke 1.75.
- Some tools are typographic glyphs, not icons: B, I (Literata italic), U, S, x², “, * *, ¹, [[ ]].
- No icon font, no PNG icons, no emoji.
- There is no logo file. The mark is a 3px-rounded square with "P" in Young Serif, inverted per theme (`BrandMark`).

## Intentional additions

- `Icon` — wraps the Lucide paths the designs use.
- `DecorCircles` — packages the Home/Settings circles so they don't leak onto writing views.
- `ThemeSwatch` "Follow sunset" — from 3d; switches Daylight → Candlelit after dark.

## Fonts

All families are Google Fonts (OFL) loaded from Google's CDN. For the desktop build, self-host Literata, Young Serif, Hanken Grotesk and EB Garamond and replace `tokens/fonts.css` with `@font-face` rules.
