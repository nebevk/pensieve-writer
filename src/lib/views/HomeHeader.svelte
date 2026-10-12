<script lang="ts">
  import BrandMark from "$lib/editor/BrandMark.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import WindowControls from "$lib/editor/WindowControls.svelte";
  import UpdatePill, { type UpdateOffer } from "$lib/editor/UpdatePill.svelte";
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
    onSearch,
    update = null,
    onUpdate = () => undefined,
  }: {
    prefs: Prefs;
    /** The page's minute clock, so "12 min ago" keeps up. */
    now?: number;
    /** A save problem, shown before the backup line. */
    error?: string;
    appearance?: Exclude<ThemeName, "sunset">;
    settingsOpen?: boolean;
    onLanguage: () => void;
    onSettings: () => void;
    /** Picks a theme from Home, as the design's theme switch does (round 6). */
    onTheme: (theme: ThemeName) => void;
    /** Opens the search across every project. */
    onSearch: () => void;
    /** A newer Pensieve to install, when there is one. */
    update?: UpdateOffer | null;
    onUpdate?: () => void;
  } = $props();

  const THEMES: { name: Exclude<ThemeName, "sunset">; icon: string; key: UiKey }[] = [
    { name: "daylight", icon: "sun", key: "themeDaylight" },
    { name: "dusk", icon: "sunset", key: "themeDusk" },
    { name: "candlelit", icon: "flame", key: "themeCandlelit" },
    { name: "moonlit", icon: "moon", key: "themeMoonlit" },
    { name: "forest", icon: "sprout", key: "themeForest" },
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
    <!-- Home's mark is the large one, and moves, except in Gentle mode. -->
    <BrandMark {appearance} size={34} animated={!prefs.gentle} />
    <span class="name">Pensieve</span>
  </span>
  <span class="spacer"></span>
  <button type="button" class="find" title="{t("searchEverything")} (Ctrl+Shift+F)" onclick={onSearch}><Icon name="search" />{t("searchEverything")}</button>
  {#if update}
    <UpdatePill offer={update} {onUpdate} />
  {/if}
  {#if error}
    <span class="error" role="alert">{error}</span>
  {/if}
  <span class="backup" class:none={backupState === "none"} class:failed={backupState === "failed"}>
    {#if backupState === "done"}<Icon name="check" />{:else if backupState === "none"}<Icon name="cloudOff" />{/if}
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
    /* As wide a margin as Home's own, so the mark stands over the page's left edge. */
    padding: 0 var(--home-margin);
    border-bottom: 1px solid var(--pv-divider);
    color: var(--pv-text);
    --home-margin: 56px;
  }

  @media (max-width: 1100px) {
    .home-header {
      --home-margin: 28px;
    }
  }

  /* The window buttons sit flush with the top right corner. */
  .home-header :global(.controls) {
    margin-right: calc(-1 * var(--home-margin));
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    /* The basin starts an eighth of the way in: the mark moves out by that, so the basin lines up. */
    margin-left: -4px;
  }

  .name {
    font-family: var(--pv-font-heading);
    font-size: 22px;
    line-height: 1;
    /* The heading face sits a little high in its line: down to the middle of the basin. */
    padding-top: 3px;
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

  /* No backup yet: a soft chip, as the design has it, so it is seen without alarm. */
  .backup.none {
    height: 28px;
    padding: 0 12px 0 10px;
    gap: 7px;
    border-radius: var(--pv-radius-xs);
    background: var(--pv-ink-tint);
    color: var(--pv-ink-tint-text);
    font-size: 12.5px;
    font-weight: 600;
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

  /* The theme switch: a soft track, the chosen theme raised on it in the page's colour. */
  .themes {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 6px;
    background: var(--pv-selected);
  }

  .themes button {
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 24px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0 8px;
    background: transparent;
    color: var(--pv-text-subtle);
  }

  .themes button:not(.on):hover {
    color: var(--pv-text);
  }

  /* The page's colours, ink on paper, so it reads in the dark looks too. */
  .themes button.on {
    background: var(--pv-paper);
    color: var(--pv-ink-accent);
    box-shadow: 0 1px 2px rgba(60, 45, 30, 0.18);
  }

  .themes :global(svg) {
    width: 15px;
    height: 15px;
  }

  .find {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    padding: 0 10px;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .find :global(svg) {
    width: 14px;
    height: 14px;
  }

  .find:hover {
    background: var(--pv-selected);
  }

  .find:active {
    background: var(--pv-pressed);
  }

  .lang {
    height: 26px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    padding: 0 7px;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 12px;
    font-weight: 600;
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
