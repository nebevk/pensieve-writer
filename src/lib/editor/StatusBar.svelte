<script lang="ts">
  import type { UiKey } from "$lib/i18n";
  import type { KeySoundStyle } from "$lib/keySounds";
  import type { AmbienceName, ThemeName } from "$lib/prefs";
  import { num, plural, t } from "$lib/ui.svelte";
  import { clock, pausePomodoro, pomodoro, pomodoroLeft, resetPomodoro, resumePomodoro, startPomodoro, stopPomodoro } from "$lib/pomodoro.svelte";
  import Icon from "./Icon.svelte";

  let {
    words,
    selected = 0,
    error = "",
    zen = false,
    onZen,
    today = 0,
    appearance = "daylight",
    onTheme,
    ambience = "off",
    ambienceVolume = 0.1,
    keySounds = "off",
    keySoundVolume = 0.5,
    onSound,
    focusMinutes = 25,
    breakMinutes = 5,
  }: {
    words: number;
    /** Words selected on the page: the bar then says "12 of 1,240 words", as Word's does. */
    selected?: number;
    /** A problem saving; the title bar says when all is saved. */
    error?: string;
    zen?: boolean;
    onZen: () => void;
    today?: number;
    /** The look now (Day and night as it is at this hour), whose icon is the chosen one. */
    appearance?: Exclude<ThemeName, "sunset">;
    onTheme: (theme: ThemeName) => void;
    ambience?: AmbienceName;
    ambienceVolume?: number;
    keySounds?: KeySoundStyle;
    keySoundVolume?: number;
    /** The sound and the keys' sound, as Settings → Ambience sets them. */
    onSound: (change: { ambience?: AmbienceName; ambienceVolume?: number; keySounds?: KeySoundStyle; keySoundVolume?: number }) => void;
    /** A pomodoro's minutes of writing and of break (Settings → Writing & goals). */
    focusMinutes?: number;
    breakMinutes?: number;
  } = $props();

  // The sound's or the keys' little panel above the bar, while open.
  let open = $state<"" | "sound" | "keys">("");
  let bar = $state<HTMLElement | undefined>(undefined);
  // The time left while it runs, the break's time in a break.
  const pomodoroLabel = $derived.by(() => {
    void pomodoro.now;
    const left = clock(pomodoroLeft());
    return pomodoro.phase === "break" ? t("pomodoroBreak", { time: left }) : left;
  });

  // The looks as the owner's icon set draws them, in its order (12 October), as on Home.
  const LOOKS: { id: Exclude<ThemeName, "sunset">; icon: string; key: UiKey }[] = [
    { id: "daylight", icon: "sun", key: "themeDaylight" },
    { id: "dusk", icon: "sunset", key: "themeDusk" },
    { id: "candlelit", icon: "flame", key: "themeCandlelit" },
    { id: "moonlit", icon: "moon", key: "themeMoonlit" },
    { id: "forest", icon: "sprout", key: "themeForest" },
  ];
  const SOUNDS: { id: AmbienceName; icon: string; key: UiKey }[] = [
    { id: "off", icon: "volumeX", key: "soundQuiet" },
    { id: "rain", icon: "rain", key: "soundRain" },
    { id: "fire", icon: "fireplace", key: "soundFireplace" },
    { id: "cafe", icon: "coffee", key: "soundCafe" },
    { id: "piano", icon: "music", key: "soundPiano" },
  ];
  const KEYS: { id: KeySoundStyle; key: UiKey }[] = [
    { id: "off", key: "keySoundsOff" },
    { id: "typewriter", key: "keySoundsTypewriter" },
    { id: "mechanical", key: "keySoundsMechanical" },
    { id: "soft", key: "keySoundsSoft" },
  ];
  const sound = $derived(SOUNDS.find((item) => item.id === ambience) ?? SOUNDS[0]);

  /** A panel closes when the keyboard leaves it for something else. */
  function leave(event: FocusEvent) {
    const to = event.relatedTarget;
    if (!(to instanceof Node && (event.currentTarget as HTMLElement).contains(to))) open = "";
  }

  function escape(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    open = "";
  }
</script>

<!-- A slider for a volume of 0 to 1, as Settings has, in the bar's colours. -->
{#snippet volume(value: number, label: string, change: (value: number) => void, disabled = false)}
  <label class="volume" class:disabled>
    <Icon name="volume" />
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      {value}
      {disabled}
      aria-label={label}
      style:--fill="{value * 100}%"
      oninput={(event) => change(Number(event.currentTarget.value))}
    />
    <span class="level">{Math.round(value * 100)}</span>
  </label>
{/snippet}

<!-- A press anywhere but the bar closes its panel, even where nothing takes the keyboard. -->
<svelte:window
  onpointerdown={(event) => {
    if (open && !(event.target instanceof Node && bar?.contains(event.target))) open = "";
  }}
/>

<div class="float statusbar" class:problem={error.length > 0} bind:this={bar}>
  <div class="looks" role="radiogroup" aria-label={t("theme")}>
    {#each LOOKS as look (look.id)}
      <button
        type="button"
        class="quiet look"
        class:chosen={appearance === look.id}
        role="radio"
        aria-checked={appearance === look.id}
        title={t(look.key)}
        aria-label={t(look.key)}
        onclick={() => onTheme(look.id)}
      >
        <Icon name={look.icon} />
      </button>
    {/each}
  </div>
  <span class="rule"></span>
  <!-- The sound: its icon and name; its panel has every sound and the volume. -->
  <div class="menu-wrap" role="presentation" onfocusout={leave} onkeydown={escape}>
    <button
      type="button"
      class="quiet with-icon sound"
      class:playing={ambience !== "off"}
      aria-expanded={open === "sound"}
      title={t("ambience")}
      onclick={() => (open = open === "sound" ? "" : "sound")}
    >
      <Icon name={sound.icon} />{t(sound.key)}
    </button>
    {#if open === "sound"}
      <div class="pop" role="group" aria-label={t("ambience")}>
        <p class="lab">{t("ambience")}</p>
        <div class="choices">
          {#each SOUNDS as item (item.id)}
            <button
              type="button"
              class="quiet choice"
              class:chosen={ambience === item.id}
              aria-pressed={ambience === item.id}
              title={t(item.key)}
              aria-label={t(item.key)}
              onclick={() => onSound({ ambience: item.id })}
            >
              <Icon name={item.icon} />
            </button>
          {/each}
        </div>
        {@render volume(ambienceVolume, t("volume"), (value) => onSound({ ambienceVolume: value }))}
      </div>
    {/if}
  </div>
  <!-- The keys' sound: a keyboard, lit while they sound; its panel has the kinds and their volume. -->
  <div class="menu-wrap" role="presentation" onfocusout={leave} onkeydown={escape}>
    <button
      type="button"
      class="quiet keys"
      class:playing={keySounds !== "off"}
      aria-expanded={open === "keys"}
      title={t("keySounds")}
      aria-label={t("keySounds")}
      onclick={() => (open = open === "keys" ? "" : "keys")}
    >
      <Icon name="keyboard" />
    </button>
    {#if open === "keys"}
      <div class="pop" role="group" aria-label={t("keySounds")}>
        <p class="lab">{t("keySounds")}</p>
        {#each KEYS as item (item.id)}
          <button type="button" class="quiet row" class:chosen={keySounds === item.id} aria-pressed={keySounds === item.id} onclick={() => onSound({ keySounds: item.id })}>
            {t(item.key)}
          </button>
        {/each}
        {@render volume(keySoundVolume, t("keySoundsVolume"), (value) => onSound({ keySoundVolume: value }), keySounds === "off")}
      </div>
    {/if}
  </div>
  <span class="rule"></span>
  <span>{selected > 0 ? `${num(selected)} ${plural("wordsOf", words)}` : plural("words", words)}</span>
  <span class="rule"></span>
  <span class="today">{t("today")} {num(today)}</span>
  <span class="rule"></span>
  <!-- A pomodoro: writing for a while, then a short break; while it runs, its time and three icons. -->
  {#if pomodoro.phase === "idle"}
    <button
      type="button"
      class="quiet with-icon pomodoro"
      title={t("pomodoroHint", { focus: focusMinutes, rest: breakMinutes })}
      onclick={() => startPomodoro(focusMinutes, breakMinutes)}
    >
      <Icon name="timer" />{t("pomodoro")}
    </button>
  {:else}
    <span class="pomodoro-run" role="group" aria-label={t("pomodoro")}>
      <span class="with-icon pomodoro running" class:paused={pomodoro.pausedLeft > 0} role="timer"><Icon name="timer" />{pomodoroLabel}</span>
      <button
        type="button"
        class="quiet icon"
        title={pomodoro.pausedLeft ? t("pomodoroResume") : t("pomodoroPause")}
        aria-label={pomodoro.pausedLeft ? t("pomodoroResume") : t("pomodoroPause")}
        onclick={() => (pomodoro.pausedLeft ? resumePomodoro() : pausePomodoro())}
      >
        <Icon name={pomodoro.pausedLeft ? "play" : "pause"} />
      </button>
      <button type="button" class="quiet icon" title={t("pomodoroReset")} aria-label={t("pomodoroReset")} onclick={resetPomodoro}><Icon name="rotateCcw" /></button>
      <button type="button" class="quiet icon" title={t("pomodoroStop")} aria-label={t("pomodoroStop")} onclick={stopPomodoro}><Icon name="square" /></button>
    </span>
  {/if}
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

  /* The looks: one icon each, the chosen one lit. */
  .looks {
    display: flex;
    gap: 1px;
  }

  .quiet.look,
  .quiet.keys {
    display: grid;
    place-items: center;
    width: 24px;
    height: 22px;
    border-radius: var(--pv-radius-xs);
    color: var(--pv-bar-muted);
  }

  .quiet.look :global(svg),
  .quiet.keys :global(svg) {
    width: 14px;
    height: 14px;
  }

  .quiet.look:hover,
  .quiet.keys:hover {
    color: var(--pv-bar-text);
  }

  .quiet.look.chosen {
    background: var(--pv-bar-line);
    color: var(--pv-bar-text);
  }

  /* The sound, and the keys while they sound, in the bar's warm colour. */
  .quiet.sound {
    color: var(--pv-bar-muted);
  }

  .quiet.sound.playing,
  .quiet.keys.playing {
    color: var(--pv-bar-ambient);
  }

  .pop {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 13.5rem;
    padding: 10px;
    background: var(--pv-bar-bg);
    border: 1px solid var(--pv-bar-border);
    border-radius: var(--pv-radius-sm);
    box-shadow: var(--pv-shadow-bar);
  }

  .lab {
    margin: 0 0 2px;
    color: var(--pv-bar-muted);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .choices {
    display: flex;
    gap: 4px;
  }

  .quiet.choice {
    display: grid;
    place-items: center;
    width: 34px;
    height: 30px;
    border-radius: 6px;
    color: var(--pv-bar-muted);
  }

  .quiet.choice :global(svg) {
    width: 16px;
    height: 16px;
  }

  .quiet.choice:hover,
  .quiet.row:hover {
    background: var(--pv-bar-line);
    color: var(--pv-bar-text);
  }

  .quiet.choice.chosen {
    background: var(--pv-bar-line);
    color: var(--pv-bar-ambient);
  }

  .quiet.row {
    padding: 5px 8px;
    border-radius: var(--pv-radius-xs);
    color: var(--pv-bar-text);
    text-align: left;
  }

  .quiet.row.chosen {
    color: var(--pv-bar-ambient);
    font-weight: 600;
  }

  .volume {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    color: var(--pv-bar-muted);
  }

  .volume.disabled {
    opacity: 0.45;
  }

  .volume :global(svg) {
    flex: none;
    width: 14px;
    height: 14px;
  }

  .volume input {
    flex: 1;
    min-width: 0;
    height: 4px;
    margin: 0;
    border-radius: 2px;
    background: linear-gradient(to right, var(--pv-bar-ambient) var(--fill), var(--pv-bar-line) var(--fill));
    appearance: none;
  }

  .volume input::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--pv-bar-text);
    appearance: none;
  }

  .level {
    width: 2ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .rule {
    width: 1px;
    height: 12px;
    background: var(--pv-bar-line);
  }

  .pomodoro {
    font-variant-numeric: tabular-nums;
  }

  .pomodoro-run {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .pomodoro-run .pomodoro {
    margin-right: 4px;
  }

  .quiet.icon {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--pv-radius-xs);
  }

  .quiet.icon :global(svg) {
    width: 12px;
    height: 12px;
  }

  .quiet.icon:hover {
    background: var(--pv-bar-line);
    color: var(--pv-bar-text);
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
