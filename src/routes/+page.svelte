<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Sidebar from "$lib/chapters/Sidebar.svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import Toolbar from "$lib/editor/Toolbar.svelte";
  import { countWords, formatCount } from "$lib/editor/counts";
  import { findNext } from "$lib/editor/find";
  import { createChapter, createProject, type DocumentJson, type Project } from "$lib/model";
  import { createAutosave, errorMessage, type SaveStatus } from "$lib/save/autosave";
  import { loadPrefs, savePrefs, type ThemeName } from "$lib/prefs";
  import { keepSnapshot, sqliteStorage } from "$lib/storage/sqlite";
  import type { Editor as TiptapEditor } from "@tiptap/core";

  let project = $state<Project | null>(null);
  let activeId = $state<string | null>(null);
  let collapsed = $state(false);
  let saveStatus = $state<SaveStatus>({ state: "saved" });
  let loadError = $state<string | null>(null);
  let textEditor = $state<TiptapEditor | null>(null);
  let editorRevision = $state(0);
  let findOpen = $state(false);
  let findQuery = $state("");
  let findMissing = $state(false);
  let findInput = $state<HTMLInputElement | undefined>(undefined);
  let prefs = $state(loadPrefs());
  let zen = $state(false);

  const autosave = createAutosave({
    delayMs: 2000,
    save: async () => {
      if (!project) return;
      await sqliteStorage.save(project);
    },
    onStatus: (status) => {
      saveStatus = status;
    },
  });

  const chapters = $derived(
    project ? [...project.chapters].sort((a, b) => a.position - b.position) : [],
  );
  const activeChapter = $derived(chapters.find((chapter) => chapter.id === activeId) ?? null);
  const chapterWords = $derived(countWords(activeChapter?.plainText ?? ""));
  const projectWords = $derived(
    chapters.reduce((sum, chapter) => sum + countWords(chapter.plainText), 0),
  );
  const projectCharacters = $derived(
    chapters.reduce((sum, chapter) => sum + chapter.plainText.length, 0),
  );

  $effect(() => {
    if (findOpen && findInput) findInput.focus();
  });

  $effect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.style.setProperty("--column", `${Number(prefs.columnRem) || 44}rem`);
    if (prefs.gentle) document.documentElement.dataset.gentle = "true";
    else delete document.documentElement.dataset.gentle;
    savePrefs(prefs);
  });

  onMount(() => {
    let disposed = false;
    let unlistenClose: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let closing = false;

    void (async () => {
      try {
        const loaded = await sqliteStorage.load();
        if (disposed) return;
        project = loaded;
        activeId = loaded.chapters[0]?.id ?? null;
        saveStatus = { state: "saved" };
      } catch (error) {
        if (disposed) return;
        loadError = errorMessage(error);
        const draft = createProject();
        project = draft;
        activeId = draft.chapters[0]?.id ?? null;
        saveStatus = { state: "error", message: loadError };
      }

      try {
        const win = getCurrentWindow();
        unlistenClose = await win.onCloseRequested(async (event) => {
          if (closing) return;
          event.preventDefault();
          closing = true;
          try {
            await autosave.flush();
            await win.destroy();
          } catch {
            closing = false;
          }
        });
        unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
          if (!focused) void autosave.flush().catch(() => undefined);
        });
        if (disposed) {
          unlistenClose();
          unlistenFocus();
        }
      } catch {
        // The page is open in a browser, outside the Pensieve window.
      }
    })();

    return () => {
      disposed = true;
      unlistenClose?.();
      unlistenFocus?.();
    };
  });

  function onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void autosave.flush().catch(() => undefined);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      findOpen = true;
      findMissing = false;
    }
    if (event.key === "Escape" && zen) {
      event.preventDefault();
      void setZen(false);
      return;
    }
    if (event.key === "Escape" && findOpen) {
      findOpen = false;
      findMissing = false;
      textEditor?.commands.focus();
    }
  }

  async function setZen(on: boolean) {
    zen = on;
    try {
      await getCurrentWindow().setFullscreen(on);
    } catch {
      // Fullscreen is unavailable outside the desktop window.
    }
  }

  function reorderChapters(draggedId: string, targetId: string) {
    if (!project || draggedId === targetId) return;
    const ordered = [...chapters];
    const from = ordered.findIndex((chapter) => chapter.id === draggedId);
    const to = ordered.findIndex((chapter) => chapter.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    project = {
      ...project,
      chapters: ordered.map((chapter, index) => ({ ...chapter, position: index })),
    };
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  function runFind() {
    if (!textEditor || textEditor.isDestroyed) return;
    findMissing = !findNext(textEditor, findQuery);
  }

  function updateChapter(id: string, contentJson: DocumentJson, plainText: string) {
    if (!project) return;
    const updatedAt = new Date().toISOString();
    project = {
      ...project,
      chapters: project.chapters.map((chapter) =>
        chapter.id === id ? { ...chapter, contentJson, plainText, updatedAt } : chapter,
      ),
    };
    autosave.schedule();
  }

  async function selectChapter(id: string) {
    if (id === activeId) return;
    try {
      await autosave.flush();
    } catch {
      // The unsaved text stays in memory and the error stays on screen.
    }
    activeId = id;
  }

  async function addChapter() {
    if (!project) return;
    try {
      await autosave.flush();
    } catch {
      // The new chapter still exists in memory if the write failed.
    }
    const position =
      project.chapters.reduce((max, chapter) => Math.max(max, chapter.position), -1) + 1;
    const chapter = createChapter(project.id, `Chapter ${position + 1}`, position);
    project = { ...project, chapters: [...project.chapters, chapter] };
    activeId = chapter.id;
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // Keep the new chapter in memory.
    }
  }

  async function renameChapter(id: string, title: string) {
    if (!project) return;
    project = {
      ...project,
      chapters: project.chapters.map((chapter) =>
        chapter.id === id ? { ...chapter, title, updatedAt: new Date().toISOString() } : chapter,
      ),
    };
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // The new title stays in memory.
    }
  }

  async function duplicateChapter(id: string) {
    if (!project) return;
    try {
      await autosave.flush();
    } catch {
      // Keep going with the text that is already in memory.
    }
    const source = project.chapters.find((chapter) => chapter.id === id);
    if (!source) return;
    const copy = createChapter(project.id, `${source.title} copy`, source.position + 1);
    copy.contentJson = structuredClone(source.contentJson);
    copy.plainText = source.plainText;
    const chapters = project.chapters.map((chapter) =>
      chapter.position > source.position ? { ...chapter, position: chapter.position + 1 } : chapter,
    );
    chapters.push(copy);
    project = { ...project, chapters };
    activeId = copy.id;
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // The copy stays in memory.
    }
  }

  async function deleteChapter(id: string) {
    if (!project || project.chapters.length < 2) return;
    try {
      await keepSnapshot(project);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
      return;
    }
    const chapters = project.chapters
      .filter((chapter) => chapter.id !== id)
      .sort((a, b) => a.position - b.position)
      .map((chapter, index) => ({ ...chapter, position: index }));
    project = { ...project, chapters };
    if (activeId === id) activeId = chapters[0]?.id ?? null;
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // The remaining chapters stay in memory.
    }
  }

  function statusText(status: SaveStatus): string {
    if (status.state === "saving") return "Saving…";
    if (status.state === "unsaved") return "Unsaved";
    if (status.state === "error") return "Not saved";
    return "Saved";
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="shell" class:collapsed class:zen>
  <Sidebar
    {chapters}
    {activeId}
    {collapsed}
    onSelect={selectChapter}
    onCreate={addChapter}
    onRename={renameChapter}
    onDuplicate={duplicateChapter}
    onDelete={deleteChapter}
    onReorder={reorderChapters}
  />
  <section class="writing">
    <header class="topbar">
      <button
        type="button"
        aria-expanded={!collapsed}
        onclick={() => (collapsed = !collapsed)}
      >
        {collapsed ? "Show chapters" : "Hide chapters"}
      </button>
      <label class="theme">
        Theme
        <select
          aria-label="Theme"
          value={prefs.theme}
          onchange={(event) => {
            prefs.theme = (event.currentTarget as HTMLSelectElement).value as ThemeName;
          }}
        >
          <option value="paper">Paper</option>
          <option value="sepia">Sepia</option>
          <option value="dark">Dark</option>
          <option value="candlelit">Candlelit</option>
        </select>
      </label>
      <button type="button" onclick={() => void setZen(!zen)}>{zen ? "Leave zen" : "Zen"}</button>
      <p class="counts">
        {formatCount(chapterWords, activeChapter?.plainText.length ?? 0)}
        <span>Project {formatCount(projectWords, projectCharacters)}</span>
      </p>
      <p class="status" class:error={saveStatus.state === "error"}>
        {statusText(saveStatus)}
        {#if saveStatus.state === "error"}
          <span role="alert">{saveStatus.message}</span>
        {/if}
      </p>
    </header>
    <Toolbar editor={textEditor} revision={editorRevision} />
    {#if findOpen}
      <form
        class="find"
        onsubmit={(event) => {
          event.preventDefault();
          runFind();
        }}
      >
        <input
          bind:this={findInput}
          bind:value={findQuery}
          aria-label="Find in chapter"
          placeholder="Find in chapter"
          oninput={() => (findMissing = false)}
        />
        <button type="submit">Find</button>
        {#if findMissing}
          <span>Not found</span>
        {/if}
      </form>
    {/if}
    <div class="stage">
      {#if activeChapter}
        {@const chapter = activeChapter}
        {#key chapter.id}
          <article class="paper">
            <Editor
              initialContent={chapter.contentJson}
              onChange={(json, text) => updateChapter(chapter.id, json, text)}
              onEditor={(next) => (textEditor = next)}
              onActivity={() => (editorRevision += 1)}
            />
          </article>
        {/key}
      {:else}
        <p class="opening">Opening…</p>
      {/if}
    </div>
    {#if zen}
      <div class="zen-hover">
        <div class="zen-bar">
          <button type="button" onclick={() => void setZen(false)}>Leave zen</button>
          <label>
            Width
            <input
              type="range"
              min="32"
              max="60"
              bind:value={prefs.columnRem}
              aria-label="Column width"
            />
          </label>
        </div>
      </div>
    {/if}
  </section>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 15rem 1fr;
    height: 100vh;
  }

  .shell.collapsed,
  .shell.zen {
    grid-template-columns: 0 1fr;
  }

  .topbar,
  .counts,
  :global(.toolbar),
  :global(.sidebar) {
    transition: opacity 200ms ease;
  }

  .shell.zen :global(.sidebar) {
    opacity: 0;
    pointer-events: none;
  }

  .shell.zen .topbar,
  .shell.zen :global(.toolbar),
  .shell.zen .find {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .writing {
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.45rem 0.9rem 0.15rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .counts {
    margin: 0;
    display: flex;
    gap: 0.8rem;
    min-width: 0;
    font-size: 0.8rem;
  }

  .counts span {
    color: var(--muted);
  }

  .topbar button {
    border: 0;
    background: transparent;
    padding: 0.25rem 0.4rem;
    border-radius: 6px;
  }

  .topbar button:hover {
    background: rgba(255, 255, 255, 0.35);
  }

  .status {
    margin: 0;
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }

  .status.error {
    color: var(--danger);
  }

  .find {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.9rem 0.45rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .find input {
    width: 16rem;
    max-width: 100%;
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
  }

  .find button {
    border: 0;
    background: transparent;
    border-radius: 6px;
    padding: 0.25rem 0.4rem;
  }

  .find button:hover {
    background: rgba(255, 255, 255, 0.35);
  }

  .stage {
    overflow: auto;
    flex: 1;
  }

  .paper {
    width: min(var(--column), calc(100% - 3rem));
    margin: 1.5rem auto 3rem;
    background: var(--paper);
    min-height: calc(100% - 4.5rem);
    animation: rise 220ms ease;
  }

  .theme {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .theme select,
  .zen-bar input {
    font: inherit;
    color: inherit;
  }

  .zen-hover {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 1.1rem;
    z-index: 5;
  }

  .zen-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.45rem 0.9rem;
    background: var(--sidebar);
    color: var(--muted);
    opacity: 0;
    transform: translateY(-8px);
    transition:
      opacity 200ms ease,
      transform 200ms ease;
  }

  .zen-hover:hover,
  .zen-hover:focus-within {
    height: auto;
  }

  .zen-hover:hover .zen-bar,
  .zen-hover:focus-within .zen-bar {
    opacity: 1;
    transform: none;
  }

  .zen-bar button {
    border: 0;
    background: transparent;
    border-radius: 6px;
    padding: 0.25rem 0.4rem;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .opening {
    text-align: center;
    color: var(--muted);
    margin-top: 4rem;
  }
</style>
