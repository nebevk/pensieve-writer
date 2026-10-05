<script lang="ts">
  import type { ManuscriptFont, PageWidth, Prefs, ThemeName } from "$lib/prefs";
  import type { WritingLanguage } from "$lib/model";
  import type { UiKey } from "$lib/i18n";
  import { ago, plural, t } from "$lib/ui.svelte";
  import Icon from "$lib/editor/Icon.svelte";

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

  const themes: { id: ThemeName; key: UiKey }[] = [
    { id: "daylight", key: "themeDaylight" },
    { id: "candlelit", key: "themeCandlelit" },
    { id: "moonlit", key: "themeMoonlit" },
    { id: "sunset", key: "themeSunset" },
  ];

  const fonts: { id: ManuscriptFont; label: string; family: string; size: number }[] = [
    { id: "literata", label: "Literata", family: "var(--pv-font-manuscript)", size: 20 },
    { id: "garamond", label: "Garamond", family: "var(--pv-font-garamond)", size: 21 },
    { id: "typewriter", label: "Typewriter", family: "var(--pv-font-typewriter)", size: 18 },
  ];

  const widths: PageWidth[] = ["narrow", "book", "wide"];

  function widthLabel(width: PageWidth): string {
    if (width === "narrow") return t("widthNarrow");
    if (width === "wide") return t("widthWide");
    return t("widthBook");
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
      <span id="settings-title">{t("settings")}</span>
      <button type="button" class="close" title={t("close")} aria-label={t("close")} onclick={onClose}><Icon name="x" /></button>
    </header>
    <div class="body">
      <nav>
        {#each sections as item (item.id)}
          <button type="button" class:active={section === item.id} onclick={() => (section = item.id)}>{t(item.key)}</button>
        {/each}
        <span class="blob one" aria-hidden="true"></span>
        <span class="blob two" aria-hidden="true"></span>
      </nav>

      <div class="pane">
        {#if section === "Appearance"}
          <h2>{t("appearance")}</h2>
          <p class="lab">{t("theme")}</p>
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
                <span class:chosen={prefs.theme === theme.id}>{t(theme.key)}</span>
              </button>
            {/each}
          </div>

          <p class="lab">{t("manuscriptFont")}</p>
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
                <span class="font-name">{font.id === "typewriter" ? t("fontTypewriter") : font.label}</span>
              </button>
            {/each}
          </div>

          <div class="split">
            <label class="slider">
              <span>{t("textSize")} <b>{prefs.manuscriptSize} px</b></span>
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
              <p class="lab">{t("pageWidth")}</p>
              <div class="segment" role="radiogroup" aria-label={t("pageWidth")}>
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
              <span>{t("paperGrain")}</span>
              <button type="button" class="toggle" class:on={prefs.grain} role="switch" aria-checked={prefs.grain} aria-label={t("paperGrain")} onclick={() => onChange({ grain: !prefs.grain })}>
                <span></span>
              </button>
            </div>
            <div class="row">
              <span>{t("runningHeadRow")}</span>
              <button type="button" class="toggle" class:on={prefs.runningHead} role="switch" aria-checked={prefs.runningHead} aria-label={t("runningHead")} onclick={() => onChange({ runningHead: !prefs.runningHead })}>
                <span></span>
              </button>
            </div>
            <div class="row last">
              <span>{t("typewriterScrolling")} <em>· {t("typewriterScrollingNote")}</em></span>
              <button type="button" class="toggle" class:on={prefs.typewriter} role="switch" aria-checked={prefs.typewriter} aria-label={t("typewriterScrolling")} onclick={() => onChange({ typewriter: !prefs.typewriter })}>
                <span></span>
              </button>
            </div>
          </div>
        {:else if section === "General"}
          <h2>{t("general")}</h2>
          <div class="rows">
            <div class="row last">
              <span>{t("gentleMode")} <em>· {t("gentleModeNote")}</em></span>
              <button type="button" class="toggle" class:on={prefs.gentle} role="switch" aria-checked={prefs.gentle} aria-label={t("gentleMode")} onclick={() => onChange({ gentle: !prefs.gentle })}>
                <span></span>
              </button>
            </div>
          </div>
          <p class="lab">{t("interfaceLanguage")}</p>
          <div class="segment" role="radiogroup" aria-label={t("interfaceLanguage")}>
            <button type="button" class:on={prefs.uiLanguage === "en"} onclick={() => onChange({ uiLanguage: "en" })}>English</button>
            <button type="button" class:on={prefs.uiLanguage === "sl"} onclick={() => onChange({ uiLanguage: "sl" })}>Slovenščina</button>
          </div>
          <p class="lab">{t("exampleBooks")}</p>
          <p class="hint">{t("exampleBooksHint")}</p>
          <div class="actions">
            <button type="button" onclick={onAddExamples}>{t("addExampleBooks")}</button>
          </div>
          {#if backupMessage}
            <p class="hint">{backupMessage}</p>
          {/if}
        {:else if section === "Writing & goals"}
          <h2>{t("goals")}</h2>
          <label class="field">
            {t("dailyGoal")}
            <input
              type="number"
              min="0"
              value={prefs.dailyGoal}
              oninput={(event) =>
                onChange({ dailyGoal: Number((event.currentTarget as HTMLInputElement).value) || 0 })}
            />
          </label>
          <p class="hint">{t("dailyGoalHint")}</p>
        {:else if section === "Ambience"}
          <h2>{t("ambience")}</h2>
          <label class="field">
            {t("sound")}
            <select
              value={prefs.ambience}
              onchange={(event) =>
                onChange({ ambience: (event.currentTarget as HTMLSelectElement).value as Prefs["ambience"] })}
            >
              <option value="off">{t("soundOff")}</option>
              <option value="rain">{t("soundRain")}</option>
              <option value="fire">{t("soundFireplace")}</option>
              <option value="cafe">{t("soundCafe")}</option>
              <option value="piano">{t("soundPiano")}</option>
            </select>
          </label>
          <label class="slider">
            <span>{t("volume")} <b>{Math.round(prefs.ambienceVolume * 100)}</b></span>
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
          <h2>{t("backup")}</h2>
          <p class="hint">{t("backupHint")}</p>
          <p class="path">{projectLocation || t("appFolder")}</p>
          <div class="actions">
            <button type="button" onclick={onMoveProject}>{t("moveProject")}</button>
            <button type="button" onclick={onExport}>{t("exportWord")}</button>
            <button type="button" onclick={() => onExportText("markdown")}>{t("exportMarkdown")}</button>
            <button type="button" onclick={() => onExportText("plain")}>{t("exportPlain")}</button>
            <button type="button" onclick={onCopyHtml}>{t("copyHtml")}</button>
            <button type="button" onclick={onPrint}>{t("printPdf")}</button>
            <label class="file">
              {t("importWord")}
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
            <div class="offer" role="alertdialog" aria-label={t("importWordLabel")}>
              <p>
                {t("importSummary", {
                  file: importPreview.fileName,
                  chapters: plural("chapters", importPreview.chapters.length),
                  words: plural("words", words),
                })}
              </p>
              <ol class="found">
                {#each importPreview.chapters.slice(0, 12) as chapter, index (index)}
                  <li>{chapter.title} <span>· {plural("words", chapter.words)}</span></li>
                {/each}
              </ol>
              {#if importPreview.chapters.length > 12}
                <p class="hint">{t("andMore", { n: importPreview.chapters.length - 12 })}</p>
              {/if}
              <p class="hint">{t("importHint")}</p>
              <div class="actions">
                <button type="button" onclick={() => onConfirmImport("replace")}>{t("replaceChapters")}</button>
                <button type="button" onclick={() => onConfirmImport("append")}>{t("addAsNewChapters")}</button>
                <button type="button" onclick={onCancelImport}>{t("cancel")}</button>
              </div>
            </div>
          {/if}
          <p class="lab">{t("wordCopy")}</p>
          <p class="hint">{t("wordCopyHint", { file: bookTitle || t("untitled") })}</p>
          <p class="path">{prefs.wordCopyFolder || t("noWordCopyFolder")}</p>
          <div class="actions">
            <button type="button" onclick={onChooseWordFolder}>{t("chooseFolderEllipsis")}</button>
            <button type="button" onclick={onUpdateWordCopy} disabled={!prefs.wordCopyFolder}>{t("updateNow")}</button>
            {#if prefs.wordCopyFolder}
              <button type="button" onclick={onStopWordCopy}>{t("stop")}</button>
            {/if}
          </div>
          {#if prefs.wordCopyFolder && prefs.wordCopyError}
            <p class="hint problem" role="alert">{prefs.wordCopyError}</p>
          {:else if prefs.wordCopyFolder && prefs.wordCopyAt}
            <p class="hint">{t("updatedAgo", { ago: ago(prefs.wordCopyAt) })}</p>
          {/if}
          <p class="lab">{t("backups")}</p>
          <p class="path">{prefs.backupFolder || t("noBackupFolder")}</p>
          <div class="actions">
            <button type="button" onclick={onChooseFolder}>{t("chooseFolder")}</button>
            <button type="button" onclick={onBackup} disabled={!prefs.backupFolder}>{t("backUpNow")}</button>
            <button type="button" onclick={onPickBackup}>{t("restoreFromBackup")}</button>
          </div>
          {#if backupOffer}
            <div class="offer" role="alertdialog" aria-label={t("restoreFromBackupLabel")}>
              <p>
                {t("restoreQuestion", { title: backupOffer.title, date: backupOffer.savedAt })}
                {#if backupOffer.otherBook}
                  {t("otherBookBackup")}
                {/if}
              </p>
              <p class="hint">{t("restoreHint")}</p>
              <div class="actions">
                <button type="button" onclick={onRestoreBackup}>{t("restore")}</button>
                <button type="button" onclick={onCancelBackup}>{t("cancel")}</button>
              </div>
            </div>
          {/if}
          {#if backupMessage}
            <p class="hint">{backupMessage}</p>
          {/if}
        {:else if section === "Language"}
          <h2>{t("language")}</h2>
          <p class="lab">{t("projectLanguage")}</p>
          <div class="segment" role="radiogroup" aria-label={t("projectLanguage")}>
            <button type="button" class:on={projectLanguage === "en"} onclick={() => onProjectLanguage("en")}>{t("english")}</button>
            <button type="button" class:on={projectLanguage === "sl"} onclick={() => onProjectLanguage("sl")}>{t("slovenian")}</button>
          </div>
          <p class="hint">{t("projectLanguageHint")}</p>
          <p class="lab">{t("personalDictionary")}</p>
          <form
            class="actions"
            onsubmit={(event) => {
              event.preventDefault();
              onAddWord(dictionaryLanguage, dictionaryDraft);
              dictionaryDraft = "";
            }}
          >
            <select bind:value={dictionaryLanguage} aria-label={t("dictionaryLanguage")}>
              <option value="en">{t("english")}</option>
              <option value="sl">{t("slovenian")}</option>
            </select>
            <input bind:value={dictionaryDraft} aria-label={t("wordToKeep")} placeholder={t("addAWord")} />
            <button type="submit">{t("add")}</button>
          </form>
          <ul>
            {#each dictionary as entry (`${entry.language}:${entry.word}`)}
              <li>
                {entry.language === "sl" ? t("slovenian") : t("english")} · {entry.word}
                <button type="button" onclick={() => onRemoveWord(entry.language, entry.word)}>{t("remove")}</button>
              </li>
            {/each}
          </ul>
          <p class="hint">{t("dictionaryHint")}</p>
        {:else if section === "Shortcuts"}
          <h2>{t("shortcuts")}</h2>
          <ul class="keys">
            <li><kbd>Ctrl</kbd> + <kbd>B</kbd> {t("bold")}</li>
            <li><kbd>Ctrl</kbd> + <kbd>I</kbd> {t("italic")}</li>
            <li><kbd>Ctrl</kbd> + <kbd>U</kbd> {t("underline")}</li>
            <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> {t("undo")}</li>
            <li><kbd>Ctrl</kbd> + <kbd>Y</kbd> {t("redo")}</li>
            <li><kbd>Ctrl</kbd> + <kbd>S</kbd> {t("save")}</li>
            <li><kbd>Ctrl</kbd> + <kbd>F</kbd> {t("find")}</li>
            <li><kbd>Ctrl</kbd> + <kbd>/</kbd> {t("shortcutThisList")}</li>
            <li><kbd>Esc</kbd> {t("shortcutEscape")}</li>
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
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--pv-text-subtle);
    border-radius: var(--pv-radius-xs);
    padding: 4px;
  }

  .close :global(svg) {
    width: 15px;
    height: 15px;
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

  .file {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }

  .file:hover {
    background: var(--pv-selected);
  }

  .file:focus-within {
    outline: 2px solid var(--pv-accent);
    outline-offset: 2px;
  }

  /* The label is the button; the browser's own file control stays reachable but out of sight. */
  .file input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    color: var(--pv-text-muted);
  }
</style>
