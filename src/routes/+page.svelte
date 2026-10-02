<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Sidebar from "$lib/chapters/Sidebar.svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import Ribbon from "$lib/editor/Ribbon.svelte";
  import StatusBar from "$lib/editor/StatusBar.svelte";
  import TitleBar from "$lib/editor/TitleBar.svelte";
  import { countWords } from "$lib/editor/counts";
  import { findNext, replaceAll, replaceNext } from "$lib/editor/find";
  import { createChapter, createProject, effectiveLanguage, type Chapter, type DocumentJson, type Project, type WritingLanguage } from "$lib/model";
  import { createAutosave, errorMessage, type SaveStatus } from "$lib/save/autosave";
  import { blocksToDocument, chaptersToDocx, downloadBlob, htmlToChapters } from "$lib/export/document";
  import { createAmbience } from "$lib/ambience";
  import { chooseBackupFolder, writeBackup } from "$lib/storage/backup";
  import Settings from "$lib/views/Settings.svelte";
  import Particles from "$lib/views/Particles.svelte";
  import Book from "$lib/views/Book.svelte";
  import Dashboard from "$lib/views/Dashboard.svelte";
  import Notes from "$lib/views/Notes.svelte";
  import Outline from "$lib/views/Outline.svelte";
  import Todos from "$lib/views/Todos.svelte";
  import { loadPrefs, manuscriptFamily, pageWidthValue, resolvedTheme, savePrefs } from "$lib/prefs";
  import { checkpointDatabase, keepSnapshot, listPersonalWords, rememberPersonalWord, sqliteStorage, switchProjectFile } from "$lib/storage/sqlite";
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
  let replaceQuery = $state("");
  let findMissing = $state(false);
  let replaceMode = $state(false);
  let noteRequest = $state(0);
  let todoRequest = $state(0);
  let findInput = $state<HTMLInputElement | undefined>(undefined);
  let prefs = $state(loadPrefs());
  let zen = $state(false);
  let dock = $state<"notes" | "todos" | null>(null);
  let view = $state<"write" | "home" | "notes" | "todos" | "outline" | "book" | "settings">("write");
  let backupMessage = $state("");
  let projectLocation = $state("");
  let dictionary = $state<{ language: WritingLanguage; word: string }[]>([]);
  let settingsOpen = $state(false);
  let clock = $state(Date.now());
  const ambience = createAmbience();

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
  const wordsToday = $derived(
    prefs.writingDay === dayKey(new Date()) ? Math.max(0, projectWords - prefs.dayStartWords) : 0,
  );

  function dayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  function chapterName(index: number): string {
    const names = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
    return names[index] ? `Chapter ${names[index]}` : `Chapter ${index + 1}`;
  }

  function roman(value: number): string {
    const pairs: [number, string][] = [
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let rest = value;
    let text = "";
    for (const [amount, glyph] of pairs) {
      while (rest >= amount) {
        text += glyph;
        rest -= amount;
      }
    }
    return text || String(value);
  }

  $effect(() => {
    if (findOpen && findInput) findInput.focus();
  });

  $effect(() => {
    document.documentElement.dataset.theme = resolvedTheme(prefs.theme, new Date(clock));
    document.documentElement.style.setProperty("--column", `${Number(prefs.columnRem) || 44}rem`);
    document.documentElement.style.setProperty("--pv-writing-font", manuscriptFamily(prefs.manuscriptFont));
    document.documentElement.style.setProperty("--pv-writing-size", `${prefs.manuscriptSize}px`);
    document.documentElement.dataset.grain = prefs.grain ? "true" : "false";
    document.documentElement.dataset.running = prefs.runningHead ? "true" : "false";
    if (prefs.gentle) document.documentElement.dataset.gentle = "true";
    else delete document.documentElement.dataset.gentle;
    savePrefs(prefs);
  });

  $effect(() => {
    if (!project) return;
    const words = projectWords;
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    if (prefs.writingDay !== today) {
      const missed = prefs.lastWriteDay !== yesterday && prefs.lastWriteDay !== today;
      prefs = {
        ...prefs,
        writingDay: today,
        dayStartWords: words,
        streak: missed ? 0 : prefs.streak,
      };
      return;
    }
    if (words > prefs.dayStartWords && prefs.lastWriteDay !== today) {
      prefs = {
        ...prefs,
        lastWriteDay: today,
        streak: prefs.lastWriteDay === yesterday ? prefs.streak + 1 : 1,
      };
    }
  });

  $effect(() => {
    if (prefs.gentle || prefs.ambience === "off") {
      ambience.stop();
      return;
    }
    ambience.start(prefs.ambience, prefs.ambienceVolume);
    return () => ambience.stop();
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
        await refreshWritingExtras();
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

    const clockTimer = window.setInterval(() => {
      clock = Date.now();
    }, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(clockTimer);
      ambience.stop();
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
    if (event.key === "Escape" && settingsOpen) {
      event.preventDefault();
      settingsOpen = false;
      return;
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

  function runReplace() {
    if (!textEditor || textEditor.isDestroyed) return;
    findMissing = !replaceNext(textEditor, findQuery, replaceQuery);
  }

  function runReplaceAll() {
    if (!textEditor || textEditor.isDestroyed) return;
    const count = replaceAll(textEditor, findQuery, replaceQuery);
    findMissing = count === 0;
  }

  function cycleAmbience() {
    const order = ["off", "rain", "fire"] as const;
    const index = order.indexOf(prefs.ambience);
    prefs = { ...prefs, ambience: order[(index + 1) % order.length] };
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
    copy.synopsis = source.synopsis;
    copy.language = source.language;
    copy.status = source.status;
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

  function updateChapterMeta(id: string, patch: Partial<Chapter>) {
    if (!project) return;
    project = {
      ...project,
      chapters: project.chapters.map((chapter) =>
        chapter.id === id ? { ...chapter, ...patch, updatedAt: new Date().toISOString() } : chapter,
      ),
    };
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  async function exportWord() {
    if (!project) return;
    try {
      const blob = await chaptersToDocx(project.title || "Pensieve", project.chapters);
      downloadBlob(blob, `${project.title || "pensieve"}.docx`);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  async function importWord(file: File) {
    if (!project) return;
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const imported = htmlToChapters(result.value);
      if (imported.length === 0) throw new Error("That Word file had no text to import");
      let position = project.chapters.reduce((max, chapter) => Math.max(max, chapter.position), -1);
      const added = imported.map((chapter) => {
        position += 1;
        const created = createChapter(project!.id, chapter.title, position);
        created.contentJson = blocksToDocument(chapter.blocks);
        created.plainText = chapter.blocks.map((block) => block.inlines.map((inline) => inline.text).join("")).join("\n");
        return created;
      });
      project = { ...project, chapters: [...project.chapters, ...added] };
      activeId = added[0]?.id ?? activeId;
      view = "write";
      autosave.schedule();
      await autosave.flush();
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  async function refreshWritingExtras() {
    try {
      dictionary = await listPersonalWords();
      projectLocation = loadPrefs().projectPath || (await invoke<string>("default_project_path"));
      for (const entry of dictionary) {
        try {
          await invoke("add_personal_word", { language: entry.language, word: entry.word });
        } catch {
          // The word stays in Pensieve even if Windows cannot store it.
        }
      }
    } catch {
      // The manuscript is already open.
    }
  }

  function setChapterLanguage(language: WritingLanguage) {
    if (!activeId) return;
    updateChapterMeta(activeId, { language });
  }

  function setSelectionLanguage(language: WritingLanguage) {
    textEditor?.chain().focus().setMark("textLanguage", { lang: language }).run();
  }

  function setProjectLanguage(language: WritingLanguage) {
    if (!project) return;
    project = { ...project, language };
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  async function addDictionaryWord(language: WritingLanguage, word: string) {
    const cleaned = word.trim();
    if (!cleaned) return;
    try {
      await invoke("add_personal_word", { language, word: cleaned });
      await rememberPersonalWord(language, cleaned);
      dictionary = await listPersonalWords();
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function moveProject() {
    if (!project) return;
    try {
      const folder = await chooseBackupFolder();
      if (!folder) return;
      await checkpointDatabase();
      const source = loadPrefs().projectPath || (await invoke<string>("default_project_path"));
      const destination = await invoke<string>("relocate_project", { source, folder });
      await switchProjectFile(destination);
      projectLocation = destination;
      backupMessage = `Project file moved to ${destination}`;
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }
  async function pickBackupFolder() {
    try {
      const folder = await chooseBackupFolder();
      if (folder) prefs = { ...prefs, backupFolder: folder };
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function backupNow() {
    if (!project || !prefs.backupFolder) return;
    try {
      const path = await writeBackup(prefs.backupFolder, project);
      backupMessage = `Saved ${path}`;
    } catch (error) {
      backupMessage = errorMessage(error);
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

<Particles active={resolvedTheme(prefs.theme, new Date(clock)) === "candlelit" && !prefs.gentle} />
<div class="app" class:zen>
  <TitleBar
    project={project?.title ?? "Untitled"}
    {view}
    saveLabel={statusText(saveStatus)}
    saveState={saveStatus.state}
    language={project && activeChapter ? (effectiveLanguage(project, activeChapter) === "sl" ? "SL" : "EN") : "EN"}
    error={saveStatus.state === "error" ? saveStatus.message : ""}
    onView={(next) => {
      if (zen) void setZen(false);
      view = next;
    }}
    onLanguage={() => {
      const current = project && activeChapter ? effectiveLanguage(project, activeChapter) : "en";
      setChapterLanguage(current === "sl" ? "en" : "sl");
    }}
    onHome={() => {
      if (zen) void setZen(false);
      view = "home";
    }}
    {settingsOpen}
    onSettings={() => {
      if (zen) void setZen(false);
      settingsOpen = true;
    }}
  />
  {#if view === "write"}
  <Ribbon
    editor={textEditor}
    revision={editorRevision}
    chaptersOpen={!collapsed}
    notesOpen={dock === "notes"}
    todosOpen={dock === "todos"}
    onToggleChapters={() => (collapsed = !collapsed)}
    onToggleNotes={() => (dock = dock === "notes" ? null : "notes")}
    onToggleTodos={() => (dock = dock === "todos" ? null : "todos")}
    onFind={() => {
      replaceMode = false;
      findOpen = true;
      findMissing = false;
      view = "write";
    }}
    language={project && activeChapter ? effectiveLanguage(project, activeChapter) : project?.language ?? "en"}
    onChapterLanguage={setChapterLanguage}
    onSelectionLanguage={setSelectionLanguage}
    manuscriptFont={prefs.manuscriptFont}
    manuscriptSize={prefs.manuscriptSize}
    onFont={(font) => (prefs.manuscriptFont = font)}
    onSize={(size) => (prefs.manuscriptSize = size)}
    onNewNote={() => {
      view = "notes";
      noteRequest += 1;
    }}
    onAddTodo={() => {
      view = "todos";
      todoRequest += 1;
    }}
    onReplace={() => {
      replaceMode = true;
      findOpen = true;
      findMissing = false;
      view = "write";
    }}
  />
  {/if}
  {#if view === "write"}
<div class="shell" class:collapsed class:zen class:docked={dock !== null}>
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
        {#if replaceMode}
          <input bind:value={replaceQuery} aria-label="Replace with" placeholder="Replace with" />
          <button type="button" onclick={runReplace}>Replace</button>
          <button type="button" onclick={runReplaceAll}>All</button>
        {/if}
        {#if findMissing}
          <span>Not found</span>
        {/if}
      </form>
    {/if}
    <div class="stage">
      {#if activeChapter}
        {@const chapter = activeChapter}
        {#key chapter.id}
          <div class="sheet" style:--sheet={zen ? `${prefs.columnRem}rem` : pageWidthValue(prefs.pageWidth)}>
            <div class="sheet-under" aria-hidden="true"></div>
            <article class="paper">
              <div class="running">
                <span>{project?.title}</span>
                <span>{roman(chapters.findIndex((item) => item.id === chapter.id) + 1)}</span>
              </div>
              <p class="chapter-label">{chapterName(chapters.findIndex((item) => item.id === chapter.id))}</p>
              <h2 class="chapter-title">{chapter.title}</h2>
              <Editor
                initialContent={chapter.contentJson}
                language={project ? effectiveLanguage(project, chapter) : "en"}
                typewriter={prefs.typewriter}
                onChange={(json, text) => updateChapter(chapter.id, json, text)}
                onEditor={(next) => (textEditor = next)}
                onActivity={() => (editorRevision += 1)}
              />
            </article>
          </div>
        {/key}
      {:else}
        <p class="opening">Opening…</p>
      {/if}
    </div>
    <div class="float-wrap">
      <StatusBar
        words={chapterWords}
        {projectWords}
        language={project && activeChapter ? (effectiveLanguage(project, activeChapter) === "sl" ? "Slovenian" : "English") : "English"}
        saveLabel={statusText(saveStatus)}
        error={saveStatus.state === "error" ? saveStatus.message : ""}
        {zen}
        onZen={() => void setZen(!zen)}
        ambience={prefs.ambience}
        today={wordsToday}
        goal={prefs.dailyGoal}
        onAmbience={cycleAmbience}
      />
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
  {#if dock && project && !zen}
    <aside class="dock">
      <div class="dock-tabs">
        <button type="button" class:active={dock === "notes"} onclick={() => (dock = "notes")}>Notes</button>
        <button type="button" class:active={dock === "todos"} onclick={() => (dock = "todos")}>To-dos</button>
        <button type="button" class="close" onclick={() => (dock = null)}>Close</button>
      </div>
      {#if dock === "notes"}
        <Notes
          compact
          projectId={project.id}
          {chapters}
          language={project.language}
          onShowTodos={() => (dock = "todos")}
        />
      {:else}
        <Todos compact projectId={project.id} {chapters} onShowNotes={() => (dock = "notes")} />
      {/if}
    </aside>
  {/if}
</div>
  {:else if project}
    <div class="alt" class:home={view === "home"} class:settings={view === "settings"}>
      {#if view === "home"}
        <Dashboard
          {project}
          {prefs}
          saveLabel={statusText(saveStatus)}
          {wordsToday}
          onContinue={() => (view = "write")}
          onRestored={(restored) => {
            project = restored;
            activeId = restored.chapters[0]?.id ?? null;
            view = "write";
          }}
        />
      {:else if view === "notes"}
        <Notes
          projectId={project.id}
          {chapters}
          language={project.language}
          createRequest={noteRequest}
          onShowTodos={() => (view = "todos")}
        />
      {:else if view === "todos"}
        <Todos
          projectId={project.id}
          {chapters}
          focusRequest={todoRequest}
          onShowNotes={() => (view = "notes")}
        />
      {:else if view === "outline"}
        <Outline {chapters} onUpdate={updateChapterMeta} />
      {:else if view === "book"}
        <Book {chapters} />
      {/if}
    </div>
  {/if}
  {#if settingsOpen && project}
    <Settings
      {prefs}
      {backupMessage}
      onChange={(patch) => (prefs = { ...prefs, ...patch })}
      onChooseFolder={() => void pickBackupFolder()}
      onBackup={() => void backupNow()}
      {projectLocation}
      projectLanguage={project.language}
      {dictionary}
      onMoveProject={() => void moveProject()}
      onProjectLanguage={setProjectLanguage}
      onAddWord={(language, word) => void addDictionaryWord(language, word)}
      onExport={() => void exportWord()}
      onImport={(file) => void importWord(file)}
      onClose={() => (settingsOpen = false)}
    />
  {/if}
</div>

<style>
  .app {
    position: relative;
    z-index: 1;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app.zen :global(.ribbon),
  .app.zen :global(.titlebar),
  .app.zen :global(.statusbar),
  .app.zen .float-wrap {
    display: none;
  }

  .shell.docked {
    grid-template-columns: var(--pv-sidebar-w) minmax(0, 1fr) var(--pv-sidebar-wide-w);
  }

  .shell.collapsed.docked {
    grid-template-columns: 0 minmax(0, 1fr) var(--pv-sidebar-wide-w);
  }

  .shell.zen.docked {
    grid-template-columns: 0 minmax(0, 1fr);
  }

  .dock {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--pv-chrome);
    border-left: 1px solid var(--pv-line);
    overflow: hidden;
  }

  .dock-tabs {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 6px 8px;
    border-bottom: 1px solid var(--pv-line);
  }

  .dock-tabs button {
    border: 0;
    background: transparent;
    border-radius: var(--pv-radius-xs);
    padding: 4px 8px;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
  }

  .dock-tabs button.active {
    background: var(--pv-selected);
    color: var(--pv-text);
    font-weight: 600;
    box-shadow: inset 0 -2px var(--pv-accent);
  }

  .dock-tabs .close {
    margin-left: auto;
  }

  .dock :global(.notes),
  .dock :global(.board) {
    flex: 1;
    min-height: 0;
  }

  .alt {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--pv-desk);
  }

  .alt.home::before,
  .alt.settings::before,
  .alt.home::after,
  .alt.settings::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .alt.home::before {
    right: -140px;
    top: -160px;
    width: 420px;
    height: 420px;
    background: var(--pv-decor-1);
    opacity: 0.55;
  }

  .alt.home::after {
    right: 300px;
    top: 120px;
    width: 56px;
    height: 56px;
    background: var(--pv-decor-2);
    opacity: 0.8;
  }

  .alt.settings::before {
    left: -60px;
    bottom: -80px;
    width: 220px;
    height: 220px;
    background: var(--pv-decor-2);
    opacity: 0.5;
  }

  .alt.settings::after {
    left: 120px;
    bottom: 70px;
    width: 44px;
    height: 44px;
    background: var(--pv-decor-1);
    opacity: 0.6;
  }

  .alt > :global(*) {
    position: relative;
    z-index: 1;
  }

  .shell,
  .alt,
  .dock {
    animation: rise 220ms ease;
  }

  .shell {
    display: grid;
    grid-template-columns: var(--pv-sidebar-w) minmax(0, 1fr);
    flex: 1;
    min-height: 0;
  }

  .shell.collapsed,
  .shell.zen {
    grid-template-columns: 0 minmax(0, 1fr);
  }

  .shell.zen :global(.sidebar) {
    opacity: 0;
    pointer-events: none;
  }

  .writing {
    position: relative;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--pv-desk);
  }

  .writing::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 180px;
    width: 900px;
    height: 700px;
    transform: translateX(-50%);
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(closest-side, var(--pv-glow), transparent 70%);
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
    border: 1px solid var(--pv-line-strong);
    background: var(--pv-field);
    color: var(--pv-text);
    border-radius: var(--pv-radius-xs);
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
    position: relative;
    overflow: auto;
    flex: 1;
    padding: 30px 24px 72px;
  }

  .sheet {
    position: relative;
    width: min(var(--sheet, var(--pv-sheet-book)), calc(100% - 12px));
    margin: 0 auto;
  }

  .sheet-under {
    position: absolute;
    inset: 0;
    transform: translate(5px, 6px) rotate(0.6deg);
    background: var(--pv-paper-under);
    box-shadow: var(--pv-shadow-under);
  }

  .paper {
    position: relative;
    min-height: calc(100vh - 180px);
    padding: var(--pv-sheet-pad-y) var(--pv-sheet-pad-x);
    background-color: var(--pv-paper);
    background-image: var(--pv-vignette);
    box-shadow: var(--pv-shadow-sheet);
    color: var(--pv-ink);
  }

  :global(:root[data-grain="true"]) .paper {
    background-image: var(--pv-grain), var(--pv-vignette);
  }

  :global(:root[data-running="false"]) .running {
    display: none;
  }

  .running {
    display: flex;
    justify-content: space-between;
    margin-bottom: 64px;
    font-family: var(--pv-font-ui);
    font-size: var(--pv-text-xs);
    letter-spacing: var(--pv-track-running);
    text-transform: uppercase;
    color: var(--pv-ink-meta);
  }

  .chapter-label {
    margin: 0 0 12px;
    text-align: center;
    font-family: var(--pv-font-ui);
    font-size: 12px;
    letter-spacing: var(--pv-track-chapter);
    text-transform: uppercase;
    color: var(--pv-ink-accent);
  }

  .chapter-title {
    margin: 0 0 44px;
    text-align: center;
    font-family: var(--pv-font-manuscript);
    font-size: var(--pv-chapter-title);
    font-weight: 400;
    color: var(--pv-ink);
  }

  .float-wrap {
    position: absolute;
    left: 50%;
    bottom: 16px;
    z-index: 2;
    transform: translateX(-50%);
  }

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
