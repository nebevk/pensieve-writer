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
  }: {
    words: number;
    projectWords: number;
    language?: string;
    saveLabel: string;
    error?: string;
    zen?: boolean;
    onZen: () => void;
    ambience?: "off" | "rain" | "fire";
    today?: number;
    goal?: number;
    onAmbience: () => void;
  } = $props();

  const ambienceLabel = $derived(ambience === "rain" ? "Rain" : ambience === "fire" ? "Fire" : "Quiet");
  const progress = $derived(goal > 0 ? Math.max(0, Math.min(1, today / goal)) : 0);
</script>

<div class="float statusbar" class:problem={error.length > 0}>
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
    border: 0;
    background: transparent;
    color: var(--pv-bar-ambient);
    padding: 0;
    font-size: inherit;
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
