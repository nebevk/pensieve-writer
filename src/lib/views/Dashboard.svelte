<script lang="ts">
  import { onMount } from "svelte";
  import { countWords } from "$lib/editor/counts";
  import type { Project, SnapshotInfo } from "$lib/model";
  import type { Prefs } from "$lib/prefs";
  import { listNotes, listTasks } from "$lib/storage/organize";
  import { sqliteStorage } from "$lib/storage/sqlite";

  let {
    project,
    prefs,
    onContinue,
    onRestored,
    onExport,
    onImport,
  }: {
    project: Project;
    prefs: Prefs;
    onContinue: () => void;
    onRestored: (project: Project) => void;
    onExport: () => void;
    onImport: (file: File) => void;
  } = $props();

  let snapshots = $state<SnapshotInfo[]>([]);
  let todoCount = $state(0);
  let noteCount = $state(0);
  let message = $state("");
  let pendingRestore = $state<string | null>(null);

  const words = $derived(project.chapters.reduce((sum, chapter) => sum + countWords(chapter.plainText), 0));
  const recent = $derived(
    [...project.chapters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
  );

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    try {
      snapshots = await sqliteStorage.listSnapshots(project.id);
      const [notes, tasks] = await Promise.all([listNotes(project.id), listTasks(project.id)]);
      noteCount = notes.length;
      todoCount = tasks.length + notes.filter((note) => note.todoState && note.todoState !== "done").length;
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not load the dashboard";
    }
  }

  async function restore(id: string) {
    try {
      const restored = await sqliteStorage.restore(id);
      pendingRestore = null;
      onRestored(restored);
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not restore that snapshot";
    }
  }
</script>

<section class="panel">
  <h1>{project.title}</h1>
  <p class="lead">{words} words across {project.chapters.length} chapters. {noteCount} notes. {todoCount} open todos.</p>
  {#if prefs.dailyGoal > 0}
    <p class="lead">Daily goal: {Math.min(words, prefs.dailyGoal)} / {prefs.dailyGoal} words.</p>
  {/if}
  <button type="button" class="primary" onclick={onContinue}>Continue writing</button>
  <div class="actions">
    <button type="button" onclick={onExport}>Export Word</button>
    <label class="file">
      Import Word
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onchange={(event) => {
          const file = (event.currentTarget as HTMLInputElement).files?.[0];
          if (file) onImport(file);
          (event.currentTarget as HTMLInputElement).value = "";
        }}
      />
    </label>
  </div>

  <h2>Recently edited</h2>
  <ul>
    {#each recent as chapter (chapter.id)}
      <li>{chapter.title}</li>
    {/each}
  </ul>

  <h2>Snapshots</h2>
  {#if snapshots.length === 0}
    <p class="quiet">No snapshots yet. One is kept about once an hour, and again before a chapter is deleted.</p>
  {:else}
    <ul class="snapshots">
      {#each snapshots as snapshot (snapshot.id)}
        <li>
          <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
          {#if pendingRestore === snapshot.id}
            <button type="button" onclick={() => void restore(snapshot.id)}>Restore this</button>
            <button type="button" onclick={() => (pendingRestore = null)}>Cancel</button>
          {:else}
            <button type="button" onclick={() => (pendingRestore = snapshot.id)}>Restore</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if message}
    <p class="error" role="alert">{message}</p>
  {/if}
</section>

<style>
  .panel {
    height: 100%;
    overflow: auto;
    padding: 1.5rem 2rem 3rem;
  }

  h1 {
    font-family: var(--font-writing);
    font-weight: 500;
    margin: 0 0 0.4rem;
  }

  h2 {
    margin: 1.6rem 0 0.4rem;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .lead,
  .quiet {
    color: var(--muted);
  }

  .primary,
  button,
  .file {
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 6px;
    padding: 0.35rem 0.7rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }

  .file input {
    display: block;
    margin-top: 0.25rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    padding: 0.25rem 0;
  }

  .snapshots li {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .error {
    color: var(--danger);
  }
</style>
