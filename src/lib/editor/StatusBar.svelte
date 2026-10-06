<script lang="ts">
  import type { UiKey } from "$lib/i18n";
  import { num, plural, t } from "$lib/ui.svelte";
  import Icon from "./Icon.svelte";

  let {
    words,
    projectWords,
    language = "",
    saveLabel,
    error = "",
    zen = false,
    onZen,
    ambience = "off",
    today = 0,
    onAmbience,
    theme = "daylight",
    onTheme,
  }: {
    words: number;
    projectWords: number;
    language?: string;
    saveLabel: string;
    error?: string;
    zen?: boolean;
    onZen: () => void;
    ambience?: "off" | "rain" | "fire" | "cafe" | "piano";
    today?: number;
    onAmbience: () => void;
    theme?: "daylight" | "candlelit" | "moonlit" | "sunset";
    onTheme: (theme: "daylight" | "candlelit" | "moonlit" | "sunset") => void;
  } = $props();

  let themesOpen = $state(false);

  const themes = [
    { id: "daylight", key: "themeDaylight" },
    { id: "candlelit", key: "themeCandlelit" },
    { id: "moonlit", key: "themeMoonlit" },
    { id: "sunset", key: "themeSunset" },
  ] as const;

  const themeLabel = $derived(t(themes.find((item) => item.id === theme)?.key ?? "themeDaylight"));

  const SOUNDS: Record<typeof ambience, UiKey> = {
    off: "soundQuiet",
    rain: "soundRain",
    fire: "soundFireplace",
    cafe: "soundCafe",
    piano: "soundPiano",
  };
  const ambienceLabel = $derived(t(SOUNDS[ambience]));
</script>

<div class="float statusbar" class:problem={error.length > 0}>
  <div class="menu-wrap">
    <button type="button" class="quiet" aria-expanded={themesOpen} onclick={() => (themesOpen = !themesOpen)}>
      {themeLabel}
    </button>
    {#if themesOpen}
      <div class="menu" role="menu">
        {#each themes as item (item.id)}
          <button
            type="button"
            class="quiet"
            class:chosen={theme === item.id}
            role="menuitem"
            onclick={() => {
              onTheme(item.id);
              themesOpen = false;
            }}
          >
            {t(item.key)}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <span class="rule"></span>
  <button type="button" class="quiet with-icon" onclick={onAmbience}>
    {#if ambience === "rain"}<Icon name="rain" />{:else if ambience === "fire"}<Icon name="flame" />{/if}
    {ambienceLabel}
  </button>
  <span class="rule"></span>
  <span>{plural("words", words)}</span>
  <span class="rule"></span>
  <span class="muted">{t("inTheBook", { n: projectWords })}</span>
  <span class="rule"></span>
  <span class="today">{t("today")} {num(today)}</span>
  <span class="rule"></span>
  <span class="muted">{language}</span>
  {#if error}
    <span class="rule"></span>
    <span class="error" role="alert">{error}</span>
  {:else}
    <span class="rule"></span>
    <span class="muted">{saveLabel}</span>
  {/if}
  <button type="button" class="with-icon" class:on={zen} onclick={onZen}><Icon name="moon" />{t("zen")}</button>
</div>

<style>
  .float {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    height: var(--pv-floatbar-h);
    padding: 0 3px 0 11px;
    background: var(--pv-bar-bg);
    border: 1px solid var(--pv-bar-border);
    color: var(--pv-bar-text);
    border-radius: var(--pv-radius-md);
    box-shadow: var(--pv-shadow-bar);
    font-size: var(--pv-text-sm);
    white-space: nowrap;
  }

  .muted,
  .today {
    color: var(--pv-bar-muted);
  }

  .quiet {
    height: auto;
    border: 0;
    background: transparent;
    color: var(--pv-bar-ambient);
    padding: 0;
    font-size: inherit;
    font-weight: 400;
  }

  .quiet.chosen {
    color: var(--pv-bar-text);
    font-weight: 600;
  }

  .menu-wrap {
    position: relative;
  }

  .menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 9rem;
    padding: 6px;
    background: var(--pv-bar-bg);
    border: 1px solid var(--pv-bar-border);
    border-radius: var(--pv-radius-sm);
    box-shadow: var(--pv-shadow-bar);
  }

  .menu .quiet {
    text-align: left;
    padding: 4px 6px;
    border-radius: var(--pv-radius-xs);
  }

  .menu .quiet:hover {
    background: var(--pv-bar-line);
  }

  .rule {
    width: 1px;
    height: 12px;
    background: var(--pv-bar-line);
  }

  .error {
    color: #e7b2aa;
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button {
    height: 24px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0 9px;
    background: var(--pv-accent-solid);
    color: var(--pv-on-accent);
    font-size: var(--pv-text-sm);
    font-weight: 600;
  }

  button.on {
    box-shadow: inset 0 0 0 1px var(--pv-on-accent);
  }

  /* The solid Zen button brightens on hover and darkens when pressed. */
  button:not(.quiet):hover {
    filter: brightness(1.08);
  }

  button:not(.quiet):active {
    filter: brightness(0.92);
  }

  .with-icon {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .with-icon :global(svg) {
    width: 13px;
    height: 13px;
  }
</style>
