<script lang="ts">
  import { onMount } from "svelte";
  import { countWords } from "$lib/editor/counts";
  import type { Chapter, Project, SnapshotInfo } from "$lib/model";
  import type { Prefs } from "$lib/prefs";
  import { listNotes, listTasks } from "$lib/storage/organize";
  import { sqliteStorage } from "$lib/storage/sqlite";

  let {
    project,
    prefs,
    saveLabel = "Saved",
    wordsToday = 0,
    onContinue,
    onRestored,
  }: {
    project: Project;
    prefs: Prefs;
    saveLabel?: string;
    wordsToday?: number;
    onContinue: () => void;
    onRestored: (project: Project) => void;
  } = $props();

  let snapshots = $state<SnapshotInfo[]>([]);
  let todoCount = $state(0);
  let message = $state("");
  let pendingRestore = $state<string | null>(null);

  const chapters = $derived([...project.chapters].sort((a, b) => a.position - b.position));
  const words = $derived(chapters.reduce((sum, chapter) => sum + countWords(chapter.plainText), 0));
  const latest = $derived(
    [...chapters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
  );
  const lines = $derived(paragraphs(latest));
  const currentLine = $derived(lines.at(-1) ?? "");
  const previousLine = $derived(lines.at(-2) ?? "");
  const started = $derived(chapters.filter((chapter) => chapter.plainText.trim().length > 0).length);
  const progress = $derived(chapters.length === 0 ? 0 : started / chapters.length);

  function paragraphs(chapter: Chapter | null): string[] {
    if (!chapter) return [];
    return chapter.plainText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function greeting(now = new Date()): string {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function clip(text: string, max = 88): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
  }

  function when(iso: string): string {
    const then = new Date(iso);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (then.getTime() >= start.getTime()) return "Today";
    return then.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  }

  function edited(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return "edited just now";
    if (minutes < 60) return `edited ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `edited ${hours} h ago`;
    const days = Math.round(hours / 24);
    return `edited ${days} d ago`;
  }

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    try {
      snapshots = await sqliteStorage.listSnapshots(project.id);
      const [notes, tasks] = await Promise.all([listNotes(project.id), listTasks(project.id)]);
      todoCount =
        tasks.filter((task) => task.todoState !== "done").length +
        notes.filter((note) => note.todoState && note.todoState !== "done").length;
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not load the home view";
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

<section class="home">
  <div class="hero">
    <div class="greeting">
      <p class="date">
        {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <h1>{greeting()}{currentLine ? `. ${clip(currentLine)}` : "."}</h1>
      <div class="stats">
        <div>
          <p class="value">
            {wordsToday.toLocaleString("en")}{#if prefs.dailyGoal > 0}<span> / {prefs.dailyGoal.toLocaleString("en")}</span>{/if}
          </p>
          <p class="label">words today</p>
        </div>
        <div>
          <p class="value">{prefs.streak}</p>
          <p class="label">{prefs.streak === 1 ? "day streak" : "day streak"}</p>
        </div>
        <div>
          <p class="value">{todoCount}</p>
          <p class="label">open to-dos</p>
        </div>
      </div>
    </div>

    <div class="continue">
      <div class="under" aria-hidden="true"></div>
      <div class="sheet">
        <div class="running">
          <span>{project.title}</span>
          <span>{latest ? `Ch. ${chapters.findIndex((chapter) => chapter.id === latest.id) + 1}` : ""}</span>
        </div>
        <div class="excerpt">
          {#if previousLine}
            <p class="faded">{clip(previousLine, 140)}</p>
          {/if}
          <p>
            {currentLine ? clip(currentLine, 160) : "The page is still blank."}<span class="caret" aria-hidden="true"></span>
          </p>
        </div>
        <div class="foot">
          <span>{latest ? `${latest.title} · ${edited(latest.updatedAt)}` : saveLabel}</span>
          <button type="button" class="go" onclick={onContinue}>Continue writing</button>
        </div>
      </div>
    </div>
  </div>

  <div class="projects">
    <div class="projects-head">
      <h2>Projects</h2>
      <span class="count">1</span>
    </div>
    <div class="grid">
      <article>
        <button type="button" class="card" class:stacked={chapters.length > 1} onclick={onContinue}>
          <span class="kind">{project.language === "sl" ? "Knjiga" : "Book"}</span>
          <span class="title">{project.title}</span>
        </button>
        <div class="bar" aria-hidden="true"><span style:width="{Math.round(progress * 100)}%"></span></div>
        <p class="meta">
          <span>{words.toLocaleString("en")} words</span>
          <span>{latest ? when(latest.updatedAt) : ""}</span>
        </p>
      </article>
    </div>
  </div>

  {#if snapshots.length > 0 || message}
    <div class="snapshots">
      <h2>Snapshots</h2>
      {#if message}
        <p class="error" role="alert">{message}</p>
      {/if}
      <ul>
        {#each snapshots as snapshot (snapshot.id)}
          <li>
            <span>{snapshot.kind === "daily" ? "Daily" : snapshot.kind === "manual" ? "Kept" : "Hourly"} · {new Date(snapshot.createdAt).toLocaleString()}</span>
            {#if pendingRestore === snapshot.id}
              <button type="button" onclick={() => void restore(snapshot.id)}>Restore this</button>
              <button type="button" onclick={() => (pendingRestore = null)}>Cancel</button>
            {:else}
              <button type="button" onclick={() => (pendingRestore = snapshot.id)}>Restore</button>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .home {
    height: 100%;
    overflow: auto;
    position: relative;
    color: var(--pv-text);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 460px);
    gap: 56px;
    padding: 48px 64px 0;
  }

  .date {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--pv-text-faint);
    font-weight: 600;
  }

  h1 {
    margin: 14px 0 0;
    max-width: 560px;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-display);
    font-weight: 400;
    line-height: 1.08;
    color: var(--pv-text);
  }

  .stats {
    display: flex;
    gap: 40px;
    margin-top: 22px;
    padding-top: 22px;
    border-top: 1px solid var(--pv-divider);
  }

  .value {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: 28px;
    font-weight: 400;
  }

  .value span,
  .label {
    color: var(--pv-text-faint);
  }

  .value span {
    font-size: 16px;
  }

  .label {
    margin: 2px 0 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-subtle);
  }

  .continue {
    position: relative;
    height: 300px;
  }

  .under,
  .sheet {
    position: absolute;
    inset: 0;
  }

  .under {
    transform: translate(6px, 7px) rotate(1deg);
    background: var(--pv-paper-under);
    box-shadow: var(--pv-shadow-under);
  }

  .sheet {
    display: flex;
    flex-direction: column;
    padding: 30px 36px;
    background-color: var(--pv-paper);
    background-image: var(--pv-grain);
    box-shadow: var(--pv-shadow-sheet);
    color: var(--pv-ink);
  }

  .running {
    display: flex;
    justify-content: space-between;
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-running);
    text-transform: uppercase;
    color: var(--pv-ink-meta);
  }

  .excerpt {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    font-family: var(--pv-font-manuscript);
    font-size: 15px;
    line-height: 1.75;
  }

  .excerpt p {
    margin: 0;
  }

  .faded {
    opacity: 0.55;
    color: var(--pv-ink-2);
  }

  .caret {
    display: inline-block;
    width: 1px;
    height: 0.95em;
    margin-left: 2px;
    background: var(--pv-ink-accent);
    vertical-align: text-bottom;
    animation: blink 1.1s steps(1) infinite;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: var(--pv-text-md);
    color: var(--pv-ink-muted);
  }

  .go {
    height: 36px;
    border: 0;
    border-radius: var(--pv-radius-sm);
    padding: 0 16px;
    background: var(--pv-ink-accent);
    color: var(--pv-on-accent);
    font-weight: 600;
  }

  .projects,
  .snapshots {
    padding: 36px 64px 28px;
  }

  .projects-head,
  .snapshots h2 {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 0 0 24px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--pv-divider);
  }

  h2 {
    margin: 0;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-lg);
    font-weight: 400;
  }

  .count {
    font-size: 13px;
    color: var(--pv-text-faint);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 28px;
  }

  .card {
    width: 100%;
    height: 150px;
    border: 0;
    background: var(--pv-paper);
    color: var(--pv-ink);
    box-shadow: var(--pv-shadow-card);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 20px;
    font-family: var(--pv-font-manuscript);
    text-align: center;
  }

  .card.stacked {
    box-shadow:
      var(--pv-shadow-card),
      4px 4px 0 -1px var(--pv-paper-under),
      4px 4px 0 0 var(--pv-line-strong);
  }

  .card:hover {
    transform: translateY(-2px);
  }

  .kind {
    font-family: var(--pv-font-ui);
    font-size: 10px;
    letter-spacing: var(--pv-track-chapter);
    text-transform: uppercase;
    color: var(--pv-ink-accent);
  }

  .title {
    font-size: 19px;
  }

  .bar {
    height: 2px;
    margin-top: 12px;
    background: var(--pv-divider);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--pv-accent);
  }

  .meta {
    display: flex;
    justify-content: space-between;
    margin: 6px 0 0;
    font-size: var(--pv-text-md);
    color: var(--pv-text-subtle);
  }

  .snapshots ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .snapshots li {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--pv-line);
    color: var(--pv-text-muted);
    font-size: var(--pv-text-md);
  }

  .snapshots button,
  .snapshots h2 {
    border: 0;
    background: transparent;
    color: var(--pv-accent);
    padding: 0;
    font-size: var(--pv-text-md);
  }

  .error {
    color: var(--danger);
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @media (max-width: 980px) {
    .hero,
    .projects,
    .snapshots {
      padding-left: 28px;
      padding-right: 28px;
    }

    .hero,
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
