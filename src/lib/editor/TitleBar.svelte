<script lang="ts">
  import { t } from "$lib/ui.svelte";
  import Icon from "./Icon.svelte";

  type ViewId = "write" | "notes" | "todos" | "outline" | "book" | "home" | "settings";

  let {
    project = "",
    view,
    saveLabel,
    saveState = "saved",
    language = "EN",
    error = "",
    onView,
    onLanguage,
    onHome,
    onSettings,
    settingsOpen = false,
    appearance = "daylight",
  }: {
    project?: string;
    view: ViewId;
    saveLabel: string;
    saveState?: "saved" | "saving" | "unsaved" | "error";
    language?: string;
    error?: string;
    onView: (view: ViewId) => void;
    onLanguage: () => void;
    onHome: () => void;
    onSettings: () => void;
    settingsOpen?: boolean;
    appearance?: "daylight" | "candlelit" | "moonlit";
  } = $props();

  const tabs = $derived([
    { id: "write" as const, label: t("write") },
    { id: "notes" as const, label: t("notes") },
    { id: "todos" as const, label: t("todos") },
    { id: "outline" as const, label: t("outline") },
    { id: "book" as const, label: t("book") },
  ]);
</script>

<header class="titlebar">
  <button type="button" class="mark" title={t("home")} aria-label={t("home")} onclick={onHome}>
    <img src="/brand/{appearance}.png" alt="" width="22" height="22" />
  </button>
  <span class="project">{project || t("untitled")}</span>
  <div class="tabs" role="tablist" aria-label={t("views")}>
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        role="tab"
        aria-selected={view === tab.id}
        class:active={view === tab.id}
        onclick={() => onView(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <p class="save" class:quiet={saveState === "saving" || saveState === "unsaved"} class:problem={saveState === "error"}>
    {#if error}
      <span class="error" role="alert">{error}</span>
    {/if}
    {#if saveState === "saved"}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.2 6.4 11 12.5 4.8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
    {saveLabel}
  </p>
  <button type="button" class="lang" title={t("languageHint")} onclick={onLanguage}>{language}</button>
  <button type="button" class="gear" title={t("settings")} aria-label={t("settings")} aria-pressed={settingsOpen} onclick={onSettings}>
    <Icon name="sliders" />
  </button>
</header>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: var(--pv-titlebar-h);
    padding: 0 16px;
    flex: none;
    border-bottom: 1px solid var(--pv-line);
    background: var(--pv-chrome);
    color: var(--pv-text);
    font-size: var(--pv-text-md);
  }

  .mark {
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    padding: 0;
  }

  .mark img {
    display: block;
    width: 22px;
    height: 22px;
    border-radius: var(--pv-radius-xs);
  }

  .project {
    color: var(--pv-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 12rem;
  }

  .tabs {
    display: flex;
    gap: 20px;
    height: 100%;
    margin: 0 auto;
  }

  .tabs button {
    border: 0;
    background: transparent;
    height: 100%;
    padding: 0;
    font-size: var(--pv-text-md);
    font-weight: 400;
    color: var(--pv-text-subtle);
    box-shadow: none;
  }

  .tabs button:hover {
    color: var(--pv-text);
  }

  .tabs button.active {
    color: var(--pv-text);
    font-weight: 600;
    box-shadow: inset 0 -2px var(--pv-accent);
  }

  .save {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 0;
    color: var(--pv-success);
    font-size: var(--pv-text-sm);
    white-space: nowrap;
  }

  .save.quiet {
    color: var(--pv-text-faint);
  }

  .save.problem,
  .error {
    color: var(--danger);
  }

  .error {
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .save svg,
  .gear :global(svg) {
    width: 14px;
    height: 14px;
    display: block;
  }

  .lang {
    border: 1px solid var(--pv-line-strong);
    background: transparent;
    color: var(--pv-text-subtle);
    border-radius: var(--pv-radius-xs);
    padding: 1px 5px;
    font-size: var(--pv-text-xs);
    font-weight: 600;
    line-height: 1.3;
  }

  .lang:hover,
  .gear:hover {
    background: var(--pv-selected);
  }

  .gear {
    display: flex;
    border: 0;
    background: transparent;
    color: var(--pv-text-muted);
    border-radius: var(--pv-radius-xs);
    padding: 3px;
  }

  .gear[aria-pressed="true"] {
    color: var(--pv-text);
    background: var(--pv-selected);
  }
</style>
