<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Sidebar from "$lib/chapters/Sidebar.svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import Ribbon from "$lib/editor/Ribbon.svelte";
  import CommentRail from "$lib/editor/CommentRail.svelte";
  import StatusBar from "$lib/editor/StatusBar.svelte";
  import TitleBar from "$lib/editor/TitleBar.svelte";
  import { countWords, wordsFor } from "$lib/editor/counts";
  import { shrinkImage } from "$lib/editor/imageSize";
  import { replaceInDocument, searchChapters, findNext, replaceAll, replaceNext } from "$lib/editor/find";
  import { createChapter, createProject, effectiveLanguage, type Chapter, type DocumentJson, type Project, type ProjectKind, type SnapshotInfo, type WritingLanguage } from "$lib/model";
  import { createAutosave, errorMessage, type SaveStatus } from "$lib/save/autosave";
  import { chaptersToHtml, chaptersToMarkdown, chaptersToPlain } from "$lib/export/document";
  import { ALREADY_EXISTS, CHANGED_ELSEWHERE, MUST_BE_NEW, chooseSavePath, inFolder, writeFileTo, type ExportKind } from "$lib/export/files";
  import { wordFileFor, wordLook } from "$lib/export/wordAssets";
  import { appendBookChapters, readWordFile, replaceBookChapters, type WordImport } from "$lib/export/wordImport";
  import { createAmbience } from "$lib/ambience";
  import { chooseBackupFile, chooseBackupFolder, chooseProjectFile, readBackupFile, writeBackup } from "$lib/storage/backup";
  import { backupSignature, type BackupContent } from "$lib/storage/backupFile";
  import Settings from "$lib/views/Settings.svelte";
  import Particles from "$lib/views/Particles.svelte";
  import Book from "$lib/views/Book.svelte";
  import Dashboard from "$lib/views/Dashboard.svelte";
  import HomeHeader from "$lib/views/HomeHeader.svelte";
  import Notes from "$lib/views/Notes.svelte";
  import Outline from "$lib/views/Outline.svelte";
  import Todos from "$lib/views/Todos.svelte";
  import ChapterPanel from "$lib/views/ChapterPanel.svelte";
  import { flushPrefs, loadPrefs, loadPrefsFile, manuscriptFamily, pageWidthValue, resolvedTheme, savePrefs, type KnownProject } from "$lib/prefs";
  import { duplicateChapterProject, patchChapter, removeChapter, renameChapterProject, reorderChapterList, setChapterText } from "$lib/chapters/mutate";
  import { chapterTitle, firstChapters } from "$lib/chapters/welcome";
  import { chapterName, roman } from "$lib/chapters/labels";
  import { summarize } from "$lib/chapters/progress";
  import { notesInChapter } from "$lib/chapters/mentions";
  import { isUntitled } from "$lib/i18n";
  import { locale, snapshotName, t, ui } from "$lib/ui.svelte";
  import { flushNoteSave, listNotes, listTasks, saveNote, saveTask, type Note, type Task } from "$lib/storage/organize";
  import { noteFromComment, todoFromComment } from "$lib/storage/fromComment";
  import type { NoteTarget } from "$lib/editor/noteLinks";
  import { addComment, removeComment, type CommentInfo } from "$lib/editor/comments";
  import { checkpointDatabase, forgetPersonalWord, keepSnapshot, listPersonalWords, readSnapshotChapters, rememberPersonalWord, restoreChapter, restoreFromBackup, sqliteStorage, switchProjectFile } from "$lib/storage/sqlite";
  import type { Editor as TiptapEditor } from "@tiptap/core";
  import { NodeSelection } from "@tiptap/pm/state";

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
  let findScope = $state<"chapter" | "book">("chapter");
  let historyOpen = $state(false);
  let historyList = $state<SnapshotInfo[]>([]);
  let historyPreview = $state("");
  let historySnapshotId = $state("");
  let historyChapterId = $state("");
  let settingsSection = $state<"Appearance" | "Ambience" | "Shortcuts">("Appearance");
  let settingsReturn: HTMLElement | null = null;
  // One-shot requests to the Notes view: make a note (tied to the chapter being written), or open one.
  let noteCreate = $state<{ at: number; chapterId: string } | null>(null);
  let noteOpenRequest = $state<(NoteTarget & { at: number }) | null>(null);
  // The open chapter's footnotes, listed at the foot of the page.
  let pageNotes = $state<string[]>([]);
  let findInput = $state<HTMLInputElement | undefined>(undefined);
  const startPrefs = loadPrefs();
  let prefs = $state(startPrefs);
  // Set before the first paint, so a Slovenian interface never flashes English.
  ui.language = startPrefs.uiLanguage;
  let zen = $state(false);
  /** A comment just added, whose card takes the keyboard. */
  let commentFocus = $state("");
  let commentCount = $state(0);
  // The chapter panel beside the page: the book's notes and to-dos, the note shown open, and a
  // request to put the keyboard in its add field.
  let bookNotes = $state<Note[]>([]);
  let bookTasks = $state<Task[]>([]);
  let panelNote = $state("");
  let panelAddFocus = $state(0);
  /** A short message over the page, such as why a comment could not be added. */
  let writeNotice = $state("");
  let noticeTimer = 0;
  // The app opens on Home, as in the design; "Continue writing" goes back to the last chapter.
  let view = $state<"write" | "home" | "notes" | "todos" | "outline" | "book" | "settings">("home");
  let backupMessage = $state("");
  let projectLocation = $state("");
  let dictionary = $state<{ language: WritingLanguage; word: string }[]>([]);
  let settingsOpen = $state(false);
  let restoring = $state(false);
  let pendingBackup = $state<BackupContent | null>(null);
  let importOffer = $state<{ fileName: string; result: WordImport } | null>(null);
  // A Word copy path that was changed elsewhere; automatic updates leave it alone until "Update now".
  let wordCopyHeld = "";
  // True while the database points at another book file; backups and the Word copy wait.
  let switchingBooks = false;
  let clock = $state(Date.now());
  const ambience = createAmbience();

  const autosave = createAutosave({
    delayMs: 2000,
    save: async () => {
      captureEditor();
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
  const projectId = $derived(project?.id ?? "");
  // The panel follows the chapter's text as it is reported after a pause in typing, not every key.
  const chapterTodos = $derived(bookTasks.filter((task) => task.chapterId === activeId));
  const chapterNotes = $derived(activeChapter ? notesInChapter(bookNotes, activeChapter) : []);
  const panelOpen = $derived(!zen && (prefs.panelTodos || prefs.panelNotes));
  const chapterWords = $derived(activeChapter ? wordsFor(activeChapter.id, activeChapter.plainText) : 0);
  const projectWords = $derived(chapters.reduce((sum, chapter) => sum + wordsFor(chapter.id, chapter.plainText), 0));
  const bookHits = $derived(findScope === "book" ? searchChapters(chapters, findQuery) : []);
  const wordsToday = $derived(
    prefs.writingDay === dayKey(new Date()) ? Math.max(0, projectWords - prefs.dayStartWords) : 0,
  );

  function dayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  $effect(() => {
    if (findOpen && findInput) findInput.focus();
  });

  // Back in Write, the panel reads the notes and to-dos again: they may have changed in their views.
  $effect(() => {
    if (view === "write" && projectId) void loadOrganizer();
  });

  /**
   * Changes the theme with the design's 400ms cross-fade. The fade is one compositor layer, so it
   * costs the editor nothing; it is skipped when motion should stay quiet.
   */
  function applyTheme(next: string) {
    const root = document.documentElement;
    if (root.dataset.theme === next) return;
    const calm = prefs.gentle || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root.dataset.theme || calm || document.hidden || !document.startViewTransition) {
      root.dataset.theme = next;
      return;
    }
    document.startViewTransition(() => {
      root.dataset.theme = next;
    });
  }

  // Follow sunset checks the clock every minute; the settings themselves are saved only when they change.
  $effect(() => {
    applyTheme(resolvedTheme(prefs.theme, new Date(clock)));
  });

  $effect(() => {
    document.documentElement.style.setProperty("--pv-writing-font", manuscriptFamily(prefs.manuscriptFont));
    document.documentElement.style.setProperty("--pv-writing-size", `${prefs.manuscriptSize}px`);
    document.documentElement.dataset.grain = prefs.grain ? "true" : "false";
    document.documentElement.dataset.running = prefs.runningHead ? "true" : "false";
    if (prefs.gentle) document.documentElement.dataset.gentle = "true";
    else delete document.documentElement.dataset.gentle;
    ui.language = prefs.uiLanguage;
    document.documentElement.lang = prefs.uiLanguage;
    savePrefs(prefs);
  });

  $effect(() => {
    if (!project) return;
    const words = projectWords;
    const today = dayKey(new Date());
    if (prefs.writingDay !== today) {
      prefs = { ...prefs, writingDay: today, dayStartWords: words };
    }
  });

  // Plain values, so saving other settings (a backup time, say) doesn't restart the sound.
  const ambienceKind = $derived(prefs.gentle ? "off" : prefs.ambience);
  const ambienceVolume = $derived(prefs.ambienceVolume);

  $effect(() => {
    const kind = ambienceKind;
    if (kind === "off") {
      ambience.stop();
      return;
    }
    ambience.start(kind, untrack(() => ambienceVolume));
    return () => ambience.stop();
  });

  $effect(() => {
    ambience.setVolume(ambienceVolume);
  });

  onMount(() => {
    let disposed = false;
    let unlistenClose: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let closing = false;

    void (async () => {
      try {
        try {
          const stored = await loadPrefsFile();
          if (!disposed && stored) {
            // The database opens with the book path in browser storage, so put the file's settings there first.
            savePrefs(stored);
            prefs = stored;
          } else if (!disposed) savePrefs(prefs);
        } catch {
          // Keep the settings already in this window if the file cannot be read.
        }
        const loaded = await sqliteStorage.load();
        if (disposed) return;
        project = loaded;
        activeId = loaded.chapters[0]?.id ?? null;
        saveStatus = { state: "saved" };
        await refreshWritingExtras();
        rememberBook(loadPrefs().projectPath || projectLocation, loaded);
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
            await flushNoteSave();
            await autosave.flush();
            await flushPrefs();
            try {
              await runDriveBackup(false);
            } catch {
              // The live book is already saved. Home shows the backup failure.
            }
            // Never throws; a problem is shown in Settings next time.
            await updateWordCopy();
            await win.destroy();
          } catch {
            closing = false;
          }
        });
        unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
          if (!focused) {
            // Leaving the window is a good moment to refresh the Word copy: nobody is typing.
            void flushNoteSave()
              .then(() => autosave.flush())
              .then(() => updateWordCopy())
              .catch(() => undefined);
          }
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

    const backupTimer = window.setInterval(() => {
      if (!prefs.backupFolder || !project) return;
      const last = Date.parse(prefs.lastBackupAt);
      if (!Number.isNaN(last) && Date.now() - last < 60 * 60 * 1000) return;
      void runDriveBackup(false);
    }, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(clockTimer);
      window.clearInterval(backupTimer);
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
    if (event.ctrlKey && event.altKey && event.code === "KeyM" && !event.getModifierState("AltGraph") && view === "write") {
      event.preventDefault();
      newComment();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "/") {
      event.preventDefault();
      settingsSection = "Shortcuts";
      settingsReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      settingsOpen = true;
      return;
    }
    if (event.key === "Escape" && settingsOpen) {
      event.preventDefault();
      settingsOpen = false;
      settingsReturn?.focus();
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

  function notice(message: string) {
    writeNotice = message;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => (writeNotice = ""), 3500);
  }

  /** Comments the selection, or the word at the cursor, and puts the keyboard in the new card. */
  function newComment() {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || zen) return;
    const id = crypto.randomUUID();
    const tr = addComment(editor.state, id, new Date().toISOString());
    if (!tr) {
      notice(t("commentNeedsWords"));
      return;
    }
    editor.view.dispatch(tr);
    commentFocus = id;
  }

  /** A comment becomes a to-do for this chapter; it leaves the page and appears in the panel. */
  async function commentToTodo(comment: CommentInfo) {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || !project || !activeId) return;
    const task = todoFromComment(comment, project.id, activeId, new Date().toISOString());
    try {
      await saveTask(task);
    } catch (error) {
      reportSaveError(errorMessage(error));
      return;
    }
    editor.view.dispatch(removeComment(editor.state, comment.id));
    bookTasks = [...bookTasks, task];
    prefs = { ...prefs, panelTodos: true };
  }

  /** A comment becomes a note tied to this chapter, and its words link to the note from then on. */
  async function commentToNote(comment: CommentInfo) {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || !project || !activeId) return;
    const note = noteFromComment(comment, project.id, activeId, new Date().toISOString());
    try {
      await saveNote(note);
    } catch (error) {
      reportSaveError(errorMessage(error));
      return;
    }
    editor.view.dispatch(removeComment(editor.state, comment.id, { noteId: note.id, title: note.title }));
    bookNotes = [note, ...bookNotes];
    panelNote = note.id;
    prefs = { ...prefs, panelNotes: true };
  }

  /** Reads the book's notes and to-dos again for the panel, as they may have changed elsewhere. */
  async function loadOrganizer() {
    const id = projectId;
    if (!id) return;
    try {
      const [notes, tasks] = await Promise.all([listNotes(id), listTasks(id)]);
      if (id !== projectId) return;
      bookNotes = notes;
      bookTasks = tasks;
    } catch {
      // The panel keeps what it had; the Notes and To-dos views report the problem.
    }
  }

  const NEXT_STATE: Record<Task["todoState"], Task["todoState"]> = { todo: "doing", doing: "done", done: "todo" };

  async function toggleChapterTodo(task: Task) {
    const next = { ...task, todoState: NEXT_STATE[task.todoState], updatedAt: new Date().toISOString() };
    bookTasks = bookTasks.map((item) => (item.id === task.id ? next : item));
    try {
      await saveTask(next);
    } catch (error) {
      reportSaveError(errorMessage(error));
      void loadOrganizer();
    }
  }

  async function addChapterTodo(title: string) {
    if (!project || !activeId) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title,
      todoState: "todo",
      updatedAt: new Date().toISOString(),
      chapterId: activeId,
      noteId: "",
    };
    bookTasks = [...bookTasks, task];
    try {
      await saveTask(task);
    } catch (error) {
      reportSaveError(errorMessage(error));
      void loadOrganizer();
    }
  }

  /** Opens a note in the Notes view, from the panel. */
  function openNoteInView(id: string) {
    const note = bookNotes.find((item) => item.id === id);
    view = "notes";
    noteOpenRequest = { id, title: note?.title ?? "", at: Date.now() };
  }

  function reorderChapters(draggedId: string, targetId: string) {
    if (!project) return;
    const next = reorderChapterList(project, draggedId, targetId);
    if (!next) return;
    project = next;
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  function runFind() {
    if (!textEditor || textEditor.isDestroyed) return;
    findMissing = !findNext(textEditor, findQuery);
  }

  async function openHit(id: string) {
    findScope = "chapter";
    if (id !== activeId) await selectChapter(id);
    await tick();
    runFind();
  }

  function runReplace() {
    if (!textEditor || textEditor.isDestroyed) return;
    findMissing = !replaceNext(textEditor, findQuery, replaceQuery);
  }

  async function runReplaceAll() {
    if (findScope === "book" && project && findQuery) {
      captureEditor();
      if (bookHits.length === 0) {
        findMissing = true;
        return;
      }
      try {
        // Undo only reaches the open chapter, so keep the whole book first.
        await keepSnapshot(project);
      } catch (error) {
        saveStatus = { state: "error", message: errorMessage(error) };
        return;
      }
      if (!project) return;
      let total = 0;
      const now = new Date().toISOString();
      const chapters = project.chapters.map((chapter) => {
        if (chapter.id === activeId && textEditor && !textEditor.isDestroyed) return chapter;
        const next = replaceInDocument(chapter.contentJson, chapter.plainText, findQuery, replaceQuery);
        total += next.count;
        return next.count > 0
          ? { ...chapter, contentJson: next.contentJson, plainText: next.plainText, updatedAt: now }
          : chapter;
      });
      project = { ...project, chapters };
      if (textEditor && !textEditor.isDestroyed) total += replaceAll(textEditor, findQuery, replaceQuery);
      findMissing = total === 0;
      if (total > 0) {
        autosave.schedule();
        void autosave.flush().catch(() => undefined);
      }
      return;
    }
    if (!textEditor || textEditor.isDestroyed) return;
    const count = replaceAll(textEditor, findQuery, replaceQuery);
    findMissing = count === 0;
  }

  function cycleAmbience() {
    const order = ["off", "rain", "fire", "cafe", "piano"] as const;
    const index = order.indexOf(prefs.ambience);
    prefs = { ...prefs, ambience: order[(index + 1) % order.length] };
  }

  function captureEditor() {
    const editor = textEditor;
    const id = activeId;
    if (!editor || editor.isDestroyed || !id || !project) return;
    const contentJson = editor.getJSON() as DocumentJson;
    const plainText = editor.getText();
    const updatedAt = new Date().toISOString();
    project = {
      ...project,
      chapters: project.chapters.map((chapter) =>
        chapter.id === id ? { ...chapter, contentJson, plainText, updatedAt } : chapter,
      ),
    };
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

  function updateChapterText(id: string, plainText: string) {
    if (!project) return;
    project = setChapterText(project, id, plainText);
    refreshFootnotes();
  }

  /** Reads the footnotes back from the page, after typing pauses rather than on every key. */
  function refreshFootnotes() {
    const editor = textEditor;
    if (!editor || editor.isDestroyed) {
      pageNotes = [];
      return;
    }
    const found: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "footnote") found.push(String(node.attrs.text ?? ""));
    });
    pageNotes = found;
  }

  /** The footnote selected on the page, with its number, while one is selected. */
  const selectedFootnote = $derived.by(() => {
    void editorRevision;
    const editor = textEditor;
    if (!editor || editor.isDestroyed) return null;
    const { selection, doc } = editor.state;
    if (!(selection instanceof NodeSelection) || selection.node.type.name !== "footnote") return null;
    let number = 0;
    doc.nodesBetween(0, selection.from + 1, (node, pos) => {
      if (node.type.name === "footnote" && pos <= selection.from) number += 1;
    });
    return { pos: selection.from, number, text: String(selection.node.attrs.text ?? "") };
  });

  function setFootnoteText(pos: number, text: string) {
    const editor = textEditor;
    const node = editor && !editor.isDestroyed ? editor.state.doc.nodeAt(pos) : null;
    if (!editor || node?.type.name !== "footnote") return;
    const change = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, text });
    // Changing the note replaces the node; select it again, or the panel would close mid-word.
    change.setSelection(NodeSelection.create(change.doc, pos));
    editor.view.dispatch(change);
    refreshFootnotes();
  }

  function deleteFootnote() {
    textEditor?.chain().focus().deleteSelection().run();
    refreshFootnotes();
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
    const chapter = createChapter(project.id, chapterTitle(project.kind, project.language, position + 1), position);
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
    project = renameChapterProject(project, id, title);
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
    const copied = duplicateChapterProject(project, id);
    if (!copied) return;
    project = copied.project;
    activeId = copied.activeId;
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
    const removed = removeChapter(project, id);
    if (!removed) return;
    project = removed.project;
    if (activeId === id) activeId = removed.activeId;
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // The remaining chapters stay in memory.
    }
  }

  function updateChapterMeta(id: string, patch: Partial<Chapter>) {
    if (!project) return;
    project = patchChapter(project, id, patch);
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  function safeName(title: string): string {
    const cleaned = title.trim().replace(/[<>:"/\\|?*]/g, "") || "pensieve";
    return cleaned;
  }

  /** Saves pending edits, asks where to save, then writes the export there. */
  async function saveExport(kind: ExportKind, contents: (book: Project) => Promise<Uint8Array>) {
    if (!project) return;
    try {
      await flushNoteSave();
      await autosave.flush();
      const book = project;
      const path = await chooseSavePath(`${safeName(book.title)}.${kind}`, kind);
      if (!path) return;
      const written = await writeFileTo(path, await contents(book));
      backupMessage = t("savedTo", { path: written.path });
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  function exportWord() {
    return saveExport("docx", (book) => wordFileFor(book, prefs));
  }

  function exportText(kind: "markdown" | "plain") {
    return saveExport(kind === "markdown" ? "md" : "txt", async (book) => {
      const title = book.title || "Pensieve";
      const text = kind === "markdown" ? chaptersToMarkdown(title, book.chapters) : chaptersToPlain(title, book.chapters);
      return new TextEncoder().encode(text);
    });
  }

  let wordCopyRun: Promise<void> | null = null;

  /**
   * Keeps "<book title>.docx" in the chosen folder up to date. It only writes when the book or its
   * look changed, and never replaces a copy that was changed in Word or a file Pensieve didn't make.
   */
  function updateWordCopy(force = false): Promise<void> {
    if (!project || !prefs.wordCopyFolder || switchingBooks) return Promise.resolve();
    if (wordCopyRun) return wordCopyRun;
    const folder = prefs.wordCopyFolder;
    wordCopyRun = (async () => {
      let path = "";
      try {
        await flushNoteSave();
        await autosave.flush();
        const book = project;
        if (!book) return;
        path = inFolder(folder, `${safeName(book.title)}.docx`);
        if (!force && path === wordCopyHeld) return;
        const signature = `${backupSignature(book, [], [])}|${JSON.stringify(wordLook(prefs))}`;
        const known = prefs.wordCopies[path];
        if (!force && known?.signature === signature && !prefs.wordCopyError) return;
        const written = await writeFileTo(path, await wordFileFor(book, prefs), force ? "" : (known?.stamp ?? MUST_BE_NEW));
        wordCopyHeld = "";
        prefs = {
          ...prefs,
          wordCopies: { ...prefs.wordCopies, [path]: { stamp: written.stamp, signature } },
          wordCopyAt: new Date().toISOString(),
          wordCopyError: "",
        };
      } catch (error) {
        const message = errorMessage(error);
        const name = path.split(/[\\/]/).pop() || t("theWordCopy");
        if (message === CHANGED_ELSEWHERE || message === ALREADY_EXISTS) wordCopyHeld = path;
        const wordCopyError =
          message === CHANGED_ELSEWHERE
            ? t("wordCopyChanged", { name })
            : message === ALREADY_EXISTS
              ? t("wordCopyForeign", { name })
              : message;
        prefs = { ...prefs, wordCopyError };
      } finally {
        wordCopyRun = null;
      }
    })();
    return wordCopyRun;
  }

  async function pickWordCopyFolder() {
    try {
      const folder = await chooseBackupFolder(t("dialogWordCopyFolder"));
      if (!folder) return;
      wordCopyHeld = "";
      prefs = { ...prefs, wordCopyFolder: folder, wordCopyError: "" };
      await updateWordCopy();
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  /** Reads a Word file and shows its chapters before anything changes. */
  async function offerWordImport(file: File) {
    try {
      const result = await readWordFile(await file.arrayBuffer(), file.name.replace(/\.docx$/i, ""));
      for (const chapter of result.chapters) await shrinkPictures(chapter.contentJson);
      importOffer = { fileName: file.name, result };
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function shrinkPictures(node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) {
    if (node.type === "image" && typeof node.attrs?.src === "string") node.attrs.src = await shrinkImage(node.attrs.src);
    for (const child of node.content ?? []) await shrinkPictures(child as typeof node);
  }

  async function confirmWordImport(mode: "replace" | "append") {
    const offer = importOffer;
    if (!offer || !project) return;
    importOffer = null;
    try {
      await withEditorClosed(async () => {
        if (!project) return;
        if (mode === "replace") {
          await keepSnapshot(project);
          const next = replaceBookChapters(project, offer.result.chapters);
          project = offer.result.title && isUntitled(project.title) ? { ...next, title: offer.result.title } : next;
          activeId = project.chapters[0]?.id ?? null;
        } else {
          const before = new Set(project.chapters.map((chapter) => chapter.id));
          project = appendBookChapters(project, offer.result.chapters);
          activeId = project.chapters.find((chapter) => !before.has(chapter.id))?.id ?? activeId;
        }
        autosave.schedule();
        await autosave.flush();
      });
      settingsOpen = false;
      view = "write";
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function copyHtml() {
    if (!project) return;
    try {
      await autosave.flush();
      await navigator.clipboard.writeText(chaptersToHtml(project.title || "Pensieve", project.chapters));
      backupMessage = t("copiedHtml");
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  /** Prints every chapter from the Book view, not whatever happens to be on screen. */
  async function printBook() {
    settingsOpen = false;
    if (zen) await setZen(false);
    view = "book";
    await tick();
    window.print();
  }

  async function openHistory() {
    if (!project) return;
    historyOpen = true;
    historyPreview = "";
    historyChapterId = "";
    try {
      historyList = await sqliteStorage.listSnapshots(project.id);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  async function previewHistory(id: string) {
    historySnapshotId = id;
    try {
      const older = await readSnapshotChapters(id);
      const match = older.find((chapter) => chapter.id === activeId);
      if (!match) {
        historyChapterId = "";
        historyPreview = t("snapshotLacksChapter");
        return;
      }
      historyChapterId = match.id;
      historyPreview = `${match.title}\n\n${match.plainText}`;
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  /**
   * Closes the editor so it hands back its text, saves everything, then runs `work`.
   * The editor reopens on whatever `work` leaves in `project`, so an open editor can't
   * write its older text over a restore.
   */
  async function withEditorClosed(work: () => Promise<void>): Promise<void> {
    restoring = true;
    try {
      await tick();
      await flushNoteSave();
      await autosave.flush();
      await work();
    } finally {
      restoring = false;
    }
  }

  async function restoreHistoryChapter() {
    if (!historySnapshotId || !historyChapterId) return;
    const snapshotId = historySnapshotId;
    const chapterId = historyChapterId;
    try {
      await withEditorClosed(async () => {
        project = await restoreChapter(snapshotId, chapterId);
        activeId = chapterId;
      });
      historyOpen = false;
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  async function restoreSnapshot(id: string): Promise<void> {
    await withEditorClosed(async () => {
      const restored = await sqliteStorage.restore(id);
      project = restored;
      activeId = restored.chapters[0]?.id ?? null;
    });
    view = "write";
  }

  async function pickBackup() {
    try {
      const path = await chooseBackupFile();
      if (path) pendingBackup = await readBackupFile(path);
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function restoreBackup() {
    const backup = pendingBackup;
    if (!backup) return;
    pendingBackup = null;
    try {
      await withEditorClosed(async () => {
        const restored = await restoreFromBackup(backup);
        project = restored;
        activeId = restored.chapters[0]?.id ?? null;
        rememberBook(projectLocation || prefs.projectPath, restored);
      });
      settingsOpen = false;
      view = "write";
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  function backupOffer(backup: BackupContent | null) {
    if (!backup || !project) return null;
    const saved = new Date(backup.savedAt);
    return {
      title: backup.project.title || t("untitled"),
      savedAt: Number.isNaN(saved.getTime()) ? t("unknownDate") : saved.toLocaleString(locale()),
      otherBook: backup.project.id !== project.id,
    };
  }

  function reportSaveError(message: string) {
    saveStatus = { state: "error", message };
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

  function onLanguageBadge() {
    const editor = textEditor;
    const current = project && activeChapter ? effectiveLanguage(project, activeChapter) : "en";
    const next = current === "sl" ? "en" : "sl";
    if (editor && !editor.isDestroyed && !editor.state.selection.empty) {
      setSelectionLanguage(next);
      return;
    }
    setChapterLanguage(next);
  }

  function rememberBook(path: string, book: Project) {
    const bookPath = path.trim();
    if (!bookPath) return;
    const knownProjects = [
      { path: bookPath, title: book.title.trim() || t("untitled"), summary: summarize(book) },
      ...prefs.knownProjects.filter((book) => book.path !== bookPath),
    ].slice(0, 8);
    prefs = { ...prefs, knownProjects };
  }

  function renameProject(title: string) {
    if (!project) return;
    const nextTitle = title.trim() || t("untitled");
    project = { ...project, title: nextTitle };
    rememberBook(projectLocation || prefs.projectPath, project);
    autosave.schedule();
  }

  async function useProjectFile(path: string, openWrite = true) {
    // The book being left keeps its card on Home, with today's numbers.
    if (project) rememberBook(projectLocation || prefs.projectPath, project);
    await flushNoteSave();
    await autosave.flush();
    await updateWordCopy();
    const previous = projectLocation || prefs.projectPath || (await invoke<string>("default_project_path"));
    switchingBooks = true;
    let loaded: Project;
    try {
      await switchProjectFile(path);
      prefs = { ...loadPrefs(), writingDay: "" };
      loaded = await sqliteStorage.load();
    } catch (error) {
      // Go back to the open book, or the next autosave would write it into the other file.
      try {
        await switchProjectFile(previous);
        prefs = { ...loadPrefs() };
      } catch {
        // The original error below is the one worth showing.
      }
      throw error;
    } finally {
      switchingBooks = false;
    }
    project = loaded;
    activeId = loaded.chapters[0]?.id ?? null;
    projectLocation = path;
    rememberBook(path, loaded);
    if (openWrite) view = "write";
  }

  /**
   * Writes the example books (a novel, a Slovenian story collection and an article) into their own
   * files in the app folder, then lists them on Home. The open book is never touched, and examples
   * that already exist are only listed again.
   */
  async function addExampleBooks() {
    if (!project) return;
    try {
      const home = projectLocation || prefs.projectPath || (await invoke<string>("default_project_path"));
      const { EXAMPLE_BOOKS, buildExample } = await import("$lib/samples/examples");
      const added: KnownProject[] = [];
      await withEditorClosed(async () => {
        await updateWordCopy();
        switchingBooks = true;
        try {
          for (const example of EXAMPLE_BOOKS) {
            const target = await invoke<{ path: string; exists: boolean }>("example_book_path", { name: example.slug });
            if (!target.exists) {
              await switchProjectFile(target.path);
              const blank = await sqliteStorage.load();
              const built = buildExample(example, blank.id);
              await sqliteStorage.save(built.project);
              for (const note of built.notes) await saveNote(note);
              for (const task of built.tasks) await saveTask(task);
            }
            const known = prefs.knownProjects.find((book) => book.path === target.path);
            added.push(known?.summary ? known : { path: target.path, title: example.title, summary: summarize(buildExample(example, "").project) });
          }
        } finally {
          await switchProjectFile(home);
          switchingBooks = false;
        }
      });
      const paths = new Set(added.map((book) => book.path));
      prefs = { ...prefs, knownProjects: [...prefs.knownProjects.filter((book) => !paths.has(book.path)), ...added] };
      backupMessage = t("examplesAdded");
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function openKnownBook(path: string) {
    try {
      // Opening a missing file would quietly create an empty book in its place.
      if (!(await invoke<boolean>("project_file_exists", { path }))) {
        throw new Error(t("bookFileMissing", { path }));
      }
      await useProjectFile(path);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  async function openAnotherProject() {
    try {
      const path = await chooseProjectFile();
      if (!path) return;
      await useProjectFile(path);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  async function startNewProject(kind: ProjectKind = "novel") {
    try {
      const folder = await chooseBackupFolder(t("dialogNewBookFolder"));
      if (!folder) return;
      const backup = prefs.backupFolder.replace(/[\\/]+$/, "").toLowerCase();
      const chosen = folder.replace(/[\\/]+$/, "").toLowerCase();
      if (backup && (chosen === backup || chosen.startsWith(`${backup}\\`) || chosen.startsWith(`${backup}/`))) {
        saveStatus = { state: "error", message: t("keepOutsideBackup") };
        return;
      }
      const path = await invoke<string>("reserve_project_path", { folder });
      // Stay on Home until the welcome page is in place, or the editor would open on the
      // blank first chapter and save that blank text over the welcome page.
      await useProjectFile(path, false);
      const folderName = folder.split(/[/\\]/).filter(Boolean).pop() || t("newBookName");
      if (!project) return;
      const chapters = firstChapters(project.id, kind, folderName, ui.language);
      project = { ...project, title: folderName, kind, chapters };
      activeId = chapters[0].id;
      rememberBook(path, project);
      autosave.schedule();
      await autosave.flush();
      view = "write";
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  function setBookGoal(words: number) {
    if (!project) return;
    project = { ...project, wordGoal: words };
    autosave.schedule();
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

  async function removeDictionaryWord(language: WritingLanguage, word: string) {
    try {
      await forgetPersonalWord(language, word);
      dictionary = await listPersonalWords();
      try {
        await invoke("remove_personal_word", { language, word });
      } catch {
        // Pensieve has forgotten the word; only Windows' copy is left, and it does no harm.
      }
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function moveProject() {
    if (!project) return;
    try {
      const folder = await chooseBackupFolder(t("dialogMoveProject"));
      if (!folder) return;
      await flushNoteSave();
      await autosave.flush();
      await checkpointDatabase();
      const source = loadPrefs().projectPath || (await invoke<string>("default_project_path"));
      const destination = await invoke<string>("relocate_project", { source, folder });
      await switchProjectFile(destination);
      projectLocation = destination;
      // The old file stays behind as a copy; keep it off Home so nobody edits the stale one.
      prefs = { ...prefs, knownProjects: prefs.knownProjects.filter((book) => book.path !== source) };
      rememberBook(destination, project);
      backupMessage = t("projectMoved", { path: destination });
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }
  async function pickBackupFolder() {
    try {
      const folder = await chooseBackupFolder(t("dialogBackupFolder"));
      if (folder) prefs = { ...prefs, backupFolder: folder };
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  let driveBackup: Promise<void> | null = null;

  function runDriveBackup(announce: boolean): Promise<void> {
    if (!project || !prefs.backupFolder || switchingBooks) return Promise.resolve();
    if (driveBackup) return driveBackup;
    const folder = prefs.backupFolder;
    driveBackup = (async () => {
      try {
        await flushNoteSave();
        await autosave.flush();
        const book = project;
        if (!book) return;
        // Automatic backups skip identical copies, so idle hours don't push older versions out of the folder.
        const result = await writeBackup(folder, book, announce ? "" : prefs.lastBackupSignature);
        prefs = {
          ...prefs,
          lastBackupAt: new Date().toISOString(),
          lastBackupError: "",
          lastBackupSignature: result.signature,
        };
        if (announce) backupMessage = result.path ? t("savedTo", { path: result.path }) : t("saved");
      } catch (error) {
        const message = errorMessage(error);
        prefs = { ...prefs, lastBackupError: message };
        if (announce) backupMessage = message;
        else saveStatus = { state: "error", message: t("backupFailedMessage", { message }) };
        throw error;
      } finally {
        driveBackup = null;
      }
    })();
    return driveBackup;
  }

  async function backupNow() {
    try {
      await runDriveBackup(true);
    } catch {
      // The message is already on screen.
    }
  }

  function statusText(status: SaveStatus): string {
    if (status.state === "saving") return t("saving");
    if (status.state === "unsaved") return t("unsaved");
    if (status.state === "error") return t("notSaved");
    return t("saved");
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet homeHeader()}
  <HomeHeader
    {prefs}
    now={clock}
    error={saveStatus.state === "error" ? saveStatus.message : ""}
    appearance={resolvedTheme(prefs.theme, new Date(clock))}
    {settingsOpen}
    onLanguage={() => (prefs = { ...prefs, uiLanguage: prefs.uiLanguage === "sl" ? "en" : "sl" })}
    onTheme={(theme) => (prefs = { ...prefs, theme })}
    onSettings={() => {
      settingsSection = "Appearance";
      settingsReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      settingsOpen = true;
    }}
  />
{/snippet}

<div class="app" class:zen>
  {#if view !== "home"}
  <TitleBar
    project={project?.title ?? t("untitled")}
    {view}
    saveLabel={statusText(saveStatus)}
    saveState={saveStatus.state}
    language={project && activeChapter ? (effectiveLanguage(project, activeChapter) === "sl" ? "SL" : "EN") : "EN"}
    error={saveStatus.state === "error" ? saveStatus.message : ""}
    onView={(next) => {
      if (zen) void setZen(false);
      view = next;
    }}
    onLanguage={onLanguageBadge}
    onHome={() => {
      if (zen) void setZen(false);
      view = "home";
    }}
    {settingsOpen}
    appearance={resolvedTheme(prefs.theme, new Date(clock))}
    onSettings={() => {
      if (zen) void setZen(false);
      settingsSection = "Appearance";
      settingsReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      settingsOpen = true;
    }}
  />
  {/if}
  {#if view === "write"}
  <Ribbon
    editor={textEditor}
    revision={editorRevision}
    chaptersOpen={!collapsed}
    notesOpen={prefs.panelNotes}
    todosOpen={prefs.panelTodos}
    notesCount={chapterNotes.length}
    todosCount={chapterTodos.filter((task) => task.todoState !== "done").length}
    onToggleChapters={() => (collapsed = !collapsed)}
    onToggleNotes={() => (prefs = { ...prefs, panelNotes: !prefs.panelNotes })}
    onToggleTodos={() => (prefs = { ...prefs, panelTodos: !prefs.panelTodos })}
    onFind={() => {
      replaceMode = false;
      findOpen = true;
      findMissing = false;
      view = "write";
    }}
    manuscriptFont={prefs.manuscriptFont}
    manuscriptSize={prefs.manuscriptSize}
    onFont={(font) => (prefs.manuscriptFont = font)}
    onSize={(size) => (prefs.manuscriptSize = size)}
    onNewNote={() => {
      // Notes are written in the Notes view; one made from here belongs to this chapter.
      noteCreate = { at: Date.now(), chapterId: activeId ?? "" };
      view = "notes";
    }}
    onAddTodo={() => {
      prefs = { ...prefs, panelTodos: true };
      panelAddFocus += 1;
    }}
    onReplace={() => {
      replaceMode = true;
      findOpen = true;
      findMissing = false;
      view = "write";
    }}
    loadNotes={() => (project ? listNotes(project.id) : Promise.resolve([]))}
    onComment={newComment}
  />
  {/if}
  {#if view === "write"}
<div class="shell" class:collapsed class:zen class:paneled={panelOpen} class:article={project?.kind === "article"}>
  <Sidebar
    {chapters}
    {activeId}
    {collapsed}
    hidden={project?.kind === "article"}
    onSelect={selectChapter}
    onCreate={addChapter}
    onRename={renameChapter}
    onDuplicate={duplicateChapter}
    onDelete={deleteChapter}
    onReorder={reorderChapters}
    onPatch={updateChapterMeta}
    onHistory={() => void openHistory()}
  />
  <section class="writing">
    <!-- Candlelit sparks drift over the desk, behind the page and everything else here. -->
    <Particles active={resolvedTheme(prefs.theme, new Date(clock)) === "candlelit" && !prefs.gentle} />
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
          aria-label={findScope === "book" ? t("findInBook") : t("findInChapter")}
          placeholder={findScope === "book" ? t("findInBook") : t("findInChapter")}
          oninput={() => (findMissing = false)}
        />
        <button type="button" onclick={() => (findScope = findScope === "book" ? "chapter" : "book")}>
          {findScope === "book" ? t("wholeBook") : t("thisChapter")}
        </button>
        <button type="submit">{t("find")}</button>
        {#if replaceMode}
          <input bind:value={replaceQuery} aria-label={t("replaceWith")} placeholder={t("replaceWith")} />
          <button type="button" onclick={runReplace}>{t("replace")}</button>
          <button type="button" onclick={() => void runReplaceAll()}>{t("replaceAllShort")}</button>
        {/if}
        {#if findMissing}
          <span>{t("notFound")}</span>
        {/if}
      </form>
      {#if findScope === "book" && findQuery.trim()}
        <ul class="hits">
          {#each bookHits as hit (hit.chapterId)}
            <li>
              <button type="button" onclick={() => void openHit(hit.chapterId)}>
                {hit.title} · {hit.count}
              </button>
            </li>
          {:else}
            <li>{t("notFound")}</li>
          {/each}
        </ul>
      {/if}
    {/if}
    {#if writeNotice}
      <p class="write-notice" role="status">{writeNotice}</p>
    {/if}
    {#if selectedFootnote}
      {@const note = selectedFootnote}
      <div class="footnote-edit">
        <label>
          <span>{t("footnoteNumber", { n: note.number })}</span>
          <!-- svelte-ignore a11y_autofocus -->
          <textarea
            rows="2"
            value={note.text}
            placeholder={t("footnoteHint")}
            autofocus={!note.text}
            oninput={(event) => setFootnoteText(note.pos, event.currentTarget.value)}
          ></textarea>
        </label>
        <button type="button" onclick={deleteFootnote}>{t("deleteFootnote")}</button>
      </div>
    {/if}
    {#if historyOpen}
      <div class="history">
        <p>{t("earlierVersionsTitle")}</p>
        {#each historyList as snap (snap.id)}
          <button type="button" onclick={() => void previewHistory(snap.id)}>
            {snapshotName(snap.kind)} · {new Date(snap.createdAt).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })}
          </button>
        {:else}
          <p>{t("noSnapshots")}</p>
        {/each}
        {#if historyPreview}
          <pre>{historyPreview}</pre>
          {#if historyChapterId}
            <button type="button" onclick={() => void restoreHistoryChapter()}>{t("restoreChapter")}</button>
          {/if}
        {/if}
        <button type="button" onclick={() => (historyOpen = false)}>{t("close")}</button>
      </div>
    {/if}
    <div class="stage">
      {#if activeChapter && !restoring}
        {@const chapter = activeChapter}
        {#key chapter.id}
          <div
            class="page-row"
            class:commented={commentCount > 0 && !zen}
            style:--sheet={zen ? `${prefs.columnRem}rem` : pageWidthValue(prefs.pageWidth)}
          >
          <div class="sheet">
            <div class="sheet-under" aria-hidden="true"></div>
            <article class="paper">
              <div class="running">
                <span>{project?.title}</span>
                <span>{roman(chapters.findIndex((item) => item.id === chapter.id) + 1)}</span>
              </div>
              <p class="chapter-label">
                {chapterName(chapters.findIndex((item) => item.id === chapter.id), project?.language, project?.kind)}
              </p>
              <h2 class="chapter-title">{chapter.title}</h2>
              <Editor
                docId={chapter.id}
                initialContent={chapter.contentJson}
                language={project ? effectiveLanguage(project, chapter) : "en"}
                typewriter={prefs.typewriter}
                live={false}
                onChange={(json, text, id) => updateChapter(id ?? chapter.id, json, text)}
                onEdit={() => autosave.schedule()}
                onText={(text, id) => updateChapterText(id ?? chapter.id, text)}
                onEditor={(next) => {
                  textEditor = next;
                  refreshFootnotes();
                }}
                onActivity={() => (editorRevision += 1)}
                onOpenNote={(target) => {
                  // A linked name opens its note in the panel beside the page.
                  const title = target.title.trim().toLowerCase();
                  panelNote = target.id || (bookNotes.find((note) => note.title.trim().toLowerCase() === title)?.id ?? "");
                  prefs = { ...prefs, panelNotes: true };
                }}
              />
              {#if pageNotes.length > 0}
                <ol class="page-notes">
                  {#each pageNotes as note, index (index)}
                    <li>{note || "…"}</li>
                  {/each}
                </ol>
              {/if}
            </article>
          </div>
          {#if !zen}
            <CommentRail
              editor={textEditor}
              revision={editorRevision}
              focusId={commentFocus}
              bind:count={commentCount}
              onFocused={() => (commentFocus = "")}
              onTodo={(comment) => void commentToTodo(comment)}
              onNote={(comment) => void commentToNote(comment)}
            />
          {/if}
          </div>
        {/key}
      {:else}
        <p class="opening">{t("opening")}</p>
      {/if}
    </div>
    <div class="float-wrap">
      <StatusBar
        words={chapterWords}
        {projectWords}
        language={project && activeChapter && effectiveLanguage(project, activeChapter) === "sl" ? t("slovenian") : t("english")}
        saveLabel={statusText(saveStatus)}
        error={saveStatus.state === "error" ? saveStatus.message : ""}
        {zen}
        onZen={() => void setZen(!zen)}
        ambience={prefs.ambience}
        today={wordsToday}
        goal={prefs.dailyGoal}
        onAmbience={cycleAmbience}
        theme={prefs.theme}
        onTheme={(theme) => (prefs.theme = theme)}
      />
    </div>
    {#if zen}
      <div class="zen-hover">
        <div class="zen-bar">
          <button type="button" onclick={() => void setZen(false)}>{t("leaveZen")}</button>
          <label>
            {t("width")}
            <input
              type="range"
              min="32"
              max="60"
              bind:value={prefs.columnRem}
              aria-label={t("columnWidth")}
            />
          </label>
        </div>
      </div>
    {/if}
  </section>
  {#if panelOpen && project && activeChapter}
    <ChapterPanel
      chapterLabel={chapterTitle(project.kind, ui.language, chapters.findIndex((chapter) => chapter.id === activeChapter.id) + 1)}
      title={activeChapter.title}
      todos={chapterTodos}
      notes={chapterNotes}
      book={bookNotes}
      showTodos={prefs.panelTodos}
      showNotes={prefs.panelNotes}
      openNoteId={panelNote}
      addFocus={panelAddFocus}
      onToggleTodo={(task) => void toggleChapterTodo(task)}
      onAddTodo={(title) => void addChapterTodo(title)}
      onShowNote={(id) => (panelNote = id)}
      onOpenInNotes={openNoteInView}
      onClose={() => (prefs = { ...prefs, panelTodos: false, panelNotes: false })}
    />
  {/if}
</div>
  {:else if project}
    <div class="alt" class:home={view === "home"} class:settings={view === "settings"}>
      {#if view === "home"}
        {@render homeHeader()}
        <span class="decor-low" aria-hidden="true"></span>
        <Dashboard
          {project}
          {prefs}
          now={clock}
          {wordsToday}
          onContinue={(chapterId) => {
            if (chapterId) activeId = chapterId;
            view = "write";
          }}
          onZen={(chapterId) => {
            if (chapterId) activeId = chapterId;
            view = "write";
            void setZen(true);
          }}
          onOpenTodos={() => (view = "todos")}
          onOpenNotes={() => (view = "notes")}
          onOpenNote={(id, title) => {
            view = "notes";
            noteOpenRequest = { id, title, at: Date.now() };
          }}
          onAmbience={() => {
            settingsSection = "Ambience";
            settingsReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            settingsOpen = true;
          }}
          onSaveError={reportSaveError}
          onRename={renameProject}
          onOpenProject={() => void openAnotherProject()}
          onStartProject={(kind) => void startNewProject(kind)}
          books={prefs.knownProjects}
          currentPath={projectLocation}
          onOpenBook={(path) => void openKnownBook(path)}
          onRestore={restoreSnapshot}
        />
      {:else if view === "notes"}
        <Notes
          projectId={project.id}
          {chapters}
          language={project.language}
          focusChapterId={activeId ?? ""}
          createRequest={noteCreate}
          onCreateHandled={() => (noteCreate = null)}
          openRequest={noteOpenRequest}
          onSaveError={reportSaveError}
          onShowTodos={() => (view = "todos")}
        />
      {:else if view === "todos"}
        <Todos
          projectId={project.id}
          {chapters}
          onSaveError={reportSaveError}
          onShowNotes={() => (view = "notes")}
        />
      {:else if view === "outline"}
        <Outline {chapters} onUpdate={updateChapterMeta} />
      {:else if view === "book"}
        <Book {chapters} />
      {/if}
    </div>
  {:else}
    <div class="alt home">
      {@render homeHeader()}
      <p class="opening">{t("opening")}</p>
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
      bookGoal={project.wordGoal}
      onBookGoal={setBookGoal}
      {dictionary}
      onMoveProject={() => void moveProject()}
      onProjectLanguage={setProjectLanguage}
      onAddWord={(language, word) => void addDictionaryWord(language, word)}
      onRemoveWord={(language, word) => void removeDictionaryWord(language, word)}
      onExport={() => void exportWord()}
      onExportText={(kind) => void exportText(kind)}
      onCopyHtml={() => void copyHtml()}
      onPrint={() => void printBook()}
      backupOffer={backupOffer(pendingBackup)}
      onPickBackup={() => void pickBackup()}
      onRestoreBackup={() => void restoreBackup()}
      onCancelBackup={() => (pendingBackup = null)}
      onImport={(file) => void offerWordImport(file)}
      importPreview={importOffer && {
        fileName: importOffer.fileName,
        chapters: importOffer.result.chapters.map((chapter) => ({ title: chapter.title, words: countWords(chapter.plainText) })),
      }}
      onConfirmImport={(mode) => void confirmWordImport(mode)}
      onCancelImport={() => (importOffer = null)}
      bookTitle={project.title}
      onAddExamples={() => void addExampleBooks()}
      onChooseWordFolder={() => void pickWordCopyFolder()}
      onUpdateWordCopy={() => {
        wordCopyHeld = "";
        void updateWordCopy(true);
      }}
      onStopWordCopy={() => (prefs = { ...prefs, wordCopyFolder: "", wordCopyError: "" })}
      startSection={settingsSection}
      onClose={() => {
        settingsOpen = false;
        settingsReturn?.focus();
      }}
    />
  {/if}
</div>

<style>
  /* Clip, not hidden: nothing, not even a scroll into view, may move the window bar off the top. */
  .app {
    position: relative;
    z-index: 1;
    height: 100%;
    overflow: clip;
    display: flex;
    flex-direction: column;
  }

  /* Zen shows only the text: comments wait outside it. */
  .app.zen :global(.comment) {
    background: none;
  }

  .app.zen :global(.comment-active) {
    box-shadow: none;
  }

  .app.zen :global(.ribbon),
  .app.zen :global(.titlebar),
  .app.zen :global(.statusbar),
  .app.zen .float-wrap {
    display: none;
  }

  /* The chapter panel, 300px beside the page, as in the design's round 5. */
  .shell.paneled {
    grid-template-columns: var(--pv-sidebar-w) minmax(0, 1fr) 300px;
  }

  .shell.collapsed.paneled {
    grid-template-columns: 0 minmax(0, 1fr) 300px;
  }

  .footnote-edit button:hover {
    background: var(--pv-selected);
    color: var(--pv-text);
  }

  .footnote-edit button:active {
    background: var(--pv-pressed);
  }

  .alt {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--pv-desk);
  }

  .alt.home {
    display: flex;
    flex-direction: column;
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

  /* Round 6 adds a third soft circle at the bottom left of Home, behind everything. */
  .alt.home > .decor-low {
    position: absolute;
    left: -90px;
    bottom: -110px;
    z-index: 0;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: var(--pv-decor-2);
    opacity: 0.45;
    pointer-events: none;
  }

  .shell,
  .alt {
    animation: rise var(--pv-dur) var(--pv-ease);
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

  .shell.article {
    grid-template-columns: minmax(0, 1fr);
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
    /* Its own stack, so the particles can sit just above the desk and below everything on it. */
    isolation: isolate;
    /* The lamp glow reaches past the bottom; clipping it keeps the window from scrolling. */
    overflow: clip;
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
    color: var(--pv-text-muted);
    font-size: var(--pv-text-base);
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

  .hits,
  .history {
    margin: 0 0.9rem 0.6rem;
    padding: 0;
    list-style: none;
    color: var(--pv-text-muted);
    font-size: var(--pv-text-base);
  }

  .find button,
  .hits button,
  .history button,
  .zen-bar button {
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0.25rem 0.4rem;
    background: transparent;
    color: var(--pv-text);
  }

  .find button:hover,
  .hits button:hover,
  .history button:hover,
  .zen-bar button:hover {
    background: var(--pv-selected);
  }

  .find button:active,
  .hits button:active,
  .history button:active,
  .zen-bar button:active {
    background: var(--pv-pressed);
  }

  .history {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
    max-height: 16rem;
    overflow: auto;
  }

  .history pre {
    white-space: pre-wrap;
    margin: 0;
    max-width: 40rem;
    color: var(--pv-text);
  }

  @media print {
    :global(.titlebar),
    :global(.ribbon),
    :global(.sidebar),
    :global(.statusbar),
    :global(.panel),
    .find,
    .hits,
    .history {
      display: none !important;
    }

    .app,
    .alt,
    .shell,
    .writing,
    .stage,
    .sheet,
    .paper {
      overflow: visible !important;
      height: auto !important;
      box-shadow: none !important;
    }
  }

  .stage {
    position: relative;
    overflow: auto;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 30px 24px 72px;
  }

  /* The page, centred, with a column on the right for comment cards when the chapter has any. */
  .page-row {
    flex: 1 0 auto;
    display: grid;
    /* 12px more than the page leaves room for the sheet underneath. */
    grid-template-columns: minmax(0, 1fr) minmax(0, calc(var(--sheet, var(--pv-sheet-book)) + 12px)) minmax(0, 1fr);
  }

  /* The cards keep their column: the page stays centred while there is room, then moves left. */
  .page-row.commented {
    grid-template-columns: minmax(0, 1fr) minmax(280px, calc(var(--sheet, var(--pv-sheet-book)) + 12px)) minmax(240px, 1fr);
  }

  .page-row > :global(.rail) {
    grid-column: 3;
  }

  .sheet {
    grid-column: 2;
    position: relative;
    display: flex;
    flex-direction: column;
    width: calc(100% - 12px);
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
    flex: 1;
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
    background: var(--pv-chrome);
    border-bottom: 1px solid var(--pv-line);
    color: var(--pv-text-muted);
    opacity: 0;
    transform: translateY(-8px);
    transition:
      opacity var(--pv-dur) var(--pv-ease),
      transform var(--pv-dur) var(--pv-ease);
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

  .write-notice {
    position: absolute;
    top: 12px;
    left: 50%;
    z-index: 3;
    transform: translateX(-50%);
    margin: 0;
    padding: 6px 12px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-chrome);
    color: var(--pv-text-muted);
    font-size: var(--pv-text-md);
    box-shadow: var(--pv-shadow-slip);
  }

  .footnote-edit {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    margin: 8px auto 0;
    width: min(100% - 32px, 40rem);
    padding: 8px 10px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-chrome);
  }

  .footnote-edit label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--pv-text-sm);
    color: var(--pv-text-subtle);
  }

  .footnote-edit textarea {
    resize: vertical;
    font: inherit;
    font-size: var(--pv-text-md);
    color: var(--pv-text);
    background: var(--pv-field);
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    padding: 4px 6px;
  }

  .footnote-edit button {
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-text-subtle);
    padding: 4px 8px;
  }

  /* The open chapter's footnotes at the foot of the page, as in a printed book. */
  .page-notes {
    margin: 2.2em 0 0;
    padding-left: 1.4em;
    color: var(--pv-ink-2);
    font-size: 0.82em;
    line-height: 1.5;
  }

  .page-notes::before {
    content: "";
    display: block;
    width: 30%;
    margin: 0 0 0.8em -1.4em;
    border-top: 1px solid var(--pv-ink-rule);
  }

  .opening {
    text-align: center;
    color: var(--pv-text-subtle);
    margin-top: 4rem;
  }
</style>
