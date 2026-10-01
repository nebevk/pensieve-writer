<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Sidebar from "$lib/chapters/Sidebar.svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import { createChapter, createProject, type DocumentJson, type Project } from "$lib/model";
  import { createAutosave, errorMessage, type SaveStatus } from "$lib/save/autosave";
  import { sqliteStorage } from "$lib/storage/sqlite";

  let project = $state<Project | null>(null);
  let activeId = $state<string | null>(null);
  let collapsed = $state(false);
  let saveStatus = $state<SaveStatus>({ state: "saved" });
  let loadError = $state<string | null>(null);

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

  function statusText(status: SaveStatus): string {
    if (status.state === "saving") return "Saving…";
    if (status.state === "unsaved") return "Unsaved";
    if (status.state === "error") return "Not saved";
    return "Saved";
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="shell" class:collapsed>
  <Sidebar
    {chapters}
    {activeId}
    {collapsed}
    onSelect={selectChapter}
    onCreate={addChapter}
    onRename={renameChapter}
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
      <p class="status" class:error={saveStatus.state === "error"}>
        {statusText(saveStatus)}
        {#if saveStatus.state === "error"}
          <span role="alert">{saveStatus.message}</span>
        {/if}
      </p>
    </header>
    <div class="stage">
      {#if activeChapter}
        {@const chapter = activeChapter}
        {#key chapter.id}
          <article class="paper">
            <Editor
              initialContent={chapter.contentJson}
              onChange={(json, text) => updateChapter(chapter.id, json, text)}
            />
          </article>
        {/key}
      {:else}
        <p class="opening">Opening…</p>
      {/if}
    </div>
  </section>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 15rem 1fr;
    height: 100vh;
  }

  .shell.collapsed {
    grid-template-columns: 0 1fr;
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
    padding: 0.45rem 0.9rem;
    color: var(--muted);
    font-size: 0.85rem;
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

  .stage {
    overflow: auto;
    flex: 1;
  }

  .paper {
    width: min(44rem, calc(100% - 3rem));
    margin: 1.5rem auto 3rem;
    background: var(--paper);
    min-height: calc(100% - 4.5rem);
  }

  .opening {
    text-align: center;
    color: var(--muted);
    margin-top: 4rem;
  }
</style>
