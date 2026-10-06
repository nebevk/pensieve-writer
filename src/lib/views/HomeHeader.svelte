<script lang="ts">
  import Icon from "$lib/editor/Icon.svelte";
  import WindowControls from "$lib/editor/WindowControls.svelte";
  import type { Prefs, ThemeName } from "$lib/prefs";
  import type { UiKey } from "$lib/i18n";
  import { ago, t } from "$lib/ui.svelte";

  let {
    prefs,
    now = Date.now(),
    error = "",
    appearance = "daylight",
    settingsOpen = false,
    onLanguage,
    onSettings,
    onTheme,
  }: {
    prefs: Prefs;
    /** The page's minute clock, so "12 min ago" keeps up. */
    now?: number;
    /** A save problem, shown before the backup line. */
    error?: string;
    appearance?: "daylight" | "candlelit" | "moonlit";
    settingsOpen?: boolean;
    onLanguage: () => void;
    onSettings: () => void;
    /** Picks a theme from Home, as the design's theme switch does (round 6). */
    onTheme: (theme: ThemeName) => void;
  } = $props();

  const THEMES: { name: "daylight" | "candlelit" | "moonlit"; icon: string; key: UiKey }[] = [
    { name: "daylight", icon: "sun", key: "themeDaylight" },
    { name: "candlelit", icon: "flame", key: "themeCandlelit" },
    { name: "moonlit", icon: "moon", key: "themeMoonlit" },
  ];

  const backupState = $derived(prefs.lastBackupError ? "failed" : prefs.lastBackupAt ? "done" : "none");
  const backupLabel = $derived.by(() => {
    void now;
    if (backupState === "failed") return t("backupFailed");
    if (backupState === "none") return t("noBackupYet");
    return t("backedUp", { ago: ago(prefs.lastBackupAt) });
  });
</script>

<!-- Home's own window bar (HOME-6). Home sits above all books, so it has no view tabs. -->
<header class="home-header" data-tauri-drag-region="deep">
  <span class="brand">
    <img src="/brand/{appearance}.png" alt="" width="26" height="26" />
    <span class="name">Pensieve</span>
  </span>
  <span class="spacer"></span>
  {#if error}
    <span class="error" role="alert">{error}</span>
  {/if}
  <span class="backup" class:none={backupState === "none"} class:failed={backupState === "failed"}>
    {#if backupState === "done"}<Icon name="check" />{/if}
    {backupLabel}
  </span>
  <span class="divider" aria-hidden="true"></span>
  <div class="themes" role="radiogroup" aria-label={t("theme")}>
    {#each THEMES as theme (theme.name)}
      <button
        type="button"
        role="radio"
        aria-checked={appearance === theme.name}
        class:on={appearance === theme.name}
        title={t(theme.key)}
        aria-label={t(theme.key)}
        onclick={() => onTheme(theme.name)}
      >
        <Icon name={theme.icon} />
      </button>
    {/each}
  </div>
  <button type="button" class="lang" title={t("homeLanguageHint")} onclick={onLanguage}>{prefs.uiLanguage === "sl" ? "SL" : "EN"}</button>
  <button type="button" class="gear" title={t("settings")} aria-label={t("settings")} aria-pressed={settingsOpen} onclick={onSettings}>
    <Icon name="sliders" />
  </button>
  <WindowControls />
</header>

<style>
  .home-header {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 60px;
    flex: none;
    padding: 0 40px;
    border-bottom: 1px solid var(--pv-divider);
    color: var(--pv-text);
  }

  /* The window buttons sit flush with the top right corner. */
  .home-header :global(.controls) {
    margin-right: -40px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }

  .brand img {
    display: block;
    width: 26px;
    height: 26px;
    border-radius: var(--pv-radius-xs);
  }

  .name {
    font-family: var(--pv-font-heading);
    font-size: 19px;
  }

  .spacer {
    flex: 1;
  }

  .backup {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--pv-success);
    white-space: nowrap;
  }

  .backup :global(svg) {
    width: 14px;
    height: 14px;
  }

  .backup.none {
    color: var(--pv-text-faint);
  }

  .backup.failed,
  .error {
    color: var(--pv-danger);
  }

  .error {
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .divider {
    width: 1px;
    height: 18px;
    margin: 0 6px;
    background: var(--pv-divider);
  }

  .themes {
    display: flex;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
  }

  .themes button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 24px;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text-subtle);
  }

  .themes button:hover {
    background: var(--pv-selected);
  }

  .themes button:active {
    background: var(--pv-pressed);
  }

  .themes button.on {
    background: var(--pv-mark-bg);
    color: var(--pv-mark-fg);
  }

  .themes :global(svg) {
    width: 13px;
    height: 13px;
  }

  .lang {
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    padding: 2px 6px;
    background: transparent;
    color: var(--pv-text-subtle);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
  }

  .gear {
    display: flex;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 3px;
    background: transparent;
    color: var(--pv-text-muted);
  }

  .gear :global(svg) {
    width: 18px;
    height: 18px;
  }

  .lang:hover,
  .gear:hover,
  .gear[aria-pressed="true"] {
    background: var(--pv-selected);
  }

  .gear[aria-pressed="true"] {
    color: var(--pv-text);
  }

  .lang:active,
  .gear:active {
    background: var(--pv-pressed);
  }
</style>
