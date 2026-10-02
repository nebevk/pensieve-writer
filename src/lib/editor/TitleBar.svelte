<script lang="ts">
  type ViewId = "write" | "notes" | "todos" | "outline" | "book" | "home" | "settings";

  let {
    project = "Untitled",
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
  } = $props();

  const tabs: { id: ViewId; label: string }[] = [
    { id: "write", label: "Write" },
    { id: "notes", label: "Notes" },
    { id: "todos", label: "To-dos" },
    { id: "outline", label: "Outline" },
    { id: "book", label: "Book" },
  ];
</script>

<header class="titlebar">
  <button type="button" class="mark" title="Home" onclick={onHome}>P</button>
  <span class="project">{project}</span>
  <div class="tabs" role="tablist" aria-label="Views">
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
  <button type="button" class="lang" title="Chapter language" onclick={onLanguage}>{language}</button>
  <button type="button" class="gear" title="Settings" aria-pressed={settingsOpen} onclick={onSettings}>
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" stroke-width="1.4" />
      <path
        d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
      />
    </svg>
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
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: var(--pv-mark-bg);
    color: var(--pv-mark-fg);
    font-family: var(--pv-font-heading);
    font-size: 12px;
    line-height: 1;
    padding: 0;
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
  .gear svg {
    width: 13px;
    height: 13px;
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
