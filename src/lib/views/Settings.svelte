<script lang="ts">
  import type { Prefs, ThemeName } from "$lib/prefs";

  let {
    prefs,
    backupMessage,
    onChange,
    onChooseFolder,
    onBackup,
  }: {
    prefs: Prefs;
    backupMessage: string;
    onChange: (patch: Partial<Prefs>) => void;
    onChooseFolder: () => void;
    onBackup: () => void;
  } = $props();
</script>

<section class="settings">
  <h1>Settings</h1>

  <label>
    Theme
    <select
      value={prefs.theme}
      onchange={(event) =>
        onChange({ theme: (event.currentTarget as HTMLSelectElement).value as ThemeName })}
    >
      <option value="paper">Paper</option>
      <option value="sepia">Sepia</option>
      <option value="dark">Dark</option>
      <option value="candlelit">Candlelit</option>
    </select>
  </label>

  <label>
    Column width
    <input
      type="range"
      min="32"
      max="60"
      value={prefs.columnRem}
      oninput={(event) =>
        onChange({ columnRem: Number((event.currentTarget as HTMLInputElement).value) })}
    />
  </label>

  <label class="check">
    <input
      type="checkbox"
      checked={prefs.gentle}
      onchange={(event) =>
        onChange({ gentle: (event.currentTarget as HTMLInputElement).checked })}
    />
    Gentle mode
  </label>
  <p class="quiet">Gentle mode turns off particles and ambience, and keeps motion quiet.</p>

  <label>
    Daily word goal
    <input
      type="number"
      min="0"
      value={prefs.dailyGoal}
      oninput={(event) =>
        onChange({ dailyGoal: Number((event.currentTarget as HTMLInputElement).value) || 0 })}
    />
  </label>

  <h2>Backup folder</h2>
  <p class="quiet">
    Choose a folder inside Google Drive. Pensieve writes snapshot files there and keeps the live
    project on this computer.
  </p>
  <p>{prefs.backupFolder || "No folder chosen"}</p>
  <div class="row">
    <button type="button" onclick={onChooseFolder}>Choose folder</button>
    <button type="button" onclick={onBackup} disabled={!prefs.backupFolder}>Back up now</button>
  </div>
  {#if backupMessage}
    <p>{backupMessage}</p>
  {/if}

  <h2>Ambience</h2>
  <label>
    Sound
    <select
      value={prefs.ambience}
      onchange={(event) =>
        onChange({
          ambience: (event.currentTarget as HTMLSelectElement).value as Prefs["ambience"],
        })}
    >
      <option value="off">Off</option>
      <option value="rain">Rain</option>
      <option value="fire">Fire</option>
    </select>
  </label>
  <label>
    Volume
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={prefs.ambienceVolume}
      oninput={(event) =>
        onChange({ ambienceVolume: Number((event.currentTarget as HTMLInputElement).value) })}
    />
  </label>
</section>

<style>
  .settings {
    height: 100%;
    overflow: auto;
    padding: 1.5rem 2rem 3rem;
    max-width: 40rem;
  }

  h1 {
    font-family: var(--font-writing);
    font-weight: 500;
  }

  h2 {
    margin: 1.4rem 0 0.3rem;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0.7rem 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  label.check {
    flex-direction: row;
    align-items: center;
  }

  input,
  select,
  button {
    font: inherit;
    color: var(--ink);
  }

  .quiet {
    color: var(--muted);
  }

  .row {
    display: flex;
    gap: 0.5rem;
  }

  button {
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 6px;
    padding: 0.35rem 0.7rem;
  }

  button:disabled {
    opacity: 0.45;
  }
</style>
