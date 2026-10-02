<script lang="ts">
  let {
    words,
    projectWords,
    language = "English",
    saveLabel,
    error = "",
    zen = false,
    onZen,
    ambience = "off",
    today = 0,
    goal = 0,
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
    goal?: number;
    onAmbience: () => void;
    theme?: "daylight" | "candlelit" | "moonlit" | "sunset";
    onTheme: (theme: "daylight" | "candlelit" | "moonlit" | "sunset") => void;
  } = $props();

  let themesOpen = $state(false);

  const themes = [
    { id: "daylight", label: "Daylight" },
    { id: "candlelit", label: "Candlelit" },
    { id: "moonlit", label: "Moonlit" },
    { id: "sunset", label: "Follow sunset" },
  ] as const;

  const themeLabel = $derived(themes.find((item) => item.id === theme)?.label ?? "Daylight");

  const ambienceLabel = $derived(
    ambience === "rain"
      ? "Rain"
      : ambience === "fire"
        ? "Fire"
        : ambience === "cafe"
          ? "Café"
          : ambience === "piano"
            ? "Piano"
            : "Quiet",
  );
  const progress = $derived(goal > 0 ? Math.max(0, Math.min(1, today / goal)) : 0);
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
            {item.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <span class="rule"></span>
  <button type="button" class="quiet" onclick={onAmbience}>{ambienceLabel}</button>
  <span class="rule"></span>
  <span>{words.toLocaleString("en")} words</span>
  <span class="rule"></span>
  <span class="muted">{projectWords.toLocaleString("en")} in the book</span>
  <span class="rule"></span>
  <span class="today">
    Today
    {#if goal > 0}
      <span class="meter" aria-hidden="true"><span style:width="{progress * 100}%"></span></span>
      {today}/{goal}
    {:else}
      {today}
    {/if}
  </span>
  <span class="rule"></span>
  <span class="muted">{language}</span>
  {#if error}
    <span class="rule"></span>
    <span class="error" role="alert">{error}</span>
  {:else}
    <span class="rule"></span>
    <span class="muted">{saveLabel}</span>
  {/if}
  <button type="button" class:on={zen} onclick={onZen}>Zen</button>
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

  .today {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .meter {
    width: 48px;
    height: 2px;
    background: var(--pv-bar-line);
  }

  .meter span {
    display: block;
    height: 100%;
    background: var(--pv-progress);
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
</style>
