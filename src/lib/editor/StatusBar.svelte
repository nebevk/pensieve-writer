<script lang="ts">
  import type { UiKey } from "$lib/i18n";
  import type { ThemeName } from "$lib/prefs";
  import { num, plural, t } from "$lib/ui.svelte";
  import { BREAK_MINUTES, FOCUS_MINUTES, clock, pausePomodoro, pomodoro, pomodoroLeft, resumePomodoro, startPomodoro, stopPomodoro } from "$lib/pomodoro.svelte";
  import Icon from "./Icon.svelte";

  let {
    words,
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
    /** A problem saving; the title bar says when all is saved. */
    error?: string;
    zen?: boolean;
    onZen: () => void;
    ambience?: "off" | "rain" | "fire" | "cafe" | "piano";
    today?: number;
    onAmbience: () => void;
    theme?: ThemeName;
    onTheme: (theme: ThemeName) => void;
  } = $props();

  let themesOpen = $state(false);
  let pomodoroOpen = $state(false);

  // The timer's face: its name while it rests, the time left while it runs, the break's time in a break.
  const pomodoroLabel = $derived.by(() => {
    void pomodoro.now;
    if (pomodoro.phase === "idle") return t("pomodoro");
    const left = clock(pomodoroLeft());
    return pomodoro.phase === "break" ? t("pomodoroBreak", { time: left }) : left;
  });

  function pressPomodoro() {
    if (pomodoro.phase === "idle") startPomodoro();
    else pomodoroOpen = !pomodoroOpen;
  }

  const themes = [
    { id: "daylight", key: "themeDaylight" },
    { id: "dusk", key: "themeDusk" },
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
  <span class="today">{t("today")} {num(today)}</span>
  <span class="rule"></span>
  <!-- A pomodoro: writing for a while, then a short break. -->
  <div class="menu-wrap">
    <button
      type="button"
      class="quiet with-icon pomodoro"
      class:running={pomodoro.phase !== "idle"}
      class:paused={pomodoro.pausedLeft > 0}
      title={t("pomodoroHint", { focus: FOCUS_MINUTES, rest: BREAK_MINUTES })}
      aria-haspopup={pomodoro.phase === "idle" ? undefined : "menu"}
      aria-expanded={pomodoro.phase === "idle" ? undefined : pomodoroOpen}
      onclick={pressPomodoro}
    >
      <Icon name="timer" />{pomodoroLabel}
    </button>
    {#if pomodoroOpen && pomodoro.phase !== "idle"}
      <div class="menu" role="menu">
        <button
          type="button"
          class="quiet"
          role="menuitem"
          onclick={() => {
            if (pomodoro.pausedLeft) resumePomodoro();
            else pausePomodoro();
            pomodoroOpen = false;
          }}
        >
          {pomodoro.pausedLeft ? t("pomodoroResume") : t("pomodoroPause")}
        </button>
        <button
          type="button"
          class="quiet"
          role="menuitem"
          onclick={() => {
            stopPomodoro();
            pomodoroOpen = false;
          }}
        >
          {t("pomodoroStop")}
        </button>
      </div>
    {/if}
  </div>
  {#if error}
    <span class="rule"></span>
    <span class="error" role="alert">{error}</span>
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

  .pomodoro {
    font-variant-numeric: tabular-nums;
  }

  .pomodoro.running {
    color: var(--pv-bar-text);
    font-weight: 600;
  }

  .pomodoro.paused {
    color: var(--pv-bar-muted);
    font-weight: 400;
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
