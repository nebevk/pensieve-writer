<script lang="ts">
  import type { ManuscriptFont, PageWidth, Prefs, ThemeName } from "$lib/prefs";
  import type { WritingLanguage } from "$lib/model";

  let {
    prefs,
    backupMessage,
    projectLocation,
    projectLanguage,
    dictionary,
    onChange,
    onChooseFolder,
    onBackup,
    onMoveProject,
    onProjectLanguage,
    onAddWord,
    onExport,
    onImport,
    onClose,
  }: {
    prefs: Prefs;
    backupMessage: string;
    projectLocation: string;
    projectLanguage: WritingLanguage;
    dictionary: { language: WritingLanguage; word: string }[];
    onChange: (patch: Partial<Prefs>) => void;
    onChooseFolder: () => void;
    onBackup: () => void;
    onMoveProject: () => void;
    onProjectLanguage: (language: WritingLanguage) => void;
    onAddWord: (language: WritingLanguage, word: string) => void;
    onExport: () => void;
    onImport: (file: File) => void;
    onClose: () => void;
  } = $props();

  type Section = "General" | "Writing & goals" | "Appearance" | "Ambience" | "Backup & export" | "Language";

  const sections: Section[] = [
    "General",
    "Writing & goals",
    "Appearance",
    "Ambience",
    "Backup & export",
    "Language",
  ];

  let section = $state<Section>("Appearance");
  let dictionaryDraft = $state("");
  let dictionaryLanguage = $state<WritingLanguage>("en");

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
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => event.stopPropagation()}
  >
    <header>
      <span id="settings-title">Settings</span>
      <button type="button" class="close" title="Close" onclick={onClose}>×</button>
    </header>
    <div class="body">
      <nav>
        {#each sections as item (item)}
          <button type="button" class:active={section === item} onclick={() => (section = item)}>{item}</button>
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
              <option value="fire">Fire</option>
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
            <button type="button" onclick={onExport}>Export Word</button>
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
          <p class="path">{prefs.backupFolder || "No backup folder chosen"}</p>
          <div class="actions">
            <button type="button" onclick={onChooseFolder}>Choose folder</button>
            <button type="button" onclick={onBackup} disabled={!prefs.backupFolder}>Back up now</button>
          </div>
          {#if backupMessage}
            <p class="hint">{backupMessage}</p>
          {/if}
        {:else}
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
              <li>{entry.language === "sl" ? "Slovenian" : "English"} · {entry.word}</li>
            {/each}
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
