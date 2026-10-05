<script lang="ts">
  import type { ManuscriptFont, PageWidth, Prefs, ThemeName } from "$lib/prefs";
  import type { WritingLanguage } from "$lib/model";
  import { t, type UiKey } from "$lib/i18n";

  let {
    prefs,
    backupMessage,
    projectLocation,
    projectLanguage,
    dictionary,
    startSection = "Appearance",
    onChange,
    onChooseFolder,
    onBackup,
    onMoveProject,
    onProjectLanguage,
    onAddWord,
    onRemoveWord,
    onExport,
    onExportText,
    onCopyHtml,
    onPrint,
    onImport,
    backupOffer = null,
    onPickBackup,
    onRestoreBackup,
    onCancelBackup,
    importPreview = null,
    onConfirmImport,
    onCancelImport,
    bookTitle = "",
    onChooseWordFolder,
    onUpdateWordCopy,
    onStopWordCopy,
    onAddExamples,
    onClose,
  }: {
    prefs: Prefs;
    backupMessage: string;
    projectLocation: string;
    projectLanguage: WritingLanguage;
    dictionary: { language: WritingLanguage; word: string }[];
    startSection?: Section;
    onChange: (patch: Partial<Prefs>) => void;
    onChooseFolder: () => void;
    onBackup: () => void;
    onMoveProject: () => void;
    onProjectLanguage: (language: WritingLanguage) => void;
    onAddWord: (language: WritingLanguage, word: string) => void;
    onRemoveWord: (language: WritingLanguage, word: string) => void;
    onExport: () => void;
    onExportText: (kind: "markdown" | "plain") => void;
    onCopyHtml: () => void;
    onPrint: () => void;
    onImport: (file: File) => void;
    /** A backup file the writer picked, waiting for them to confirm the restore. */
    backupOffer?: { title: string; savedAt: string; otherBook: boolean } | null;
    onPickBackup: () => void;
    onRestoreBackup: () => void;
    onCancelBackup: () => void;
    /** A Word file read and waiting: its chapters, before anything in the book changes. */
    importPreview?: { fileName: string; chapters: { title: string; words: number }[] } | null;
    onConfirmImport: (mode: "replace" | "append") => void;
    onCancelImport: () => void;
    bookTitle?: string;
    onChooseWordFolder: () => void;
    onUpdateWordCopy: () => void;
    onStopWordCopy: () => void;
    onAddExamples: () => void;
    onClose: () => void;
  } = $props();

  function ago(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (Number.isNaN(minutes)) return "";
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    return new Date(iso).toLocaleDateString();
  }

  type Section = "General" | "Writing & goals" | "Appearance" | "Ambience" | "Backup & export" | "Language" | "Shortcuts";

  const sections: { id: Section; key: UiKey }[] = [
    { id: "General", key: "general" },
    { id: "Writing & goals", key: "goals" },
    { id: "Appearance", key: "appearance" },
    { id: "Ambience", key: "ambience" },
    { id: "Backup & export", key: "backup" },
    { id: "Language", key: "language" },
    { id: "Shortcuts", key: "shortcuts" },
  ];

  const themes: { id: ThemeName; label: string }[] = [
    { id: "daylight", label: "Daylight" },
    { id: "candlelit", label: "Candlelit" },
    { id: "moonlit", label: "Moonlit" },
    { id: "sunset", label: "Follow sunset" },
  ];

  const fonts: { id: ManuscriptFont; label: string; family: string; size: number }[] = [
    { id: "literata", label: "Literata", family: "var(--pv-font-manuscript)", size: 20 },
    { id: "garamond", label: "Garamond", family: "var(--pv-font-garamond)", size: 21 },
    { id: "typewriter", label: "Typewriter", family: "var(--pv-font-typewriter)", size: 18 },
  ];

  const widths: PageWidth[] = ["narrow", "book", "wide"];

  function widthLabel(width: PageWidth): string {
    if (width === "narrow") return "Narrow";
    if (width === "wide") return "Wide";
    return "Book";
  }

  let section = $state<Section>("Appearance");
  let panel = $state<HTMLDivElement | undefined>(undefined);
  let dictionaryDraft = $state("");
  let dictionaryLanguage = $state<WritingLanguage>("en");

  $effect(() => {
    section = startSection;
    panel?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
  });

  function trap(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key !== "Tab" || !panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>("button, input, select, textarea")].filter(
      (item) => !item.hasAttribute("disabled") && item.tabIndex !== -1,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<div
  class="scrim"
  role="presentation"
  onclick={onClose}
>
  <div
    class="window"
    role="dialog"
    aria-labelledby="settings-title"
    tabindex="-1"
    bind:this={panel}
    onclick={(event) => event.stopPropagation()}
    onkeydown={trap}
  >
    <header>
      <span id="settings-title">Settings</span>
      <button type="button" class="close" title="Close" onclick={onClose}>×</button>
    </header>
    <div class="body">
      <nav>
        {#each sections as item (item.id)}
          <button type="button" class:active={section === item.id} onclick={() => (section = item.id)}>{t(prefs.uiLanguage, item.key)}</button>
        {/each}
        <span class="blob one" aria-hidden="true"></span>
        <span class="blob two" aria-hidden="true"></span>
      </nav>

      <div class="pane">
        {#if section === "Appearance"}
          <h2>Appearance</h2>
          <p class="lab">Theme</p>
          <div class="swatches">
            {#each themes as theme (theme.id)}
              <button
                type="button"
                class="swatch"
                aria-pressed={prefs.theme === theme.id}
                onclick={() => onChange({ theme: theme.id })}
              >
                <span class="preview">
                  {#if theme.id === "sunset"}
                    <span class="mini" data-theme="daylight" style:clip-path="inset(0 50% 0 0)"></span>
                    <span class="mini" data-theme="candlelit" style:clip-path="inset(0 0 0 50%)"></span>
                  {:else}
                    <span class="mini" data-theme={theme.id}></span>
                  {/if}
                </span>
                <span class:chosen={prefs.theme === theme.id}>{theme.label}</span>
              </button>
            {/each}
          </div>

          <p class="lab">Manuscript font</p>
          <div class="fonts">
            {#each fonts as font (font.id)}
              <button
                type="button"
                class="font"
                class:chosen={prefs.manuscriptFont === font.id}
                aria-pressed={prefs.manuscriptFont === font.id}
                onclick={() => onChange({ manuscriptFont: font.id })}
              >
                <span style:font-family={font.family} style:font-size="{font.size}px">Aa</span>
                <span class="font-name">{font.label}</span>
              </button>
            {/each}
          </div>

          <div class="split">
            <label class="slider">
              <span>Text size <b>{prefs.manuscriptSize} px</b></span>
              <input
                type="range"
                min="13"
                max="24"
                step="1"
                value={prefs.manuscriptSize}
                style:--pv-fill="{((prefs.manuscriptSize - 13) / 11) * 100}%"
                oninput={(event) =>
                  onChange({ manuscriptSize: Number((event.currentTarget as HTMLInputElement).value) })}
              />
            </label>
            <div>
              <p class="lab">Page width</p>
              <div class="segment" role="radiogroup" aria-label="Page width">
                {#each widths as width (width)}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={prefs.pageWidth === width}
                    class:on={prefs.pageWidth === width}
                    onclick={() => onChange({ pageWidth: width })}
                  >
                    {widthLabel(width)}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <div class="rows">
            <div class="row">
              <span>Paper grain</span>
              <button type="button" class="toggle" class:on={prefs.grain} role="switch" aria-checked={prefs.grain} aria-label="Paper grain" onclick={() => onChange({ grain: !prefs.grain })}>
                <span></span>
              </button>
            </div>
            <div class="row">
              <span>Running head and page numbers</span>
              <button type="button" class="toggle" class:on={prefs.runningHead} role="switch" aria-checked={prefs.runningHead} aria-label="Running head" onclick={() => onChange({ runningHead: !prefs.runningHead })}>
                <span></span>
              </button>
            </div>
            <div class="row last">
              <span>Typewriter scrolling <em>· keeps the current line centred</em></span>
              <button type="button" class="toggle" class:on={prefs.typewriter} role="switch" aria-checked={prefs.typewriter} aria-label="Typewriter scrolling" onclick={() => onChange({ typewriter: !prefs.typewriter })}>
                <span></span>
              </button>
            </div>
          </div>
        {:else if section === "General"}
          <h2>General</h2>
          <div class="rows">
            <div class="row last">
              <span>Gentle mode <em>· turns off particles and keeps motion quiet</em></span>
              <button type="button" class="toggle" class:on={prefs.gentle} role="switch" aria-checked={prefs.gentle} aria-label="Gentle mode" onclick={() => onChange({ gentle: !prefs.gentle })}>
                <span></span>
              </button>
            </div>
          </div>
          <p class="lab">Interface language</p>
          <div class="segment" role="radiogroup" aria-label="Interface language">
            <button type="button" class:on={prefs.uiLanguage === "en"} onclick={() => onChange({ uiLanguage: "en" })}>English</button>
            <button type="button" class:on={prefs.uiLanguage === "sl"} onclick={() => onChange({ uiLanguage: "sl" })}>Slovenščina</button>
          </div>
          <p class="lab">Example books</p>
          <p class="hint">
            A novel, a short-story collection in Slovenian and an article, with notes and to-dos, to see how
            Pensieve fills up. They're saved as separate books, so your own books stay as they are.
          </p>
          <div class="actions">
            <button type="button" onclick={onAddExamples}>Add example books</button>
          </div>
          {#if backupMessage}
            <p class="hint">{backupMessage}</p>
          {/if}
        {:else if section === "Writing & goals"}
          <h2>Writing & goals</h2>
          <label class="field">
            Daily word goal
            <input
              type="number"
              min="0"
              value={prefs.dailyGoal}
              oninput={(event) =>
                onChange({ dailyGoal: Number((event.currentTarget as HTMLInputElement).value) || 0 })}
            />
          </label>
          <p class="hint">Shown on Home beside the words already in the book. Leave it at 0 to hide the goal.</p>
        {:else if section === "Ambience"}
          <h2>Ambience</h2>
          <label class="field">
            Sound
            <select
              value={prefs.ambience}
              onchange={(event) =>
                onChange({ ambience: (event.currentTarget as HTMLSelectElement).value as Prefs["ambience"] })}
            >
              <option value="off">Off</option>
              <option value="rain">Rain</option>
              <option value="fire">Fireplace</option>
              <option value="cafe">Café</option>
              <option value="piano">Piano</option>
            </select>
          </label>
          <label class="slider">
            <span>Volume <b>{Math.round(prefs.ambienceVolume * 100)}</b></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={prefs.ambienceVolume}
              style:--pv-fill="{prefs.ambienceVolume * 100}%"
              oninput={(event) =>
                onChange({ ambienceVolume: Number((event.currentTarget as HTMLInputElement).value) })}
            />
          </label>
        {:else if section === "Backup & export"}
          <h2>Backup & export</h2>
          <p class="hint">The live manuscript stays on this computer. Snapshots are the files that can sit in Google Drive.</p>
          <p class="path">{projectLocation || "App folder"}</p>
          <div class="actions">
            <button type="button" onclick={onMoveProject}>Move project…</button>
            <button type="button" onclick={onExport}>Export Word…</button>
            <button type="button" onclick={() => onExportText("markdown")}>Markdown…</button>
            <button type="button" onclick={() => onExportText("plain")}>Plain text…</button>
            <button type="button" onclick={onCopyHtml}>Copy HTML</button>
            <button type="button" onclick={onPrint}>Print / PDF</button>
            <label class="file">
              Import Word
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onchange={(event) => {
                  const file = (event.currentTarget as HTMLInputElement).files?.[0];
                  if (file) onImport(file);
                  (event.currentTarget as HTMLInputElement).value = "";
                }}
              />
            </label>
          </div>
          {#if importPreview}
            {@const words = importPreview.chapters.reduce((sum, chapter) => sum + chapter.words, 0)}
            <div class="offer" role="alertdialog" aria-label="Import a Word file">
              <p>
                “{importPreview.fileName}” has {importPreview.chapters.length}
                {importPreview.chapters.length === 1 ? "chapter" : "chapters"} and {words.toLocaleString()} words:
              </p>
              <ol class="found">
                {#each importPreview.chapters.slice(0, 12) as chapter, index (index)}
                  <li>{chapter.title} <span>· {chapter.words.toLocaleString()} words</span></li>
                {/each}
              </ol>
              {#if importPreview.chapters.length > 12}
                <p class="hint">…and {importPreview.chapters.length - 12} more.</p>
              {/if}
              <p class="hint">
                Replacing keeps a snapshot first. Chapters with the same title keep their notes, status and goal.
              </p>
              <div class="actions">
                <button type="button" onclick={() => onConfirmImport("replace")}>Replace this book's chapters</button>
                <button type="button" onclick={() => onConfirmImport("append")}>Add as new chapters</button>
                <button type="button" onclick={onCancelImport}>Cancel</button>
              </div>
            </div>
          {/if}
          <p class="lab">Word copy</p>
          <p class="hint">
            Pensieve keeps “{bookTitle || "Untitled"}.docx” in this folder up to date whenever you leave the window,
            switch books or close the app. It's a copy to open in Word; bring changes made there back with Import Word.
          </p>
          <p class="path">{prefs.wordCopyFolder || "No folder chosen, so there's no Word copy yet."}</p>
          <div class="actions">
            <button type="button" onclick={onChooseWordFolder}>Choose folder…</button>
            <button type="button" onclick={onUpdateWordCopy} disabled={!prefs.wordCopyFolder}>Update now</button>
            {#if prefs.wordCopyFolder}
              <button type="button" onclick={onStopWordCopy}>Stop</button>
            {/if}
          </div>
          {#if prefs.wordCopyFolder && prefs.wordCopyError}
            <p class="hint problem" role="alert">{prefs.wordCopyError}</p>
          {:else if prefs.wordCopyFolder && prefs.wordCopyAt}
            <p class="hint">Updated {ago(prefs.wordCopyAt)}.</p>
          {/if}
          <p class="lab">Backups</p>
          <p class="path">{prefs.backupFolder || "No backup folder chosen"}</p>
          <div class="actions">
            <button type="button" onclick={onChooseFolder}>Choose folder</button>
            <button type="button" onclick={onBackup} disabled={!prefs.backupFolder}>Back up now</button>
            <button type="button" onclick={onPickBackup}>Restore from a backup…</button>
          </div>
          {#if backupOffer}
            <div class="offer" role="alertdialog" aria-label="Restore from a backup">
              <p>
                Restore “{backupOffer.title}” from the backup saved {backupOffer.savedAt}?
                {#if backupOffer.otherBook}
                  This backup is of a different book than the one open now.
                {/if}
              </p>
              <p class="hint">
                The open book's chapters are replaced by the backup's, and notes or to-dos it no longer has come back.
                A “Before restore” snapshot of the open book is kept first.
              </p>
              <div class="actions">
                <button type="button" onclick={onRestoreBackup}>Restore</button>
                <button type="button" onclick={onCancelBackup}>Cancel</button>
              </div>
            </div>
          {/if}
          {#if backupMessage}
            <p class="hint">{backupMessage}</p>
          {/if}
        {:else if section === "Language"}
          <h2>Language</h2>
          <p class="lab">Project language</p>
          <div class="segment" role="radiogroup" aria-label="Project language">
            <button type="button" class:on={projectLanguage === "en"} onclick={() => onProjectLanguage("en")}>English</button>
            <button type="button" class:on={projectLanguage === "sl"} onclick={() => onProjectLanguage("sl")}>Slovenian</button>
          </div>
          <p class="hint">Chapters can override this from the toolbar. A selection can too.</p>
          <p class="lab">Personal dictionary</p>
          <form
            class="actions"
            onsubmit={(event) => {
              event.preventDefault();
              onAddWord(dictionaryLanguage, dictionaryDraft);
              dictionaryDraft = "";
            }}
          >
            <select bind:value={dictionaryLanguage} aria-label="Dictionary language">
              <option value="en">English</option>
              <option value="sl">Slovenian</option>
            </select>
            <input bind:value={dictionaryDraft} aria-label="Word to keep" placeholder="Add a word" />
            <button type="submit">Add</button>
          </form>
          <ul>
            {#each dictionary as entry (`${entry.language}:${entry.word}`)}
              <li>
                {entry.language === "sl" ? "Slovenian" : "English"} · {entry.word}
                <button type="button" onclick={() => onRemoveWord(entry.language, entry.word)}>Remove</button>
              </li>
            {/each}
          </ul>
          <p class="hint">Removing a word forgets it in Pensieve. Windows may still remember it until the spell checker is reset.</p>
        {:else if section === "Shortcuts"}
          <h2>Shortcuts</h2>
          <ul class="keys">
            <li><kbd>Ctrl</kbd> + <kbd>B</kbd> Bold</li>
            <li><kbd>Ctrl</kbd> + <kbd>I</kbd> Italic</li>
            <li><kbd>Ctrl</kbd> + <kbd>U</kbd> Underline</li>
            <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo</li>
            <li><kbd>Ctrl</kbd> + <kbd>Y</kbd> Redo</li>
            <li><kbd>Ctrl</kbd> + <kbd>S</kbd> Save</li>
            <li><kbd>Ctrl</kbd> + <kbd>F</kbd> Find</li>
            <li><kbd>Ctrl</kbd> + <kbd>/</kbd> This list</li>
            <li><kbd>Esc</kbd> Close settings, find, or Zen</li>
          </ul>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    background: var(--pv-scrim);
  }

  .window {
    width: min(880px, calc(100% - 48px));
    height: min(620px, calc(100% - 48px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--pv-radius-window);
    background: var(--pv-chrome);
    color: var(--pv-text);
    box-shadow: var(--pv-shadow-window);
  }

  header {
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 16px;
    border-bottom: 1px solid var(--pv-line);
    font-size: var(--pv-text-md);
    font-weight: 600;
  }

  header span {
    flex: 1;
  }

  .close {
    border: 0;
    background: transparent;
    color: var(--pv-text-subtle);
    border-radius: var(--pv-radius-xs);
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
  }

  .close:hover,
  nav button:hover,
  .actions button:hover {
    background: var(--pv-selected);
  }

  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  nav {
    position: relative;
    width: var(--pv-settings-nav-w);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 16px 10px;
    border-right: 1px solid var(--pv-line);
    box-sizing: border-box;
  }

  nav button {
    position: relative;
    z-index: 1;
    border: 0;
    background: transparent;
    text-align: left;
    border-radius: var(--pv-radius-xs);
    padding: 7px 10px;
    color: var(--pv-text);
    font-size: var(--pv-text-base);
  }

  nav button.active {
    background: var(--pv-selected);
    font-weight: 600;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .blob.one {
    left: -60px;
    bottom: -80px;
    width: 220px;
    height: 220px;
    background: var(--pv-decor-2);
    opacity: 0.5;
  }

  .blob.two {
    left: 120px;
    bottom: 70px;
    width: 44px;
    height: 44px;
    background: var(--pv-decor-1);
    opacity: 0.6;
  }

  .pane {
    flex: 1;
    overflow: auto;
    padding: 22px 36px 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  h2 {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-xl);
    font-weight: 400;
  }

  .lab {
    margin: 0;
    font-size: var(--pv-text-md);
    font-weight: 600;
    color: var(--pv-text-muted);
  }

  .swatches,
  .fonts,
  .split,
  .actions {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .swatch {
    display: flex;
    flex-direction: column;
    gap: 7px;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    color: var(--pv-text);
    font-size: var(--pv-text-md);
  }

  .preview {
    position: relative;
    display: block;
    width: 150px;
    height: 90px;
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
  }

  .swatch[aria-pressed="true"] .preview {
    outline: 2px solid var(--pv-accent);
    outline-offset: 2px;
  }

  .swatch .chosen {
    font-weight: 600;
  }

  .mini {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: var(--pv-desk);
  }

  .mini::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 70px;
    height: 72px;
    transform: translateX(-50%);
    background: var(--pv-paper);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  .mini[data-theme="daylight"]::after {
    content: "";
    position: absolute;
    right: -20px;
    top: -20px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--pv-decor-1);
  }

  .fonts {
    gap: 8px;
  }

  .font {
    width: 120px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-line-strong);
    background: var(--pv-field);
    color: var(--pv-text);
    text-align: left;
  }

  .font.chosen {
    border: 1.5px solid var(--pv-accent);
  }

  .font-name {
    font-size: var(--pv-text-sm);
    color: var(--pv-text-subtle);
  }

  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    align-items: end;
  }

  .slider {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: var(--pv-text-md);
  }

  .slider span {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    color: var(--pv-text-muted);
  }

  .slider b {
    font-weight: 400;
    color: var(--pv-text-subtle);
  }

  .slider input,
  input[type="range"] {
    appearance: none;
    width: 100%;
    height: 16px;
    background: transparent;
    margin: 0;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 3px;
    background:
      linear-gradient(var(--pv-accent), var(--pv-accent)) 0 / var(--pv-fill, 50%) 100% no-repeat,
      var(--pv-divider);
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6.5px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--pv-accent);
  }

  .segment {
    display: flex;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
  }

  .segment button {
    border: 0;
    background: transparent;
    color: var(--pv-text);
    padding: 5px 14px;
    font-size: var(--pv-text-md);
  }

  .segment button.on {
    background: var(--pv-mark-bg);
    color: var(--pv-mark-fg);
    font-weight: 600;
  }

  .rows {
    border-top: 1px solid var(--pv-line);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 0;
    border-bottom: 1px solid var(--pv-line);
    font-size: var(--pv-text-base);
  }

  .row.last {
    border-bottom: 0;
  }

  em {
    color: var(--pv-text-faint);
    font-style: normal;
    font-size: 12px;
  }

  .toggle {
    width: 32px;
    height: 18px;
    border: 0;
    border-radius: var(--pv-radius-pill);
    background: var(--pv-line-strong);
    padding: 0;
    position: relative;
  }

  .toggle.on {
    background: var(--pv-success-solid);
  }

  .toggle span {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transform: translateX(0);
  }

  .toggle.on span {
    transform: translateX(14px);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: var(--pv-text-md);
    font-weight: 600;
    color: var(--pv-text-muted);
  }

  .field input,
  .field select,
  .actions input,
  .actions select {
    height: 32px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    padding: 0 8px;
    font-weight: 400;
  }

  .offer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--pv-line-strong);
    border-left: 3px solid var(--pv-accent);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
  }

  .offer p {
    margin: 0;
  }

  .found {
    margin: 0;
    padding-left: 1.4rem;
    max-height: 12rem;
    overflow: auto;
    color: var(--pv-text);
  }

  .found span {
    color: var(--pv-text-faint);
  }

  .problem {
    color: var(--danger);
  }

  .hint,
  .path {
    margin: 0;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
  }

  .actions button,
  .file {
    height: 32px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
    color: var(--pv-text);
    padding: 0 12px;
  }

  .file input {
    display: block;
    margin-top: 4px;
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    color: var(--pv-text-muted);
  }
</style>
