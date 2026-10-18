<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Sidebar from "$lib/chapters/Sidebar.svelte";
  import Ribbon from "$lib/editor/Ribbon.svelte";
  import StatusBar from "$lib/editor/StatusBar.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import TitleBar from "$lib/editor/TitleBar.svelte";
  import ZenBar from "$lib/editor/ZenBar.svelte";
  import { wordsFor } from "$lib/editor/counts";
  import { shrinkImage } from "$lib/editor/imageSize";
  import { PageFind } from "$lib/editor/pageFind.svelte";
  import { Updates } from "$lib/updates.svelte";
  import { DriveBackup, WordCopy, copyPathFor, safeName } from "$lib/save/copies.svelte";
  import { keptCopiesFolder, listKeptCopies, removeKeptCopy } from "$lib/save/kept";
  import { Rescue, besideItsWriting, type RescueOffer } from "$lib/save/rescue.svelte";
  import { WritingActions } from "$lib/chapters/writingActions.svelte";
  import { EarlierVersions } from "$lib/views/earlierVersions.svelte";
  import { createChapter, createWriting, effectiveLanguage, type Chapter, type DocumentJson, type Shelf, type Writing, type WritingLanguage } from "$lib/model";
  import { createAutosave, errorMessage, type SaveStatus } from "$lib/save/autosave";
  import { chaptersToHtml, chaptersToMarkdown, chaptersToPlain } from "$lib/export/document";
  import { chooseSavePath, writeFileTo, type ExportKind } from "$lib/export/files";
  import { wordFileFor } from "$lib/export/wordAssets";
  import { readWordFile, type WordImport } from "$lib/export/wordImport";
  import { byFileName, documentKind, documentName, draftChapters, type DocumentSource } from "$lib/export/importWriting";
  import { createAmbience } from "$lib/ambience";
  import { onPomodoroTurn, pomodoro } from "$lib/pomodoro.svelte";
  import { chooseBackupFile, chooseBackupFolder, chooseDocumentFiles, chooseProjectFile, readBackupFile } from "$lib/storage/backup";
  import type { BackupContent } from "$lib/storage/backupFile";
  import Particles from "$lib/views/Particles.svelte";
  import Tour from "$lib/views/Tour.svelte";
  import { tourFor, type TourPlace } from "$lib/views/tours";
  import Dashboard from "$lib/views/Dashboard.svelte";
  import HomeHeader from "$lib/views/HomeHeader.svelte";
  import ChapterPanel from "$lib/views/ChapterPanel.svelte";
  import { PAPER, SHEET_GAP, flushPrefs, loadPrefs, loadPrefsFile, manuscriptFamily, pageWidthValue, resolvedTheme, savePrefs, type KnownProject, type Prefs } from "$lib/prefs";
  import { duplicateChapterIn, insertChapterAfter, patchChapter, removeChapter, renameChapterIn, reorderChapterList, setChapterText } from "$lib/chapters/mutate";
  import { chapterTitle } from "$lib/chapters/welcome";
  import { applyPage, chapterBreak, composePage, heldHeading, isLeadLine, leadLines, opensChapter, readPage, startsPart, withoutBreaks } from "$lib/chapters/page";
  import { summarize, summarizeOutline, summarizeProject } from "$lib/chapters/progress";
  import { defaultLibraryFolder, firstProject, folderNameProblem, folderOf, isInside, joinPath, lastName, looksSynced, parentFolder, prefsAfterMove, prefsWithoutProject, projectFile, projectFiles, projectFolders, projectName, rebasePath, sameFolder, sortEntries, type LibraryActions, type LibraryEntry, type LibraryView } from "$lib/chapters/library";
  import { moveOpen } from "$lib/chapters/treeState.svelte";
  import { notesInChapter } from "$lib/chapters/mentions";
  import { panelNotes, panelOrder } from "$lib/views/panelNotes";
  import { isUntitled } from "$lib/i18n";
  import { locale, snapshotName, t, ui } from "$lib/ui.svelte";
  import { deleteNote, flushNoteSave, listNotes, saveNote, saveTask, watchNoteSaving, type Note, type NoteCategory, type Task } from "$lib/storage/organize";
  import { ideaNote, namesANote, noteFromComment, noteFromWords, todoFromComment } from "$lib/storage/fromComment";
  import type { NoteTarget } from "$lib/editor/noteLinks";
  import type { CommentInfo } from "$lib/editor/comments";
  import type { ProjectRequest } from "$lib/views/NewProjectWindow.svelte";
  import type { SearchHit, SearchSource } from "$lib/views/searchAll";
  import { otherCards, type IdeaCard } from "$lib/views/ideas";
  import { addWriting, copyOpenProject, forgetPersonalWord, keepSnapshot, listPersonalWords, loadWriting, openShelf, readOpenShelf, readProjectIdeas, readProjectText, moveProjectFile, rememberPersonalWord, restoreFromBackup, setShelf, setWritingFields, snapshotSavedWriting, sqliteStorage, writeSampleProject, type NewProject, type OpenedProject } from "$lib/storage/sqlite";
  import { NotesStore } from "$lib/notes.svelte";
  import { Session } from "$lib/session.svelte";
  import type { Editor as TiptapEditor } from "@tiptap/core";
  import type { NodeSelection } from "@tiptap/pm/state";
  import { lazy } from "$lib/lazy.svelte";

  // Home does not need these, so they are read once it is up (see onMount), or when first shown.
  const EditorPart = lazy(() => import("$lib/editor/Editor.svelte"));
  const CommentRailPart = lazy(() => import("$lib/editor/CommentRail.svelte"));
  const NotesPart = lazy(() => import("$lib/views/Notes.svelte"));
  const TodosPart = lazy(() => import("$lib/views/Todos.svelte"));
  const SettingsPart = lazy(() => import("$lib/views/Settings.svelte"));
  const OutlinePart = lazy(() => import("$lib/views/Outline.svelte"));
  const BookPart = lazy(() => import("$lib/views/Book.svelte"));
  const HistoryPart = lazy(() => import("$lib/views/History.svelte"));
  const WelcomePart = lazy(() => import("$lib/views/Welcome.svelte"));
  const NotePanePart = lazy(() => import("$lib/views/NotePane.svelte"));
  const SelectionBarPart = lazy(() => import("$lib/editor/SelectionBar.svelte"));
  const NewProjectPart = lazy(() => import("$lib/views/NewProjectWindow.svelte"));
  const BringInPart = lazy(() => import("$lib/views/BringInWindow.svelte"));
  const QuickIdeaPart = lazy(() => import("$lib/views/QuickIdea.svelte"));
  const SearchPart = lazy(() => import("$lib/views/SearchWindow.svelte"));
  const IdeasPart = lazy(() => import("$lib/views/IdeasView.svelte"));
  const FindPart = lazy(() => import("$lib/editor/FindPanel.svelte"));
  const SaveTroublePart = lazy(() => import("$lib/views/SaveTrouble.svelte"));
  const RescueOfferPart = lazy(() => import("$lib/views/RescueOffer.svelte"));

  // The writing open in Write: one of the open project's writings, with all its chapters. Raw: every change
  // replaces it (and the chapters that changed), so a save walks plain objects, not Svelte's proxies (ARCH-7).
  let writing = $state.raw<Writing | null>(null);
  // The open project, as its file holds it: the key for its notes and to-dos, its name, folders and writings.
  let shelf = $state.raw<Shelf | null>(null);
  // The library folder, and its folders and projects as last read from disk.
  let libraryRoot = $state("");
  let libraryEntries = $state.raw<LibraryEntry[]>([]);
  let activeId = $state<string | null>(null);
  let collapsed = $state(false);
  let saveStatus = $state<SaveStatus>({ state: "saved" });
  let loadError = $state<string | null>(null);
  let textEditor = $state<TiptapEditor | null>(null);
  // The chapter the open editor holds. Saving goes by this, not by the chapter picked in the list,
  // which can change a moment before the editor does.
  let editorChapter = "";
  // Whether the open page was given a part line when it opened. Chapters can be reordered while it is
  // open, and its page is read against what it showed (chapters/page.ts, applyPage).
  let editorBegan = false;
  // The writing the open page belongs to, and whether that writing was split into chapters when it opened:
  // the page goes back into that writing, read as it was shown, even if another one is open by then.
  let editorWriting = "";
  let editorSplit = true;
  let editorRevision = $state(0);
  // Find (owner, 13 October): its box, the page's matches and replacing (see pageFind.svelte.ts); where a
  // place from its list opens is here, in openFindHit.
  const find = new PageFind({
    editor: () => textEditor,
    editorChapter: () => editorChapter,
    editorWriting: () => editorWriting,
    writing: () => writing,
    setWriting: (next) => (writing = next),
    shelf: () => shelf,
    captureEditor: () => captureEditor(),
    save: async () => {
      autosave.schedule();
      await autosave.flush().catch(() => undefined);
    },
    refreshShelf: () => refreshShelf(),
    // The open project alone: what she has just written saved first.
    readProject: async () => {
      await autosave.flush().catch(() => undefined);
      await flushNoteSave().catch(() => undefined);
      const path = session.path;
      return { sources: [{ path, name: shelf?.title || projectName(path), text: await readProjectText(path) }], unread: [] };
    },
    readEveryProject: (progress) => readEveryProject(progress),
  });
  // Earlier versions of the open writing (SV-3; see earlierVersions.svelte.ts).
  const versions = new EarlierVersions({
    writing: () => writing,
    activeChapter: () => activeId,
    putBack: (restore, open) =>
      withEditorClosed(async () => {
        const restored = await restore();
        const before = writingWords;
        writing = restored;
        keepToday(before);
        activeId = open(restored);
      }),
    fail: (message) => (saveStatus = { state: "error", message }),
  });
  // The project's notes and to-dos, one copy for the page, the panel and the library, with the note shown in
  // the panel beside the page (owner, 12 October) as a draft while she types it (ARCH-13, notes.svelte.ts).
  const notesStore = new NotesStore({ projectId: () => projectId });
  // The panel's search through the notes, and whether its to-dos are the chapter's or the project's.
  let noteQuery = $state("");
  let todoScope = $state<"chapter" | "all">("chapter");
  let settingsSection = $state<"Appearance" | "Ambience" | "Shortcuts" | "General" | "Writing & goals">("Appearance");
  let settingsReturn: HTMLElement | null = null;
  // A one-shot request to the Notes view: the note to open.
  let noteOpenRequest = $state<(NoteTarget & { at: number }) | null>(null);
  // The open chapter's footnotes, listed at the foot of the page.
  let pageNotes = $state<string[]>([]);
  // Words selected on the page, which the floating bar counts ("12 of 1,240 words").
  let selectedWords = $state(0);
  const startPrefs = loadPrefs();
  let prefs = $state(startPrefs);
  // Set before the first paint, so a Slovenian interface never flashes English.
  ui.language = startPrefs.uiLanguage;
  let zen = $state(false);
  // Pages (Settings → Paper): the sheet the chapter is written on, or null for the continuous page,
  // which Zen always is. The editor says how many sheets the text fills.
  const paperSize = $derived(PAPER[prefs.paperSize]);
  const sheet = $derived(
    prefs.paper === "pages" && !zen
      ? { height: paperSize.height, top: paperSize.margin, bottom: paperSize.margin, gap: SHEET_GAP }
      : null,
  );
  let sheetCount = $state(1);
  // The footnotes take a sheet of their own after the chapter's.
  const leafCount = $derived(sheetCount + (pageNotes.length > 0 ? 1 : 0));
  /** A comment just added, whose card takes the keyboard. */
  let commentFocus = $state("");
  let commentCount = $state(0);
  /** A short message over the page, such as why a comment could not be added. */
  let writeNotice = $state("");
  let noticeTimer = 0;
  // The app opens on Home, as in the design; "Continue writing" goes back to the last chapter.
  let view = $state<"write" | "home" | "notes" | "ideas" | "todos" | "outline" | "book" | "settings">("home");
  let backupMessage = $state("");
  // The open project: its file, and every switch to another, with the way back when one fails (ARCH-12).
  const session = new Session({
    remember: (path) => (prefs = { ...prefs, projectPath: path }),
    writingId: () => writingId,
  });
  let dictionary = $state<{ language: WritingLanguage; word: string }[]>([]);
  let settingsOpen = $state(false);
  // Tutorial tips (owner, 8 October): the first time she reaches Home, Write, Notes or the Book, until
  // she stops them. Not over Settings or in Zen, and a moment after the place appears, so passing
  // through doesn't bring them and what they point at has settled.
  const tourWanted = $derived.by((): TourPlace | null => {
    if (!prefs.tips || !prefs.welcomed || settingsOpen || versions.open || zen || !writing) return null;
    const place = view === "home" || view === "write" || view === "notes" || view === "book" ? view : null;
    return place && !prefs.tipsSeen.includes(place) ? place : null;
  });
  let tourShown = $state<TourPlace | null>(null);
  // The welcome (owner, 13 October): the first time Pensieve opens, on Home, before the tips.
  const welcomeShown = $derived(!prefs.welcomed && view === "home" && !!writing && !settingsOpen);
  $effect(() => {
    const place = tourWanted;
    tourShown = null;
    if (!place) return;
    const timer = setTimeout(() => (tourShown = place), 700);
    return () => clearTimeout(timer);
  });

  function tourDone(place: TourPlace, stopAll: boolean) {
    tourShown = null;
    prefs = { ...prefs, tipsSeen: [...prefs.tipsSeen, place], tips: stopAll ? false : prefs.tips };
  }
  let restoring = $state(false);
  // How many closings of the editor are under way; it opens again when the last one is done.
  let closings = 0;
  let pendingBackup = $state<BackupContent | null>(null);
  // Where it was picked, for a rescue copy restored that way.
  let pendingBackupPath = "";
  // Her copies outside Pensieve: the backup in a folder she chose, and the Word copy (see copies.svelte.ts).
  const copiesHost = {
    writing: () => writing,
    shelf: () => shelf,
    prefs: () => prefs,
    setPrefs: (patch: Partial<Prefs>) => (prefs = { ...prefs, ...patch }),
    switching: () => session.switching,
    flush: async () => {
      await flushNoteSave();
      await autosave.flush();
    },
    libraryRoot: () => libraryRoot,
    say: (message: string) => (backupMessage = message),
    fail: (message: string) => (saveStatus = { state: "error", message }),
  };
  const driveBackup = new DriveBackup(copiesHost);
  const wordCopy = new WordCopy(copiesHost);
  let clock = $state(Date.now());
  const ambience = createAmbience();
  // A newer Pensieve on GitHub Releases, offered in the window bar; and what Settings' check last found.
  const updates = new Updates((work) => withEditorClosed(work));
  // When saving fails (ARCH-1): a rescue copy in Pensieve's own folder, offered back when its project opens.
  const rescue = new Rescue({
    project: () => (shelf ? { id: shelf.projectId, title: shelf.title, folders: shelf.folders } : null),
    writing: () => {
      const open = writingNow();
      if (!open) return null;
      const outline = shelf?.writings.find((item) => item.id === open.id);
      return { ...open, folder: outline?.folder ?? "", position: outline?.position ?? 0, deletedAt: "" };
    },
    unsaved: () => saveStatus.state !== "saved",
    savedAt: (id) => shelf?.writings.find((item) => item.id === id)?.updatedAt ?? "",
  });
  // Notes and to-dos that fail to save keep a rescue copy too; a save waiting for a switch to finish hasn't failed.
  watchNoteSaving({
    failed: () => {
      if (!session.switching) rescue.failed();
    },
    saved: () => rescue.saved(),
  });
  // Closing while saving fails: whether a rescue copy holds her words, and why the save failed.
  let saveTrouble = $state<{ kept: boolean; message: string } | null>(null);
  // How many copies Pensieve keeps in its own folder, for Settings.
  let keptCount = $state(0);

  const autosave = createAutosave({
    delayMs: 2000,
    // Saved at least every 10 seconds while she types on (ARCH-3). Not while she is naming a new chapter in
    // its heading: a save cuts the page there, under her cursor, so that one waits for her pause.
    maxWaitMs: 10000,
    mayInterrupt: () => !namingChapter(),
    save: async () => {
      captureEditor();
      if (!writing) return;
      // Storage has another project's file open (a sample being written, a project being moved): the change
      // stays unsaved, and autosave tries again in a moment, into her own file.
      if (session.switching) throw new Error(t("saveWaitsForSwitch"));
      await sqliteStorage.save(writing);
    },
    onStatus: (status) => {
      saveStatus = status;
      // A copy of what couldn't be saved, and away again once saving works (ARCH-1).
      if (status.state === "error" && !session.switching) rescue.failed();
      else if (status.state === "saved") rescue.saved();
    },
  });

  // A rescue copy left from a time saving failed is offered back when its project opens (ARCH-1).
  $effect(() => {
    const id = projectId;
    if (id) untrack(() => void rescue.check(id));
  });

  const chapters = $derived(
    writing ? [...writing.chapters].sort((a, b) => a.position - b.position) : [],
  );
  const activeChapter = $derived(chapters.find((chapter) => chapter.id === activeId) ?? null);
  // The key the open project's notes and to-dos are saved under (never a writing's id).
  const projectId = $derived(shelf?.projectId ?? "");
  const writingId = $derived(writing?.id ?? "");
  // The panel follows the chapter's text as it is reported after a pause in typing, not every key.
  const chapterTodos = $derived(notesStore.tasks.filter((task) => task.chapterId === activeId));
  const chapterNotes = $derived(activeChapter ? notesInChapter(notesStore.notes, activeChapter) : []);
  // The panel's notes, as it lists them, and that order for its previous and next buttons.
  const noteList = $derived(panelNotes(chapterNotes, notesStore.notes, noteQuery, locale()));
  const noteOrder = $derived(panelOrder(noteList));
  const noteIndex = $derived(notesStore.draft ? noteOrder.indexOf(notesStore.draft.note.id) : -1);
  const panelOpen = $derived(!zen && prefs.panel !== "");
  // A one-page writing has no chapter list: the library shows beside it, whichever tab was chosen.
  const libraryShown = $derived(prefs.sidebarView === "library" || (!!writing && !writing.split));
  // The example projects and the long test book written so far; Settings offers to put them back as they were.
  const sampleNames = $derived(Object.keys(prefs.samples));
  // Home's projects: every project in the library, then the ones kept elsewhere, with what is known of each.
  const homeProjects = $derived.by(() => {
    const known = prefs.knownProjects;
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const inLibrary = projectFiles(libraryEntries).map((file) => known.find((item) => same(item.path, file)) ?? { path: file, title: projectName(file) });
    const elsewhere = known.filter((item) => !libraryRoot || !isInside(item.path, libraryRoot));
    return [...inLibrary, ...elsewhere];
  });
  const chapterWords = $derived(activeChapter ? wordsFor(activeChapter.id, activeChapter.plainText) : 0);
  const writingWords = $derived(chapters.reduce((sum, chapter) => sum + wordsFor(chapter.id, chapter.plainText), 0));
  const wordsToday = $derived(
    prefs.writingDay === dayKey(new Date(clock)) ? Math.max(0, writingWords - prefs.dayStartWords) : 0,
  );

  function dayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  // Back in Write, the panel reads the notes and to-dos again: they may have changed in their views. Home
  // too, whose tree names them and can rename, move or open them (ARCH-13).
  $effect(() => {
    if ((view === "write" || view === "home") && projectId && session.path) void loadOrganizer();
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
    document.documentElement.style.setProperty("--pv-writing-size", `${prefs.manuscriptPt}pt`);
    document.documentElement.dataset.grain = prefs.grain ? "true" : "false";
    if (prefs.gentle) document.documentElement.dataset.gentle = "true";
    else delete document.documentElement.dataset.gentle;
    ui.language = prefs.uiLanguage;
    document.documentElement.lang = prefs.uiLanguage;
    savePrefs(prefs);
  });

  $effect(() => {
    if (!writing) return;
    const words = writingWords;
    const today = dayKey(new Date(clock));
    if (prefs.writingDay !== today) {
      prefs = { ...prefs, writingDay: today, dayStartWords: words };
    }
  });

  // Plain values, so saving other settings (a backup time, say) doesn't restart the sound. Gentle mode quiets
  // motion, not the sound she chose: Silence is how she turns that off.
  const ambienceKind = $derived(prefs.ambience);
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
    // The pomodoro's chime comes with a word on the page.
    onPomodoroTurn((phase) => notice(phase === "break" ? t("pomodoroBreakNow", { rest: pomodoro.rest }) : t("pomodoroBackNow")));
    let unlistenClose: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let unlistenSession: (() => void) | undefined;
    let closing = false;
    // Her words and settings are saved: only the backup and the Word copy are left to do.
    let wordsSaved = false;

    void (async () => {
      try {
        try {
          const stored = await loadPrefsFile();
          if (!disposed && stored) {
            // Browser storage holds them too, so the next start's first frame has them before the file is read.
            savePrefs(stored);
            prefs = stored;
          } else if (!disposed) savePrefs(prefs);
        } catch {
          // Keep the settings already in this window if the file cannot be read.
        }
        await openAtStart();
        if (disposed) return;
        saveStatus = { state: "saved" };
        await refreshWritingExtras();
        rememberProject();
      } catch (error) {
        if (disposed) return;
        loadError = errorMessage(error);
        const draft = createWriting(t("untitled"), chapterTitle(ui.language, 1));
        writing = draft;
        activeId = draft.chapters[0]?.id ?? null;
        saveStatus = { state: "error", message: loadError };
      }
      requestIdleCallback(
        () => {
          for (const part of [EditorPart, CommentRailPart, NotesPart, TodosPart, SettingsPart, OutlinePart, BookPart, HistoryPart, NotePanePart, SelectionBarPart, NewProjectPart, QuickIdeaPart, SearchPart, IdeasPart, FindPart, SaveTroublePart]) {
            // A part that fails here is tried again, and reported, when it is shown.
            part.load().catch(() => undefined);
          }
        },
        { timeout: 2000 },
      );

      try {
        const win = getCurrentWindow();
        unlistenClose = await win.onCloseRequested(async (event) => {
          // Held here every time: for a handler that doesn't, Tauri destroys the window, mid-save (a double click on ✕).
          event.preventDefault();
          if (closing) {
            // Asked again while closing: once her words are saved, the window goes without waiting for the backup
            // and the Word copy; before that, it waits.
            if (wordsSaved) await win.destroy().catch(() => undefined);
            return;
          }
          closing = true;
          try {
            let failure: unknown = null;
            await flushNoteSave().catch((error: unknown) => (failure ??= error));
            await autosave.flush().catch((error: unknown) => (failure ??= error));
            if (failure) {
              // Her last words couldn't be saved: a rescue copy of them now, and she is asked once (ARCH-1).
              saveTrouble = { kept: await rescue.keep(), message: errorMessage(failure) };
              await SaveTroublePart.load().catch(() => undefined);
              // Closed from the taskbar while minimised, the question would wait unseen.
              await win.unminimize().catch(() => undefined);
              await win.setFocus().catch(() => undefined);
              closing = false;
              return;
            }
            await flushPrefs();
            wordsSaved = true;
            try {
              await driveBackup.run(false);
            } catch {
              // The live book is already saved. Home shows the backup failure.
            }
            // Never throws; a problem is shown in Settings next time.
            await wordCopy.update();
            await win.destroy();
          } catch {
            closing = false;
            wordsSaved = false;
          }
        });
        unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
          // Back in the window: the library may have changed in Explorer meanwhile.
          if (focused) void refreshLibrary();
          if (!focused) {
            // Leaving the window is a good moment to refresh the Word copy: nobody is typing.
            void flushNoteSave()
              .then(() => autosave.flush())
              .then(() => wordCopy.update())
              .catch(() => undefined);
          }
        });
        // Windows shutting down or signing out (ARCH-23): it waits, saying why, while her words are saved; then
        // Pensieve closes.
        unlistenSession = await listen("pensieve://session-ending", () => void saveForSessionEnd());
        if (disposed) {
          unlistenClose();
          unlistenFocus();
          unlistenSession();
        }
      } catch {
        // The page is open in a browser, outside the Pensieve window.
      }
    })();

    const clockTimer = window.setInterval(() => {
      clock = Date.now();
    }, 60_000);

    const stopBackups = driveBackup.start();

    // A newer Pensieve: looked for a while after the start, then every six hours (see updates.svelte.ts).
    const stopUpdates = updates.start();

    return () => {
      disposed = true;
      stopUpdates();
      window.clearInterval(clockTimer);
      stopBackups();
      ambience.stop();
      unlistenClose?.();
      unlistenFocus?.();
      unlistenSession?.();
    };
  });

  /**
   * The browser's own keys, heard before anything else, windows too. F5 and Ctrl+R would reload the window
   * and lose what was typed in the moment before; only while Pensieve is being made do they reload it. On
   * the page Ctrl+R is Word's align right, which the editor takes, so it is left to it (an editor leaves a
   * key already taken). Ctrl+P prints the writing, every chapter, as Word does (owner, 14 October), never
   * the window as it looks; over a window other than Settings it does nothing.
   */
  function browserKeys(event: KeyboardEvent) {
    const ctrl = (event.ctrlKey || event.metaKey) && !event.altKey;
    // Plain Ctrl+R in text she can type in; anything else that would reload is stopped here.
    const alignsRight = !event.shiftKey && event.target instanceof Element && !!event.target.closest(".ProseMirror[contenteditable=true]");
    if (!import.meta.env.DEV && (event.key === "F5" || (ctrl && !alignsRight && event.key.toLowerCase() === "r"))) event.preventDefault();
    if (ctrl && !event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      if (writing && (settingsOpen || !document.querySelector(".window"))) void printBook();
    }
  }

  function onKeydown(event: KeyboardEvent) {
    // A quick idea from anywhere (owner, 12 October); Word's Ctrl+Shift+N, a style, isn't Pensieve's.
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      // In the Ideas tab, the new idea is made right there, beside the cards.
      if (view === "ideas") ideasCreate = { at: Date.now() };
      else if (projectId) quickIdeaOpen = true;
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void autosave.flush().catch(() => undefined);
    }
    // Search across every project (owner, 12 October): in Write, find's list through every project; elsewhere its window.
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      if (view === "write") find.show("all");
      else openSearch(find.open ? find.query : "");
      return;
    }
    // Ctrl+F finds on the page and Ctrl+H replaces there, as in Word.
    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key.toLowerCase() === "f" || event.key.toLowerCase() === "h")) {
      event.preventDefault();
      if (view === "write") find.show("chapter", event.key.toLowerCase() === "h");
      return;
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
    if (event.key === "Escape" && find.open) find.close();
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

  /** Something the library says (a folder that stays where it is, say) where she is: above the page, or on Home. */
  function libraryNotice(message: string) {
    if (view !== "home") return notice(message);
    homeNotice = message;
    window.setTimeout(() => {
      if (homeNotice === message) homeNotice = "";
    }, 6000);
  }

  /** Comments the selection, or the word at the cursor, and puts the keyboard in the new card. */
  async function newComment() {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || zen) return;
    const { selection, doc } = editor.state;
    if (isLeadLine(doc, selection.$from.index(0))) {
      notice(t("plainLeadLines"));
      return;
    }
    const { addComment } = await import("$lib/editor/comments");
    if (editor.isDestroyed) return;
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
    if (!editor || editor.isDestroyed || !writing || !activeId) return;
    const task = todoFromComment(comment, projectId, activeId, new Date().toISOString());
    try {
      await saveTask(task);
    } catch (error) {
      reportSaveError(errorMessage(error));
      return;
    }
    const { removeComment } = await import("$lib/editor/comments");
    if (editor.isDestroyed) return;
    editor.view.dispatch(removeComment(editor.state, comment.id));
    notesStore.addedTask(task);
    showTodos("chapter");
  }

  /** A comment becomes a note tied to this chapter, and its words link to the note from then on. */
  async function commentToNote(comment: CommentInfo) {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || !writing || !activeId) return;
    const note = noteFromComment(comment, projectId, activeId, new Date().toISOString());
    try {
      await saveNote(note);
    } catch (error) {
      reportSaveError(errorMessage(error));
      return;
    }
    const { removeComment } = await import("$lib/editor/comments");
    if (editor.isDestroyed) return;
    editor.view.dispatch(removeComment(editor.state, comment.id, { noteId: note.id, title: note.title }));
    notesStore.added(note);
    showNote(note.id);
  }

  /** Reads the project's notes and to-dos again for the panel and the library, as they may have changed elsewhere. */
  function loadOrganizer(): Promise<void> {
    return notesStore.reload();
  }

  const NEXT_STATE: Record<Task["todoState"], Task["todoState"]> = { todo: "doing", doing: "done", done: "todo" };

  async function toggleChapterTodo(task: Task) {
    const next = { ...task, todoState: NEXT_STATE[task.todoState], updatedAt: new Date().toISOString() };
    notesStore.replacedTask(next);
    try {
      await saveTask(next);
    } catch (error) {
      reportSaveError(errorMessage(error));
      void loadOrganizer();
    }
  }

  async function addChapterTodo(title: string) {
    if (!writing || !activeId) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title,
      todoState: "todo",
      updatedAt: new Date().toISOString(),
      chapterId: activeId,
      noteId: "",
    };
    notesStore.addedTask(task);
    try {
      await saveTask(task);
    } catch (error) {
      reportSaveError(errorMessage(error));
      void loadOrganizer();
    }
  }

  /**
   * The selection bar's note (owner, 12 October). Words that are a name are linked to the note of that
   * name (or other name), made if there is none yet; a longer passage is quoted in a new note, to be named.
   * Either is tied to the chapter and opens in the note window, or where a note is pinned.
   */
  async function noteFromSelection() {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || !writing || !activeId || !projectId) return;
    const selection = editor.state.selection;
    const { from, to } = selection;
    const words = selection.empty ? "" : editor.state.doc.textBetween(from, to, "\n").trim();
    if (!words) return;
    const now = new Date().toISOString();
    if (!namesANote(words)) {
      const note = noteFromWords(words, projectId, activeId, now);
      try {
        await saveNote(note);
      } catch (error) {
        reportSaveError(errorMessage(error));
        return;
      }
      notesStore.added(note);
      showNote(note.id, true);
      return;
    }
    const name = words.toLowerCase();
    let note = notesStore.notes.find(
      (item) => item.title.trim().toLowerCase() === name || item.aliases.split(",").some((alias) => alias.trim().toLowerCase() === name),
    );
    if (!note) {
      note = noteFromWords(words, projectId, activeId, now);
      try {
        await saveNote(note);
      } catch (error) {
        reportSaveError(errorMessage(error));
        return;
      }
      notesStore.added(note);
    }
    // The words link to it, unless they are a title line's (plain text) or changed meanwhile.
    const unchanged = !editor.isDestroyed && editor.state.doc.textBetween(from, to, "\n").trim() === words;
    if (unchanged && !isLeadLine(editor.state.doc, selection.$from.index(0))) {
      editor.chain().setTextSelection({ from, to }).setMark("noteLink", { noteId: note.id, title: note.title }).run();
    }
    showNote(note.id);
  }

  /** Opens a note in the Notes view. */
  function openNoteInView(id: string) {
    const note = notesStore.notes.find((item) => item.id === id);
    view = "notes";
    noteOpenRequest = { id, title: note?.title ?? "", at: Date.now() };
  }

  /** A note as it is now, never an older copy, which would be saved over her newer words (notes.svelte.ts). */
  function currentNote(id: string): Promise<Note | null> {
    return notesStore.current(id);
  }

  // The latest note asked for in the panel: one asked for before it, read later, doesn't take its place.
  let noteAsked = 0;

  /** Shows a note in the panel beside the page, to read and write; `fresh` for one just made, to be named. */
  async function showNote(id: string, fresh = false) {
    const asked = ++noteAsked;
    if (notesStore.draft) notesStore.leave();
    let note: Note | null;
    try {
      note = await currentNote(id);
    } catch (error) {
      reportSaveError(errorMessage(error));
      return;
    }
    if (!note || asked !== noteAsked) return;
    notesStore.open(note, fresh);
    if (prefs.panel !== "notes") prefs = { ...prefs, panel: "notes" };
  }

  /** Folds the panel away; a note shown in it goes back to the book's notes. */
  function closePanel() {
    leaveNote();
    prefs = { ...prefs, panel: "" };
  }

  /** The toolbar's Notes, To-dos and Goals buttons: that list beside the page, or none when it shows already. */
  function togglePanel(list: "notes" | "todos" | "goals") {
    if (prefs.panel === list) closePanel();
    else prefs = { ...prefs, panel: list };
  }

  /** The panel's to-dos: the open chapter's, or all of the project's. */
  function showTodos(scope: "chapter" | "all") {
    todoScope = scope;
    prefs = { ...prefs, panel: "todos" };
  }

  // The panel's note is for writing beside. Elsewhere (Notes, say) she may change that note, so it goes
  // back to the book's notes on the way, and its copy can't later be saved over what she changed there.
  $effect(() => {
    if (view !== "write" && notesStore.draft) untrack(() => notesStore.leave());
  });

  /** A change to the panel's note: its draft while she types it, which the lists have when she leaves it. */
  function editPaneNote(id: string, patch: Partial<Note>) {
    notesStore.edit(id, patch);
  }

  /** The panel's note goes back to the project's notes, and the panel shows the list, or `then`. */
  function leaveNote(then: Note | null = null) {
    notesStore.leave(then);
  }

  /** A [[link]] in the panel's note opens the linked note there; a link to no note yet makes it. */
  function openLinkedNote(target: NoteTarget) {
    const title = target.title.trim();
    const found =
      (target.id ? notesStore.notes.find((note) => note.id === target.id) : undefined) ??
      notesStore.notes.find((note) => note.title.trim().toLowerCase() === title.toLowerCase());
    // A note's link to itself leaves it as it is (the book's copy is older than the panel's).
    if (found && found.id === notesStore.draft?.note.id) return;
    if (found) leaveNote(found);
    // Made, it takes the note's place, as a found one does.
    else if (title) void newNoteIn("ideas", title);
  }

  /** From the panel's note to Notes, once what she typed is saved, so Notes reads it. */
  async function paneNoteToNotes() {
    const id = notesStore.draft?.note.id;
    leaveNote();
    if (!id) return;
    await flushNoteSave().catch(() => undefined);
    openNoteInView(id);
  }

  /** A to-do from the panel: for the chapter, or for the whole project when it lists all of them. */
  function addPanelTodo(title: string) {
    if (todoScope === "chapter") void addChapterTodo(title);
    else void addProjectTodo(title);
  }

  /** A to-do for the whole project. */
  async function addProjectTodo(title: string) {
    if (!projectId) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title,
      todoState: "todo",
      updatedAt: new Date().toISOString(),
      chapterId: "",
      noteId: "",
    };
    notesStore.addedTask(task, true);
    try {
      await saveTask(task);
    } catch (error) {
      reportSaveError(errorMessage(error));
      void loadOrganizer();
    }
  }

  function reorderChapters(draggedId: string, targetId: string) {
    if (!writing) return;
    const next = reorderChapterList(writing, draggedId, targetId);
    if (!next) return;
    writing = next;
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  /** A place in find's list: its chapter opens on that very match, with find on the page; a note opens beside the page. */
  async function openFindHit(hit: SearchHit) {
    find.scope = "chapter";
    find.notice = "";
    const here = hit.path.toLowerCase() === session.path.toLowerCase();
    if (hit.kind === "note") {
      if (!here) await openFromLibrary(hit.path);
      view = "write";
      noteToShow = hit.noteId;
      return;
    }
    if (here && hit.writingId === writingId && hit.chapterId === editorChapter && textEditor && !textEditor.isDestroyed) {
      view = "write";
      find.showMatchAt(textEditor, hit.nth);
      return;
    }
    pageFind = { id: hit.chapterId, query: find.query, nth: hit.nth };
    await openFromLibrary(hit.path, { writingId: hit.writingId, chapterId: hit.chapterId });
    view = "write";
  }

  /** The open writing with the page's words as they are now, leaving the page and the writing as they are. */
  function writingNow(): Writing | null {
    const editor = textEditor;
    const id = editorChapter;
    if (!writing) return null;
    const open = $state.snapshot(writing) as Writing;
    if (!editor || editor.isDestroyed || !id || open.id !== editorWriting) return open;
    const page = applyPage(open, id, editor.getJSON() as DocumentJson, new Date().toISOString(), t("untitled"), { began: editorBegan, split: editorSplit });
    return withArticleTitle(page.writing);
  }

  function captureEditor() {
    const editor = textEditor;
    const id = editorChapter;
    if (!editor || editor.isDestroyed || !id || !writing || writing.id !== editorWriting) return;
    // A heading lower down becomes its own chapter first, so its text is saved there, once.
    splitPage(false);
    if (editor.isDestroyed || !writing) return;
    const result = applyPage(writing, id, editor.getJSON() as DocumentJson, new Date().toISOString(), t("untitled"), {
      began: editorBegan,
      split: editorSplit,
    });
    writing = withArticleTitle(result.writing);
    editorBegan = result.began;
  }

  /**
   * The page an editor handed back on closing: its chapter's title, part and text. An editor closes
   * while Svelte tears it down, and then the book still reads as it was before the change that closed
   * the editor, such as a new chapter. So the page, taken now, goes into the book a moment later, into
   * the book as it is by then.
   */
  function updateChapter(id: string, page: DocumentJson) {
    // What the page showed when it opened is read now: by the time the microtask runs, the next one may be open.
    const options = { began: id === editorChapter ? editorBegan : undefined, split: editorSplit };
    const owner = editorWriting;
    queueMicrotask(() => {
      if (!writing) return;
      if (owner && writing.id !== owner) {
        // Another writing is open already: the page goes into its own writing, saved there, never lost.
        void savePageInto(owner, id, page, options);
        return;
      }
      writing = withArticleTitle(applyPage(writing, id, page, new Date().toISOString(), t("untitled"), options).writing);
      autosave.schedule();
    });
  }

  /** Saves a closed page into a writing that isn't the open one. */
  async function savePageInto(owner: string, id: string, page: DocumentJson, options: { began?: boolean; split?: boolean }) {
    try {
      const target = await loadWriting(owner);
      await sqliteStorage.save(withArticleTitle(applyPage(target, id, page, new Date().toISOString(), t("untitled"), options).writing));
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  function updateChapterText(id: string, plainText: string) {
    if (!writing) return;
    writing = setChapterText(writing, id, plainText);
    syncTitle(id);
    refreshFootnotes();
  }

  // The page and the cursor's block last looked at for headings, so the same ones aren't looked at again.
  let checkedPage: unknown = null;
  let checkedBlock = -1;

  /**
   * Where the keyboard goes on a page opened by a split: the part line (1), the title line (2), or a block
   * of text, and how far into that line or block, counted from its start.
   */
  type Spot = { line: 0 | 1 | 2; block: number; offset: number };
  // A heading last told about that stays a heading, as it holds a comment or footnote.
  let heldTold = -1;

  /** The last split, which a notice offers to take back for a few seconds. */
  type SplitBack = {
    sourceId: string;
    page: DocumentJson;
    began: boolean;
    /** What the chapters it touched held right after it, to see that nothing was written in them since. */
    sourceState: string;
    created: { id: string; state: string }[];
    title: string;
    /** Chapters after it that a Heading 1 took into its part: the part each had, and the one it was given. */
    parts: { id: string; part: string; split: string }[];
  };

  /** What taking a split back would put back or take away in a chapter: its title, part, synopsis and page. */
  function writtenIn(book: Writing, chapterId: string): string {
    const chapter = book.chapters.find((item) => item.id === chapterId);
    return chapter ? JSON.stringify([chapter.title, chapter.part, chapter.synopsis, chapter.contentJson]) : "";
  }
  let splitBack = $state<SplitBack | null>(null);
  let splitBackTimer = 0;
  // A chapter just made from a heading, and where the keyboard goes when its page opens.
  let pageSpot: { id: string; spot: Spot } | null = null;

  /**
   * After an edit, a Heading 1 or 2 with words, below the title line, starts a part or chapter of its
   * own, once the cursor has left it, so its name is typed first. An article is one page.
   */
  function watchHeadings() {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || !editorSplit) return;
    const page = editor.state.doc;
    const block = editor.state.selection.$from.index(0);
    if (page === checkedPage && block === checkedBlock) return;
    checkedPage = page;
    checkedBlock = block;
    if (chapterBreak(page, block) >= 0) {
      queueMicrotask(() => splitPage(true));
      return;
    }
    // A heading with a comment or footnote stays a heading: say so once, when the cursor leaves it.
    const held = heldHeading(page, block);
    if (held >= 0 && held !== heldTold) notice(t("headingKeepsNotes"));
    heldTold = held;
  }

  /** Where the cursor, in block `cursor` at `offset`, is in the piece of a split page that starts at block `start`. */
  function spotIn(json: DocumentJson, start: number, cursor: number, offset: number, title: string): Spot {
    const nodes = (json.content ?? []) as { type: string; attrs?: Record<string, unknown> }[];
    const levelAt = (index: number) => (nodes[index]?.type === "heading" ? Number(nodes[index].attrs?.level) : 0);
    let index = start;
    if (levelAt(index) === 1) {
      if (cursor === index) return { line: 1, block: 0, offset };
      index += 1;
    }
    if (levelAt(index) === 2) {
      if (cursor === index) return { line: 2, block: 0, offset };
      index += 1;
    }
    // A chapter that begins without a title gets the keyboard in its title line, to name it.
    if (!title) return { line: 2, block: 0, offset: 1 };
    return { line: 0, block: cursor - index, offset };
  }

  /** Puts the keyboard where `spot` says on a page that has just opened. */
  function placeSpot(editor: TiptapEditor, spot: Spot) {
    const page = editor.state.doc;
    const lines = leadLines(page);
    const index =
      spot.line === 0 ? Math.min(lines + spot.block, page.childCount - 1) : spot.line === 1 && lines === 2 ? 0 : Math.max(0, lines - 1);
    let start = 0;
    for (let at = 0; at < index; at += 1) start += page.child(at).nodeSize;
    const node = page.child(index);
    // The same place in the line or block, which opens with the same words; failing that, its first line.
    const target = start + Math.min(Math.max(1, spot.offset), node.nodeSize - 1);
    let place = page.resolve(target).parent.isTextblock ? target : -1;
    if (place < 0) {
      node.descendants((child, pos) => {
        if (place < 0 && child.isTextblock) place = start + pos + 2;
        return place < 0;
      });
    }
    if (place < 0) return;
    // At once, in the task that opened the page: keys typed while it opened are waiting, and land here.
    editor.commands.setTextSelection(place);
    editor.view.focus();
    editor.commands.scrollIntoView();
  }

  /** Whether she is typing a heading that begins another part or chapter, where a save would cut the page. */
  function namingChapter(): boolean {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || !editorSplit) return false;
    const { doc, selection } = editor.state;
    return opensChapter(doc, selection.$from.index(0));
  }

  /**
   * Moves the text from a Heading 1 or 2 lower down into new chapters after this one (chapters/page.ts)
   * and takes it off this page, then follows the cursor into the chapter it was in, to the same place.
   * `whileTyping` leaves a heading the cursor is still in for later; saving splits there too.
   */
  function splitPage(whileTyping: boolean) {
    const editor = textEditor;
    const id = editorChapter;
    if (!editor || editor.isDestroyed || !id || !writing || !editorSplit || writing.id !== editorWriting) return;
    const page = editor.state.doc;
    const head = editor.state.selection.$from;
    const cursor = head.index(0);
    const at = chapterBreak(page, whileTyping ? cursor : -1);
    if (at < 0) return;
    const json = editor.getJSON() as DocumentJson;
    const result = applyPage(writing, id, json, new Date().toISOString(), t("untitled"), { began: editorBegan });
    if (result.created.length === 0) return;
    const { starts, more } = readPage(json);
    // The parts the chapters after this one would have with the page read as Undo reads it, headings as lines.
    const plain = applyPage(writing, id, withoutBreaks(json), new Date().toISOString(), t("untitled"), { began: editorBegan, split: false });
    const parts = result.writing.chapters.flatMap((chapter) => {
      const part = plain.writing.chapters.find((item) => item.id === chapter.id)?.part;
      return part !== undefined && part !== chapter.part ? [{ id: chapter.id, part, split: chapter.part }] : [];
    });
    offerSplitBack({
      sourceId: id,
      page: json,
      began: editorBegan,
      sourceState: writtenIn(result.writing, id),
      created: result.created.map((createdId) => ({ id: createdId, state: writtenIn(result.writing, createdId) })),
      title: more[0]?.title || more[0]?.part || t("untitled"),
      parts,
    });
    let cut = 0;
    for (let index = 0; index < at; index += 1) cut += page.child(index).nodeSize;
    // Where the cursor's block starts, so it can be put back at the same place in it.
    let cursorStart = 0;
    for (let index = 0; index < cursor; index += 1) cursorStart += page.child(index).nodeSize;
    editor.view.dispatch(editor.state.tr.delete(cut, page.content.size).setMeta("addToHistory", false));
    writing = result.writing;
    editorBegan = result.began;
    const piece = starts.filter((start) => start <= cursor).length - 1;
    // The page goes along to the new chapter only when she is writing on it. A save while she types in
    // the find box or a chapter's name leaves the new chapter in the list and the keyboard where it is.
    if (piece >= 0 && (whileTyping || editor.view.hasFocus())) {
      pageSpot = { id: result.created[piece], spot: spotIn(json, starts[piece], cursor, head.pos - cursorStart, more[piece].title) };
      activeId = result.created[piece];
    }
    autosave.schedule();
  }

  /** Offers to take the split back, for ten seconds or until the next one. */
  function offerSplitBack(back: SplitBack) {
    splitBack = back;
    window.clearTimeout(splitBackTimer);
    splitBackTimer = window.setTimeout(() => (splitBack = null), 10000);
  }

  /**
   * Takes the last split back: the new chapters go, and the headings that made them are lines of text
   * in the chapter again, as before. Only while nothing has been written since in the chapters it touched.
   */
  async function takeBackSplit() {
    const back = splitBack;
    splitBack = null;
    window.clearTimeout(splitBackTimer);
    if (!back || !writing) return;
    try {
      await withEditorClosed(async () => {
        if (!writing) return;
        const book = writing;
        const same = (chapterId: string, state: string) => writtenIn(book, chapterId) === state;
        if (!same(back.sourceId, back.sourceState) || !back.created.every((made) => same(made.id, made.state))) {
          notice(t("splitKept"));
          return;
        }
        const before = writingWords;
        const left = { ...book, chapters: book.chapters.filter((chapter) => !back.created.some((made) => made.id === chapter.id)) };
        const restored = applyPage(left, back.sourceId, withoutBreaks(back.page), new Date().toISOString(), t("untitled"), {
          began: back.began,
          split: false,
        }).writing;
        // The chapters a Heading 1 took into its part go back to theirs, unless their part was changed since.
        writing = {
          ...restored,
          chapters: restored.chapters.map((chapter) => {
            const moved = back.parts.find((item) => item.id === chapter.id);
            return moved && chapter.part === moved.split ? { ...chapter, part: moved.part } : chapter;
          }),
        };
        keepToday(before);
        activeId = back.sourceId;
        autosave.schedule();
        await autosave.flush();
      });
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  /**
   * A one-page writing's title line is the writing's title: its name follows it, so the library, the
   * window bar and Word show what the page shows. An emptied line leaves the name as it was.
   */
  function withArticleTitle(book: Writing): Writing {
    if (book.split || book.chapters.length !== 1) return book;
    const title = book.chapters[0].title.trim();
    return title && !isUntitled(title) && title !== book.title ? { ...book, title } : book;
  }

  /** The title line's text, as the chapter list shows it, once typing pauses. */
  function syncTitle(id: string) {
    const editor = textEditor;
    if (!editor || editor.isDestroyed || id !== editorChapter || !writing) return;
    const lines = leadLines(editor.state.doc);
    const line = lines > 0 ? editor.state.doc.child(lines - 1) : null;
    if (!line || line.attrs.level !== 2) return;
    // An empty title line keeps a title that already says "no title", in either language.
    const current = writing.chapters.find((chapter) => chapter.id === id)?.title ?? "";
    const title = line.textContent.trim() || (isUntitled(current) ? current : t("untitled"));
    if (current !== title) writing = withArticleTitle(patchChapter(writing, id, { title }));
  }

  /** A new title from the chapter list, written into the open page's title line. */
  function setPageTitle(title: string) {
    const editor = textEditor;
    if (!editor || editor.isDestroyed) return;
    const page = editor.state.doc;
    const lines = leadLines(page);
    const line = lines > 0 ? page.child(lines - 1) : null;
    if (!line || line.attrs.level !== 2) return;
    const from = lines === 2 ? page.child(0).nodeSize : 0;
    const text = isUntitled(title) ? "" : title.trim();
    const change = editor.state.tr.delete(from + 1, from + line.nodeSize - 1);
    if (text) change.insertText(text, from + 1);
    editor.view.dispatch(change);
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
    // A footnote is selected as a whole node, and only a node selection has one.
    const selected = (selection as Partial<NodeSelection>).node;
    if (selected?.type.name !== "footnote") return null;
    let number = 0;
    doc.nodesBetween(0, selection.from + 1, (node, pos) => {
      if (node.type.name === "footnote" && pos <= selection.from) number += 1;
    });
    return { pos: selection.from, number, text: String(selected.attrs.text ?? "") };
  });

  function setFootnoteText(pos: number, text: string) {
    const editor = textEditor;
    const node = editor && !editor.isDestroyed ? editor.state.doc.nodeAt(pos) : null;
    if (!editor || node?.type.name !== "footnote") return;
    // Changing the note replaces the node; select it again in the same step, or the panel would close mid-word.
    editor
      .chain()
      .command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, text });
        return true;
      })
      .setNodeSelection(pos)
      .run();
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

  /** A new chapter at the end of the book, or just after `afterId` (the last of a part, from its "+"). */
  async function addChapter(afterId = "") {
    // A one-page writing has no chapters to add; "Split into chapters" turns them on.
    if (!writing || !writing.split) return;
    try {
      await autosave.flush();
    } catch {
      // The new chapter still exists in memory if the write failed.
    }
    const at = afterId ? [...writing.chapters].sort((a, b) => a.position - b.position).findIndex((chapter) => chapter.id === afterId) : -1;
    const made = at >= 0 ? insertChapterAfter(writing, afterId, chapterTitle(writing.language, at + 2)) : null;
    if (made) {
      writing = made.writing;
      activeId = made.activeId;
    } else {
      const position = writing.chapters.reduce((max, chapter) => Math.max(max, chapter.position), -1) + 1;
      const chapter = createChapter(writing.id, chapterTitle(writing.language, position + 1), position);
      writing = { ...writing, chapters: [...writing.chapters, chapter] };
      activeId = chapter.id;
    }
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // Keep the new chapter in memory.
    }
  }

  async function renameChapter(id: string, title: string) {
    if (!writing) return;
    writing = renameChapterIn(writing, id, title);
    if (id === editorChapter) setPageTitle(title);
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // The new title stays in memory.
    }
  }

  async function duplicateChapter(id: string) {
    if (!writing) return;
    try {
      await autosave.flush();
    } catch {
      // Keep going with the text that is already in memory.
    }
    const copied = duplicateChapterIn(writing, id);
    if (!copied) return;
    const before = writingWords;
    writing = copied.writing;
    keepToday(before);
    activeId = copied.activeId;
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // The copy stays in memory.
    }
  }

  async function deleteChapter(id: string) {
    if (!writing || writing.chapters.length < 2) return;
    try {
      await keepSnapshot(writing);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
      return;
    }
    const removed = removeChapter(writing, id);
    if (!removed) return;
    const before = writingWords;
    writing = removed.writing;
    keepToday(before);
    if (activeId === id) activeId = removed.activeId;
    autosave.schedule();
    try {
      await autosave.flush();
    } catch {
      // The remaining chapters stay in memory.
    }
  }

  /**
   * After a change to the book that isn't writing (a copy, a deletion, an import, a restore), today's
   * words stay as they were: the day's start moves by the words the change added or took away.
   */
  function keepToday(before: number) {
    if (writingWords !== before) prefs = { ...prefs, dayStartWords: prefs.dayStartWords + (writingWords - before) };
  }

  function updateChapterMeta(id: string, patch: Partial<Chapter>) {
    if (!writing) return;
    writing = patchChapter(writing, id, patch);
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  /** Saves the notes and the page first; when that fails, the page's words as they are on screen go out all the same (ARCH-1). */
  async function saveFirst() {
    try {
      await flushNoteSave();
      await autosave.flush();
    } catch {
      captureEditor();
    }
  }

  /** Saves pending edits, asks where to save, then writes the export there; gives where it went, or "". */
  async function saveExport(kind: ExportKind, contents: (book: Writing) => Promise<Uint8Array>): Promise<string> {
    if (!writing) return "";
    try {
      await saveFirst();
      const book = writing;
      if (!book) return "";
      const path = await chooseSavePath(`${safeName(book.title)}.${kind}`, kind);
      if (!path) return "";
      const written = await writeFileTo(path, await contents(book));
      backupMessage = t("savedTo", { path: written.path });
      return written.path;
    } catch (error) {
      backupMessage = errorMessage(error);
      return "";
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

  async function shrinkPictures(node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) {
    if (node.type === "image" && typeof node.attrs?.src === "string") node.attrs.src = await shrinkImage(node.attrs.src);
    for (const child of node.content ?? []) await shrinkPictures(child as typeof node);
  }

  async function copyHtml() {
    if (!writing) return;
    try {
      await saveFirst();
      if (!writing) return;
      await navigator.clipboard.writeText(chaptersToHtml(writing.title || "Pensieve", writing.chapters));
      backupMessage = t("copiedHtml");
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  // Print asked for while the Book view still lays out its pages: it prints once they are all there,
  // and not on a later visit if she leaves before then.
  let printWhenLaidOut = false;
  $effect(() => {
    if (view !== "book") printWhenLaidOut = false;
  });

  /** Prints every chapter from the Book view, not whatever happens to be on screen. */
  async function printBook() {
    settingsOpen = false;
    if (zen) await setZen(false);
    view = "book";
    await BookPart.load();
    await tick();
    if (document.querySelector(".book[data-laid-out]")) window.print();
    else printWhenLaidOut = true;
  }

  /**
   * Closes the editor so it hands back its text, saves everything, then runs `work`.
   * The editor reopens on whatever `work` leaves in `writing`, so an open editor can't
   * write its older text over a restore.
   */
  function withEditorClosed(work: () => Promise<void>): Promise<void> {
    return oneAtATime(async () => {
      closings += 1;
      restoring = true;
      try {
        await tick();
        await flushNoteSave();
        await autosave.flush();
        await work();
      } finally {
        closings -= 1;
        if (closings === 0) restoring = false;
      }
    });
  }

  /**
   * Changes to the open project or its writings run one after the other: a switch can't start in the
   * middle of another change, which would then save into the project opened meanwhile. Never call it
   * from inside a change that is running (that one would wait for itself).
   */
  let changes: Promise<unknown> = Promise.resolve();
  function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
    const run = changes.then(work, work);
    changes = run.catch(() => undefined);
    return run;
  }

  async function pickBackup() {
    try {
      const path = await chooseBackupFile();
      if (path) pendingBackup = await readBackupFile(path);
      pendingBackupPath = path ?? "";
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function restoreBackup() {
    const backup = pendingBackup;
    const path = pendingBackupPath;
    if (!backup) return;
    pendingBackup = null;
    try {
      await restoreContent(backup);
      // A rescue copy from Pensieve's own folder, back in its project now: it isn't offered again.
      if (backup.rescue && path) {
        const folder = (await keptCopiesFolder("rescue").catch(() => "")).toLowerCase();
        const name = path.split(/[\\/]/).pop() ?? "";
        if (folder && path.toLowerCase().startsWith(folder)) await removeKeptCopy("rescue", name).catch(() => undefined);
      }
      settingsOpen = false;
      view = "write";
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  /** A rescue copy brought back (ARCH-1): into its project, after what is there now is kept in Earlier versions. */
  async function bringBackRescue(offer: RescueOffer) {
    try {
      await restoreContent(offer.beside ? besideItsWriting(offer.backup) : offer.backup);
      await rescue.done(offer);
      view = "write";
      notice(t("rescueBack"));
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  /** Windows is ending the session: her words saved, or kept in a rescue copy, then Pensieve may close (ARCH-23). */
  async function saveForSessionEnd() {
    let failure: unknown = null;
    await flushNoteSave().catch((error: unknown) => (failure ??= error));
    await autosave.flush().catch((error: unknown) => (failure ??= error));
    if (failure) await rescue.keep();
    await flushPrefs().catch(() => undefined);
    await invoke("session_saved").catch(() => undefined);
  }

  // What Windows shows while it waits for that, in her language.
  $effect(() => {
    const text = t("shutdownSaving");
    untrack(() => void invoke("session_reason", { text }).catch(() => undefined));
  });

  /** When saving failed, closes Pensieve once her words are safe: the settings first, then the window. */
  async function closeAfterTrouble() {
    saveTrouble = null;
    await flushPrefs().catch(() => undefined);
    try {
      await getCurrentWindow().destroy();
    } catch {
      // The page is open in a browser, outside the Pensieve window.
    }
  }

  /** The open writing's text on the clipboard, as it is on the page: a way out when saving fails (ARCH-1). */
  async function copyPlainText(): Promise<boolean> {
    const open = writingNow();
    if (!open) return false;
    try {
      await navigator.clipboard.writeText(chaptersToPlain(open.title || "Pensieve", open.chapters));
      return true;
    } catch {
      return false;
    }
  }

  /** Counts the copies of writings deleted for good, for Settings; rescue copies go only once brought back. */
  async function refreshKept() {
    try {
      keptCount = (await listKeptCopies("deleted")).length;
    } catch {
      keptCount = 0;
    }
  }
  $effect(() => {
    if (settingsOpen) untrack(() => void refreshKept());
  });

  /** Settings' Bring one back: a kept copy, picked in their folder, restored as a backup is. */
  async function bringBackKept() {
    try {
      const path = await chooseBackupFile(await keptCopiesFolder("deleted"), t("dialogKeptCopy"));
      if (path) pendingBackup = await readBackupFile(path);
      pendingBackupPath = path ?? "";
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  /** Settings' Remove them: the copies of writings deleted for good go. */
  async function removeKept() {
    try {
      for (const copy of await listKeptCopies("deleted")) await removeKeptCopy("deleted", copy.name);
      backupMessage = t("keptRemoved");
    } catch (error) {
      backupMessage = errorMessage(error);
    }
    await refreshKept();
  }

  /** Puts a backup, or a rescue copy, back into the open project and opens what came back. */
  async function restoreContent(backup: BackupContent) {
    await withEditorClosed(async () => {
      const before = writingWords;
      const open = await restoreFromBackup(backup);
      shelf = await readOpenShelf();
      const restored = await loadWriting(backup.writings.some((item) => item.id === writingId) ? writingId : open || writingId);
      if (restored.id === writingId) {
        writing = restored;
        keepToday(before);
      } else {
        const written = wordsToday;
        writing = restored;
        prefs = { ...prefs, writingDay: dayKey(new Date(clock)), dayStartWords: writingWords - written };
      }
      resetWritingState();
      activeId = restored.chapters[0]?.id ?? null;
      rememberProject();
    });
  }

  function backupOffer(backup: BackupContent | null) {
    if (!backup || !writing) return null;
    const saved = new Date(backup.savedAt);
    const ids = new Set(shelf?.writings.map((item) => item.id) ?? []);
    return {
      // One writing (a copy of a writing deleted for good, say) is named as itself; a whole project by its name.
      title: (backup.format === 2 && backup.writings.length > 1 ? backup.title : backup.writings[0]?.title) || t("untitled"),
      savedAt: Number.isNaN(saved.getTime()) ? t("unknownDate") : saved.toLocaleString(locale()),
      // A backup of this project, or of a writing it has, puts things back; any other comes in beside them.
      otherBook: backup.format === 2 ? backup.projectId !== projectId : !backup.writings.some((item) => ids.has(item.id)),
    };
  }

  function reportSaveError(message: string) {
    saveStatus = { state: "error", message };
  }

  async function refreshWritingExtras() {
    try {
      dictionary = await listPersonalWords();
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
    const current = writing && activeChapter ? effectiveLanguage(writing, activeChapter) : "en";
    const next = current === "sl" ? "en" : "sl";
    if (editor && !editor.isDestroyed && !editor.state.selection.empty) {
      setSelectionLanguage(next);
      return;
    }
    setChapterLanguage(next);
  }

  /** The open project as Home and the library show it while it's closed: its writings and their words. */
  function projectSummary() {
    const open = writing;
    const writings = (shelf?.writings ?? [])
      .filter((item) => !item.deletedAt)
      .map((item) => (open && item.id === open.id ? summarize(open) : summarizeOutline(item)));
    return summarizeProject(writings);
  }

  /** Puts the open project first among the remembered ones, with its writings as they are now. */
  function rememberProject() {
    const path = session.path.trim();
    if (!path || !shelf) return;
    // Every project she has opened, most recent first; the ceiling only guards against a runaway list.
    const knownProjects = [
      { path, title: shelf.title.trim() || projectName(path) || t("untitled"), summary: projectSummary() },
      ...prefs.knownProjects.filter((book) => book.path.toLowerCase() !== path.toLowerCase()),
    ].slice(0, 50);
    prefs = { ...prefs, knownProjects };
  }

  /** Renames the open writing. */
  function renameOpenWriting(title: string) {
    if (!writing) return;
    const nextTitle = title.trim() || t("untitled");
    writing = { ...writing, title: nextTitle };
    // A one-page writing carries its title on its title line too.
    const only = !writing.split && writing.chapters.length === 1 ? writing.chapters[0] : null;
    if (only && only.title !== nextTitle) {
      writing = renameChapterIn(writing, only.id, nextTitle);
      if (only.id === editorChapter) setPageTitle(nextTitle);
    }
    autosave.schedule();
    void autosave
      .flush()
      .then(refreshShelf)
      .then(rememberProject)
      .catch(() => undefined);
  }

  /**
   * Opens a project's file, on the writing and chapter asked for, else the ones open there last. With a
   * page open (a switch from the library), the editor closes first and hands its text to the project being
   * left, then opens on the new one: never the old text over a chapter of the new one. A file that is new
   * becomes a project, named `fresh`.
   */
  async function useProjectFile(
    path: string,
    target: { writingId?: string; chapterId?: string } = {},
    openWrite = true,
    fresh: NewProject = { title: projectName(path), writingTitle: projectName(path) || t("untitled"), welcome: false },
  ) {
    await withEditorClosed(async () => {
      // The project being left keeps its row on Home, with today's numbers and the page just closed.
      rememberProject();
      await wordCopy.update();
      // Backed up as she leaves it, when it changed since its last backup (ARCH-18): the hourly backup covers
      // only the project open. A failure is said, and the switch goes on.
      await driveBackup.run(false).catch(() => undefined);
      const written = wordsToday;
      // One that won't open leaves the project open now open, its saves going on into its own file.
      const opened = await session.switchTo(path, async () => namedByFolder(path, await openShelf(target.writingId ?? "", fresh)));
      shelf = opened.shelf;
      writing = opened.writing;
      resetWritingState();
      prefs = { ...prefs, writingDay: dayKey(new Date(clock)), dayStartWords: writingWords - written };
      activeId = chapterToOpen(opened.writing, target.chapterId);
      // She opened a project herself: what Home said at the start is done.
      homeNotice = "";
      // Its own files show in the tree.
      void refreshLibrary();
      rememberProject();
      if (openWrite) view = "write";
    });
  }

  /**
   * At the start, what was open last: that project and writing. A project that isn't where it was any
   * more is said so, and the library's first project opens instead. On a first start Pensieve makes the
   * library folder, with a first project in it that opens on the welcome page.
   */
  async function openAtStart() {
    libraryRoot = await libraryFolderPath();
    const saved = prefs.projectPath.trim();
    let path = saved;
    if (saved && !(await invoke<boolean>("project_file_exists", { path: saved }))) {
      homeNotice = t("projectFolderMissing", { path: folderOf(saved).path });
      path = "";
    }
    // Before the library, books lived in the app folder: one she wrote in there still opens.
    if (!saved && prefs.knownProjects.length > 0) {
      const legacy = await invoke<string>("default_project_path");
      if (await invoke<boolean>("project_file_exists", { path: legacy })) path = legacy;
    }
    let fresh: NewProject = { title: projectName(path), writingTitle: t("untitled"), welcome: false };
    if (!path) {
      await refreshLibrary();
      path = firstProject(libraryEntries, locale()) ?? "";
      fresh = { title: projectName(path), writingTitle: t("untitled"), welcome: !saved };
      if (!path) {
        try {
          path = await makeProjectFolder(libraryRoot, t("firstProjectName"), true);
          fresh = { title: projectName(path), writingTitle: t("untitled"), welcome: !saved };
        } catch (error) {
          // The library folder can't be written to: the project goes in the app folder, and Home says why.
          homeNotice = errorMessage(error);
          path = await invoke<string>("default_project_path");
          fresh = { title: t("firstProjectName"), writingTitle: t("untitled"), welcome: true };
        }
      }
    }
    const last = prefs.lastOpened.path.toLowerCase() === path.toLowerCase() ? prefs.lastOpened : null;
    const opened = await session.start(path, async () => namedByFolder(path, await openShelf(last?.writingId ?? "", fresh)));
    shelf = opened.shelf;
    writing = opened.writing;
    activeId = chapterToOpen(opened.writing, last?.chapterId);
    // Today's count was kept against the writing open last; another one starts it again from here.
    if (last?.writingId !== opened.writing.id) prefs = { ...prefs, writingDay: dayKey(new Date(clock)), dayStartWords: writingWords };
    void refreshLibrary();
  }

  /** Something to tell her on Home at the start: a project that wasn't where it was, or a library that can't be written to. */
  let homeNotice = $state("");

  /** The library folder: the one she chose, or Documents\Pensieve (her home folder's when Documents is synced). */
  async function libraryFolderPath(): Promise<string> {
    const chosen = prefs.libraryFolder.trim();
    if (chosen) return chosen;
    return defaultLibraryFolder(await invoke<{ documents: string; home: string }>("library_places"));
  }

  /** Reads the library folder from disk again, for the tree and Home; only the latest reading is shown. */
  let libraryReading = 0;
  async function refreshLibrary() {
    const root = libraryRoot;
    if (!root) return;
    const reading = ++libraryReading;
    try {
      // The open project's own folders and files come too, for its Files in the tree.
      const open = folderOf(session.path).path;
      const entries = await invoke<LibraryEntry[]>("list_library", { folder: root, open });
      if (reading === libraryReading && root === libraryRoot) libraryEntries = entries;
    } catch {
      // The tree keeps what it showed.
    }
  }

  /** The open project's shelf as saved now, after a writing was added, moved, renamed or deleted. */
  async function refreshShelf() {
    try {
      shelf = await readOpenShelf();
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  /** What library.rs says when a folder of that name is there already. */
  const FOLDER_TAKEN = "Something with that name is already there";
  /** An error as the Windows side reported it, before it is translated. */
  const rawError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  /**
   * Makes a project's folder in `parent` and returns its file. With `reuse`, a project already there under
   * that name is used, and so is its folder left empty by an earlier try; any other trouble is said.
   */
  async function makeProjectFolder(parent: string, name: string, reuse = false): Promise<string> {
    const problem = folderNameProblem(name);
    if (problem) throw new Error(t(problem));
    const target = projectFile(joinPath(parent, name.trim()));
    if (reuse && (await invoke<boolean>("project_file_exists", { path: target }))) return target;
    try {
      return await invoke<string>("new_project_folder", { parent, name: name.trim() });
    } catch (error) {
      if (reuse && rawError(error) === FOLDER_TAKEN) return target;
      throw error;
    }
  }

  /**
   * A folder in `parent` for a project named `name`: the name made fit for a folder, with " (2)", " (3)"…
   * when one of that name is there already. Returns the folder.
   */
  async function freeProjectFolder(parent: string, name: string): Promise<string> {
    const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/^[.$\s]+|[.\s]+$/g, "").trim() || t("firstProjectName");
    const fit = folderNameProblem(base) ? t("firstProjectName") : base;
    for (let n = 1; n < 100; n += 1) {
      const candidate = n === 1 ? fit : `${fit} (${n})`;
      try {
        return await invoke<string>("create_library_folder", { parent, name: candidate });
      } catch (error) {
        if (rawError(error) !== FOLDER_TAKEN) throw error;
      }
    }
    throw new Error(t("nameTaken"));
  }

  /** The chapter to show in a writing: the one asked for, else the one open there last, else its first. */
  function chapterToOpen(open: Writing, chapterId?: string): string | null {
    const ordered = [...open.chapters].sort((a, b) => a.position - b.position);
    const outline = shelf?.writings.find((item) => item.id === open.id);
    return (
      ordered.find((chapter) => chapter.id === chapterId)?.id ??
      ordered.find((chapter) => chapter.id === outline?.openedChapter)?.id ??
      ordered[0]?.id ??
      null
    );
  }

  /** Earlier versions, a split to take back and the panel's note belong to the writing that was open. */
  function resetWritingState() {
    versions.reset();
    notesStore.drop();
    noteQuery = "";
    splitBack = null;
    pageSpot = null;
    commentFocus = "";
  }

  /**
   * Inside a change, with the page closed: the open project's writing `id` takes the page, at the chapter
   * asked for or the one open there last. Returns the writing left.
   */
  async function showWriting(id: string, chapterId?: string): Promise<Writing | null> {
    const left = writing;
    const written = wordsToday;
    const next = await loadWriting(id);
    writing = next;
    resetWritingState();
    prefs = { ...prefs, writingDay: dayKey(new Date(clock)), dayStartWords: writingWords - written };
    activeId = chapterToOpen(next, chapterId);
    return left;
  }

  /** Opens another writing of the open project, at the chapter asked for or the one open there last. */
  async function openWriting(id: string, chapterId?: string) {
    if (!writing || !shelf) return;
    if (id === writing.id) {
      if (chapterId && chapterId !== activeId) await selectChapter(chapterId);
      view = "write";
      return;
    }
    const project = projectId;
    try {
      let left: Writing | null = null;
      await withEditorClosed(async () => {
        // Another project opened meanwhile, or the writing went to Deleted while its row was still there: it stays shut.
        if (projectId !== project) return;
        if ((await readOpenShelf()).writings.find((item) => item.id === id)?.deletedAt) return;
        left = await showWriting(id, chapterId);
      });
      view = "write";
      if (left) void wordCopy.update(false, left);
      await refreshShelf();
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  /** Opens a project, or a writing in one, from the library or Home. A project that isn't there any more is said so. */
  async function openFromLibrary(path: string, target: { writingId?: string; chapterId?: string } = {}) {
    try {
      if (path.toLowerCase() === session.path.toLowerCase()) {
        if (target.writingId) await openWriting(target.writingId, target.chapterId);
        else view = "write";
        return;
      }
      // Opening a missing file would quietly make an empty project in its place.
      if (!(await invoke<boolean>("project_file_exists", { path }))) {
        throw new Error(t("projectFolderMissing", { path: folderOf(path).path }));
      }
      await useProjectFile(path, target);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  /** Home's Continue writing: the project, writing and chapter that were open last. */
  async function continueWriting(zenAfter = false) {
    const last = prefs.lastOpened;
    if (last.path && last.path.toLowerCase() !== session.path.toLowerCase()) {
      await openFromLibrary(last.path, { writingId: last.writingId, chapterId: last.chapterId });
    } else if (last.writingId && last.writingId !== writingId) {
      await openWriting(last.writingId, last.chapterId);
    } else if (last.chapterId && last.chapterId !== activeId && writing?.chapters.some((chapter) => chapter.id === last.chapterId)) {
      activeId = last.chapterId;
    }
    view = "write";
    if (zenAfter) await setZen(true);
  }

  // What Continue writing opens next time: the project, writing and chapter open now. Written when one of
  // them changes, never while she types.
  $effect(() => {
    const path = session.path;
    const id = writingId;
    const chapterId = activeId ?? "";
    if (!path || !id || !chapterId || restoring) return;
    untrack(() => {
      const last = prefs.lastOpened;
      if (last.path === path && last.writingId === id && last.chapterId === chapterId) return;
      prefs = { ...prefs, lastOpened: { path, writingId: id, chapterId } };
      void setWritingFields(id, { openedAt: new Date().toISOString(), openedChapter: chapterId }).catch(() => undefined);
    });
  });

  /** The name of a new writing, folder or project, checked; the message to show beside it when it won't do. */
  /** The search across every project, while open: the words it started with. */
  let searchAsk = $state<{ query: string } | null>(null);
  /** The words to find on a chapter's page once it opens, from the search across projects. */
  let pageFind: { id: string; query: string; nth: number } | null = null;
  /** A note to open beside the page once its project's notes are read, from the search across projects. */
  let noteToShow = $state("");

  function openSearch(query = "") {
    searchAsk = { query: query.trim() };
  }

  /**
   * Every project for the search: the open one first, with what she has just written saved, then the
   * library's, then those kept elsewhere. One that can't be read is named, and the others are still searched.
   */
  async function readEveryProject(progress: (done: number, total: number) => void): Promise<{ sources: SearchSource[]; unread: string[] }> {
    await autosave.flush().catch(() => undefined);
    await flushNoteSave().catch(() => undefined);
    const open = session.path;
    const paths: string[] = [];
    const seen = new Set<string>();
    const add = (path: string) => {
      const key = path.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        paths.push(path);
      }
    };
    add(open);
    for (const path of projectFiles(sortEntries(libraryEntries, locale()))) add(path);
    for (const known of prefs.knownProjects) add(known.path);
    const sources: SearchSource[] = [];
    const unread: string[] = [];
    for (const [index, path] of paths.entries()) {
      progress(index, paths.length);
      try {
        // A project that isn't there any more is left out: opening its file would make an empty one.
        if (path !== open && !(await invoke<boolean>("project_file_exists", { path }))) continue;
        sources.push({ path, name: projectName(path), text: await readProjectText(path) });
      } catch {
        unread.push(projectName(path));
      }
    }
    progress(paths.length, paths.length);
    return { sources, unread };
  }

  /** A place found by the search across projects: it opens as from find's list, a chapter with find on the words. */
  async function openSearchHit(hit: SearchHit, query: string) {
    searchAsk = null;
    if (hit.kind === "chapter") {
      find.showQuery(query);
    }
    await openFindHit(hit);
  }

  // A note from the search opens once its project's notes are there.
  $effect(() => {
    const id = noteToShow;
    if (!id || !notesStore.notes.some((note) => note.id === id)) return;
    noteToShow = "";
    untrack(() => showNote(id));
  });

  /** The Ideas tab's requests: a new idea (Ctrl+Shift+N there), and an idea to open once its project opened. */
  let ideasCreate = $state<{ at: number } | null>(null);
  let ideaOpen = $state<{ id: string; at: number } | null>(null);

  /** Every other project's ideas, for the Ideas tab's All projects: only read, and let go at once. */
  async function readOtherIdeas(progress: (done: number, total: number) => void): Promise<{ cards: IdeaCard[]; unread: string[] }> {
    const open = session.path.toLowerCase();
    const paths: string[] = [];
    const seen = new Set<string>([open]);
    const add = (path: string) => {
      const key = path.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        paths.push(path);
      }
    };
    for (const path of projectFiles(sortEntries(libraryEntries, locale()))) add(path);
    for (const known of prefs.knownProjects) add(known.path);
    const cards: IdeaCard[] = [];
    const unread: string[] = [];
    for (const [index, path] of paths.entries()) {
      progress(index, paths.length);
      try {
        // A project that isn't there any more is left out: opening its file would make an empty one.
        if (!(await invoke<boolean>("project_file_exists", { path }))) continue;
        cards.push(...otherCards(await readProjectIdeas(path), path, projectName(path)));
      } catch {
        unread.push(projectName(path));
      }
    }
    progress(paths.length, paths.length);
    return { cards, unread };
  }

  /** Another project's idea, opened in its project to be written there; the Ideas tab stays. */
  async function openIdeaInItsProject(card: IdeaCard) {
    try {
      if (!(await invoke<boolean>("project_file_exists", { path: card.path }))) {
        throw new Error(t("projectFolderMissing", { path: folderOf(card.path).path }));
      }
      await useProjectFile(card.path, {}, false);
      view = "ideas";
      ideaOpen = { id: card.id, at: Date.now() };
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  /** The Quick idea window, open from anywhere with Ctrl+Shift+N. */
  let quickIdeaOpen = $state(false);

  /** A quick idea, kept among the open project's Ideas without leaving what she is doing (owner, 12 October). */
  async function addIdea(text: string): Promise<boolean> {
    if (!projectId || !text.trim()) return false;
    const note = ideaNote(text, projectId, new Date().toISOString());
    try {
      await saveNote(note);
    } catch (error) {
      reportSaveError(errorMessage(error));
      return false;
    }
    notesStore.added(note);
    notice(t("ideaSaved", { project: shelf?.title ?? "" }));
    return true;
  }

  /** The New project window, while it is open: the folder it was asked for in, and documents dropped on Home. */
  let newProjectAsk = $state<{ parent: string; dropped?: DocumentSource[] } | null>(null);

  /** Opens the New project window, for a project in `parent` (the library's top when empty). */
  function startProject(parent = "") {
    newProjectAsk = { parent: parent || libraryRoot };
    // Its list of folders is the library as it is now.
    void refreshLibrary();
  }

  /** Word, OpenDocument, text or Markdown files she picks, one or several, in the order Explorer shows them. */
  async function chooseDocuments(several: boolean, near = ""): Promise<DocumentSource[]> {
    return byFileName(await chooseDocumentFiles(several, near), locale()).map(documentAt);
  }

  /** A document on the disk, to bring in. */
  function documentAt(path: string): DocumentSource {
    return { name: lastName(path), folder: lastName(parentFolder(path)), read: () => readDocument(path) };
  }

  /** A Word, text or Markdown file, read into chapters, its pictures made small. */
  async function readDocument(path: string): Promise<WordImport> {
    return readDocumentData(await invoke<ArrayBuffer>("read_document_file", { path }), path);
  }

  /** A document's bytes (`file` names it: Word, OpenDocument, text or Markdown) read into chapters, its pictures made small. */
  async function readDocumentData(data: ArrayBuffer, file: string): Promise<WordImport> {
    const name = documentName(file);
    const kind = documentKind(file);
    // OpenDocument, text and Markdown are read by code loaded when it is needed, as Word's reader is.
    const result =
      kind === "word"
        ? await readWordFile(data, name)
        : kind === "opendocument"
          ? await (await import("$lib/export/odtImport")).readOdtFile(data, name)
          : (await import("$lib/export/textImport")).readTextFile(data, name, kind === "markdown");
    for (const chapter of result.chapters) await shrinkPictures(chapter.contentJson);
    return result;
  }

  /**
   * The New project window's project: a blank page, or the writings its documents make. The window read
   * them before anything is made, so one that can't be read leaves no half-made project; those that
   * couldn't be read stay out, and she is told which. Opens the project in Write.
   */
  async function createProject(request: ProjectRequest): Promise<string | null> {
    const name = request.name.trim();
    const problem = folderNameProblem(name);
    if (problem) return t(problem);
    try {
      const drafts = request.drafts;
      const path = await makeProjectFolder(request.parent || libraryRoot, name);
      const [first, ...rest] = drafts;
      await useProjectFile(path, {}, true, {
        title: name,
        writingTitle: first?.title ?? name,
        welcome: false,
        ...(first ? { first: { split: first.split, chapters: draftChapters(first) } } : {}),
      });
      if (rest.length > 0) {
        const project = projectId;
        const language = writing?.language ?? ui.language;
        // Only into the project just made, after any change under way.
        await oneAtATime(async () => {
          if (projectId !== project) return;
          for (const draft of rest) await addWriting({ title: draft.title, folder: "", split: draft.split, language, chapters: draftChapters(draft) });
        });
        await refreshShelf();
      }
      await refreshLibrary();
      if (request.failed.length > 0) notice(t("filesLeftOut", { names: request.failed.join(", ") }));
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  /** New writing from Word and Bring back from Word, while its window is open: what it does, with which documents. */
  let bringInAsk = $state<{ mode: "add" | "replace"; sources: DocumentSource[] } | null>(null);

  function bringIn(mode: "add" | "replace", sources: DocumentSource[]) {
    if (sources.length === 0 || !writing) return;
    void BringInPart.load();
    bringInAsk = { mode, sources };
  }

  /** New writing from Word: the documents she picks become writings of this project, once she sees what they hold. */
  async function newWritingFromWord() {
    try {
      bringIn("add", await chooseDocuments(true));
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  /**
   * Bring back from Word: the writing (`id`) opened, and the document she picks (from its Word copy's folder,
   * where there is one) takes its place, once she sees what it holds and says so.
   */
  async function bringBackFromWord(id: string) {
    try {
      if (id !== writingId) await openWriting(id);
      if (!writing || writing.id !== id) return;
      const near = prefs.wordCopyFolder ? copyPathFor(prefs.wordCopyFolder, wordCopy.fileName(writing), writing.id, prefs.wordCopies) : "";
      bringIn("replace", await chooseDocuments(false, near));
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  /** Where documents dropped on Pensieve go: a new project on Home, new writings elsewhere; nowhere over a window. */
  function dropTarget(): "project" | "writing" | null {
    if (document.querySelector(".window")) return null;
    return view === "home" || !writing ? "project" : "writing";
  }

  /** Documents dropped on Pensieve: Word, OpenDocument, text and Markdown files come in; others are refused, and she is told. */
  function takeDropped(files: File[]) {
    const target = dropTarget();
    if (!target) return;
    const kept = byFileName(
      files.filter((file) => documentKind(file.name)).map((file) => file.name),
      locale(),
    ).map((name): DocumentSource => {
      const file = files.find((item) => item.name === name) as File;
      return { name, read: async () => readDocumentData(await file.arrayBuffer(), name) };
    });
    if (kept.length < files.length) libraryNotice(t("dropOnlyDocuments"));
    if (kept.length === 0) return;
    if (target === "writing") return bringIn("add", kept);
    newProjectAsk = { parent: libraryRoot, dropped: kept };
    void refreshLibrary();
  }

  /** A new folder in the library, on disk, to keep projects in. */
  async function newLibraryFolder(parent: string, name: string): Promise<string | null> {
    const problem = folderNameProblem(name);
    if (problem) return t(problem);
    try {
      await invoke<string>("create_library_folder", { parent: parent || libraryRoot, name: name.trim() });
      await refreshLibrary();
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  // A project's writings and writing folders, from the library (writingActions.svelte.ts, IMP-28).
  const writingOps = new WritingActions({
    shelf: () => shelf,
    writing: () => writing,
    writingId: () => writingId,
    projectId: () => projectId,
    oneAtATime,
    withEditorClosed,
    flush: () => autosave.flush(),
    openWriting: (id) => openWriting(id),
    showWriting: (id) => showWriting(id),
    putOpen: (next) => {
      const before = writingWords;
      writing = next;
      keepToday(before);
      activeId = next.chapters.find((chapter) => chapter.id === activeId)?.id ?? next.chapters[0]?.id ?? null;
    },
    renameOpen: (title) => renameOpenWriting(title),
    copyLeft: (left) => void wordCopy.update(false, left),
    refreshShelf,
    rememberProject,
    loadOrganizer,
    moveChapterLinks: (removed, kept) => notesStore.moveChapterLinks(removed, kept),
    notice,
    fail: reportSaveError,
  });

  /** A new note in a group of the project's notes (or tied to a chapter), opened over the page to write it. */
  async function newNoteIn(category: NoteCategory, title: string, chapterId = "") {
    if (!projectId) return;
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      projectId,
      title: title.trim() || t("newNoteTitle"),
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
      plainText: "",
      category,
      tags: "",
      aliases: "",
      fields: [],
      todoState: null,
      chapterIds: chapterId ? [chapterId] : [],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await saveNote(note);
      notesStore.added(note);
      // A note named in the library has its name; one made with the panel's + is named first.
      showNote(note.id, !title.trim());
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  async function changeNote(id: string, patch: Partial<Note>) {
    try {
      // As it is now, never the page's older copy; a note open in the panel is changed there too, or its
      // next word would save the old name back.
      const note = await currentNote(id);
      if (!note) return;
      const next = { ...note, ...patch, updatedAt: new Date().toISOString() };
      notesStore.replaced(next);
      await saveNote(next);
    } catch (error) {
      reportSaveError(errorMessage(error));
      void loadOrganizer();
    }
  }

  async function duplicateNote(id: string) {
    try {
      const note = await currentNote(id);
      if (!note) return;
      const now = new Date().toISOString();
      // A JSON copy: the note's text must be its own, not shared with the original.
      const copy: Note = { ...(JSON.parse(JSON.stringify(note)) as Note), id: crypto.randomUUID(), title: t("copyOf", { title: note.title }), createdAt: now, updatedAt: now };
      await saveNote(copy);
      notesStore.added(copy);
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  /** Deletes a note after keeping an earlier version of the open writing, which holds every note as it was. */
  async function deleteNoteFromTree(id: string) {
    // It leaves the panel first, so nothing typed there can write it back after the delete.
    if (notesStore.draft?.note.id === id) notesStore.drop();
    try {
      await flushNoteSave();
      if (writingId) await snapshotSavedWriting(writingId);
      await deleteNote(id);
      notesStore.removed(id);
    } catch (error) {
      reportSaveError(errorMessage(error));
    }
  }

  /**
   * A project's shelf, called by its folder's name when it is in the library, so Explorer, the tree and
   * Home say the same, also after its folder was renamed.
   */
  async function shelfNamedByFolder(path: string, current: Shelf): Promise<Shelf> {
    const name = projectName(path);
    if (!libraryRoot || !isInside(path, libraryRoot) || !name || current.title === name) return current;
    await setShelf({ title: name });
    return { ...current, title: name };
  }

  async function namedByFolder(path: string, opened: OpenedProject): Promise<OpenedProject> {
    return { ...opened, shelf: await shelfNamedByFolder(path, opened.shelf) };
  }

  /** After a folder of the library was renamed or moved: the paths Pensieve keeps in it follow it. */
  function followMove(from: string, to: string) {
    const moved = (path: string) => rebasePath(path, from, to);
    prefs = prefsAfterMove(prefs, from, to);
    wordCopy.held = moved(wordCopy.held);
    session.followMove(from, to);
    moveOpen(from, to);
  }

  /**
   * Renames a folder of the library or a project's folder, or moves it into another folder, on disk. When the
   * open project is in it, storage lets go of its file for the move and opens it where it went, in one step:
   * the page stays open, and saves made meanwhile wait and go into the file there. Returns what is wrong, or null.
   */
  async function relocateLibraryEntry(from: string, parent: string, name: string): Promise<string | null> {
    const problem = folderNameProblem(name);
    if (problem) return t(problem);
    const move = () => invoke<string>("move_library_entry", { path: from, parent, name: name.trim() });
    let to = "";
    try {
      // After the changes before it, so the project open then is the one it looks at.
      await oneAtATime(async () => {
        const file = session.path;
        if (!isInside(file, from)) {
          to = await move();
          return;
        }
        const reopened = await moveProjectFile(
          async () => {
            to = await move();
            return rebasePath(file, from, to);
          },
          // It moved but won't open there: it goes back where it was.
          async () => {
            await invoke<string>("move_library_entry", { path: to, parent: parentFolder(from), name: lastName(from) });
            to = "";
          },
        );
        if (shelf) shelf = await shelfNamedByFolder(reopened, shelf);
      });
      return null;
    } catch (error) {
      return errorMessage(error);
    } finally {
      // Whatever failed after the move, what Pensieve remembers follows the folder to where it is now.
      if (to) {
        followMove(from, to);
        rememberProject();
      }
      await refreshLibrary();
    }
  }

  /** Moves a folder or a project into another folder of the library, keeping its name. */
  async function moveLibraryEntry(path: string, into: string) {
    if (!into || sameFolder(parentFolder(path), into) || isInside(into, path)) return;
    const problem = await relocateLibraryEntry(path, into, lastName(path));
    if (problem) libraryNotice(problem);
  }

  /** Deletes an empty folder of the library; one with anything in it stays, and she is told why. */
  async function deleteLibraryFolder(path: string) {
    try {
      await invoke("remove_library_folder", { path });
    } catch (error) {
      libraryNotice(errorMessage(error));
    }
    await refreshLibrary();
  }

  /**
   * Moves a project of the library to the Recycle Bin, with everything in its folder (HOME-15); never the open
   * one. Where there is no Recycle Bin, Windows asks her itself, and a no there leaves it all as it was.
   */
  async function deleteProject(path: string) {
    const open = session.path;
    if (!libraryRoot || !isInside(path, libraryRoot) || sameFolder(folderOf(path).path, folderOf(open).path)) return;
    try {
      if (await invoke<boolean>("trash_project_folder", { path: folderOf(path).path, library: libraryRoot })) forgetProject(path);
    } catch (error) {
      libraryNotice(errorMessage(error));
    }
    await refreshLibrary();
  }

  /** Takes a project off Pensieve's lists; its files stay where they are. */
  function forgetProject(path: string) {
    prefs = prefsWithoutProject(prefs, path);
  }

  /** One of her files, opened in its own program: a Word file in Word, a picture in Photos. */
  async function openLibraryFile(path: string) {
    try {
      await invoke("open_library_file", { path });
    } catch (error) {
      notice(errorMessage(error));
    }
  }

  async function showInExplorer(path: string) {
    try {
      await invoke("show_in_explorer", { path });
    } catch (error) {
      notice(errorMessage(error));
    }
  }

  /** A web or e-mail link in her text, opened in her browser or mail program. */
  async function openLink(href: string) {
    if (!/^(https?:|mailto:)/i.test(href)) return;
    try {
      await invoke("open_link", { url: href });
    } catch (error) {
      notice(errorMessage(error));
    }
  }

  /** What the library's tree can do, in one place. */
  const libraryActions: LibraryActions = {
    openProject: (path) => void openFromLibrary(path),
    openWriting: (path, id, chapterId) => void openFromLibrary(path, { writingId: id, chapterId }),
    openNote: (id) => void showNote(id),
    openTodos: () => showTodos("all"),
    startProject,
    newLibraryFolder,
    renameLibraryEntry: (path, name) => relocateLibraryEntry(path, parentFolder(path), name),
    moveLibraryEntry: (path, into) => void moveLibraryEntry(path, into),
    deleteLibraryFolder: (path) => void deleteLibraryFolder(path),
    deleteProject: (path) => void deleteProject(path),
    forgetProject,
    placeWriting: (id, beforeId) => void writingOps.place(id, beforeId),
    openFile: (path) => void openLibraryFile(path),
    showInExplorer: (path) => void showInExplorer(path),
    importAsWriting: (path) => bringIn("add", [documentAt(path)]),
    newWritingFromWord: () => void newWritingFromWord(),
    bringBackFromWord: (id) => void bringBackFromWord(id),
    newWriting: (folder, name) => writingOps.make(folder, name),
    newWritingFolder: (name) => writingOps.makeFolder(name),
    renameWritingFolder: (from, to) => writingOps.renameFolder(from, to),
    deleteWritingFolder: (name) => void writingOps.deleteFolder(name),
    renameWriting: (id, title) => void writingOps.rename(id, title),
    duplicateWriting: (id) => void writingOps.duplicate(id),
    deleteWriting: (id) => void writingOps.delete(id),
    putBack: (id) => void writingOps.putBack(id),
    eraseWriting: (id) => void writingOps.erase(id),
    moveWriting: (id, folder) => void writingOps.move(id, folder),
    setSplit: (id, split) => void writingOps.setSplit(id, split),
    newNote: (category, title) => void newNoteIn(category, title),
    newChapter: () => void addChapter(),
    renameNote: (id, title) => void changeNote(id, { title: title.trim() || t("untitled") }),
    duplicateNote: (id) => void duplicateNote(id),
    deleteNote: (id) => void deleteNoteFromTree(id),
    moveNote: (id, category) => void changeNote(id, { category }),
    moveIntoLibrary: () => void moveIntoLibrary(),
    openAnother: () => void openAnotherProject(),
  };

  /** The library's tree on Home: what it opens, it opens in Write (another project goes there by itself). */
  const homeLibraryActions: LibraryActions = {
    ...libraryActions,
    openWriting: (path, id, chapterId) =>
      void openFromLibrary(path, { writingId: id, chapterId }).then(() => {
        if (writingId === id) view = "write";
      }),
    openNote: (id) => {
      view = "write";
      void showNote(id);
    },
    openTodos: () => {
      view = "write";
      showTodos("all");
    },
  };

  type SampleProject = {
    slug: string;
    /** Where it goes in the library: "" for the library itself, or a folder in it. */
    folder: string;
    title: string;
    build: (projectId: string) => { writings: { writing: Writing; folder: string }[]; notes: Note[]; tasks: Task[] };
  };

  /**
   * Writes sample projects into folders of their own in the library and lists them in it. A sample that
   * is there already is put back as it was written: its writings go to Deleted, where whatever was written
   * in them can still be put back, and its notes and to-dos go. The writer's own projects are never touched.
   */
  async function writeSampleProjects(samples: SampleProject[], done: string) {
    if (!writing) return;
    try {
      const written: Record<string, string> = {};
      const remembered: KnownProject[] = [];
      let homeRewritten = false;
      await withEditorClosed(async () => {
        // The project open when this change runs, which may not be the one open when it was asked for.
        const home = session.path;
        const homeWriting = writingId;
        await wordCopy.update();
        rememberProject();
        await session.elsewhere(
          async (visit) => {
            for (const sample of samples) {
              const parent = sample.folder ? joinPath(libraryRoot, sample.folder) : libraryRoot;
              const existing = prefs.samples[sample.slug] && (await invoke<boolean>("project_file_exists", { path: prefs.samples[sample.slug] }));
              const path = existing ? prefs.samples[sample.slug] : await makeProjectFolder(parent, sample.title, true);
              const fresh = !(await invoke<boolean>("project_file_exists", { path }));
              // Opened only to be written: it never becomes the open project, nor the one that opens at the next start.
              await visit(path);
              const opened = await openShelf("", { title: sample.title, writingTitle: sample.title, welcome: false });
              const built = sample.build(opened.shelf.projectId);
              // A file made just now starts with one empty writing, which simply goes.
              await writeSampleProject({ path, title: sample.title, placeholder: fresh ? opened.writing.id : "", ...built });
              written[sample.slug] = path;
              // Home and the library show it, with its writings, before it is ever opened.
              remembered.push({ path, title: sample.title, summary: summarizeProject(built.writings.map((item) => summarize(item.writing))) });
              if (path.toLowerCase() === home.toLowerCase()) homeRewritten = true;
            }
          },
          // Whatever happened, the open project is open again, and storage knows it, for note and to-do saves.
          async () => {
            const reopened = await openShelf(homeRewritten ? "" : homeWriting, { title: projectName(home), writingTitle: t("untitled"), welcome: false });
            shelf = reopened.shelf;
            // The open project was one of them, or a reset that failed half-way already put its writing in Deleted:
            // show what is there now, never a deleted writing (or the next save would write the old text back).
            if (homeRewritten || reopened.writing.id !== homeWriting) {
              writing = reopened.writing;
              resetWritingState();
              activeId = chapterToOpen(reopened.writing);
            }
          },
        );
      });
      const paths = new Set(remembered.map((item) => item.path.toLowerCase()));
      prefs = {
        ...prefs,
        samples: { ...prefs.samples, ...written },
        knownProjects: [...remembered, ...prefs.knownProjects.filter((item) => !paths.has(item.path.toLowerCase()))].slice(0, 50),
      };
      await refreshLibrary();
      backupMessage = done;
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function addExampleBooks() {
    const { EXAMPLE_PROJECTS, buildExample } = await import("$lib/samples/examples");
    await writeSampleProjects(
      EXAMPLE_PROJECTS.map((example) => ({
        slug: example.slug,
        folder: t("examplesFolder"),
        title: example.title,
        build: (projectId: string) => buildExample(example, projectId),
      })),
      t("examplesAdded"),
    );
  }

  /** About 150,000 words, for timing typing in a big book on the writer's laptop. */
  async function addLongBook() {
    const { LONG_BOOK_SLUG, buildLongBook } = await import("$lib/samples/longBook");
    const language = ui.language;
    await writeSampleProjects(
      [
        {
          slug: LONG_BOOK_SLUG,
          folder: "",
          title: t("longBookTitle"),
          build: (projectId: string) => {
            const built = buildLongBook(projectId, t("longBookTitle"), (n) => chapterTitle(language, n));
            return { writings: [{ writing: built.writing, folder: "" }], notes: built.notes, tasks: built.tasks };
          },
        },
      ],
      t("longBookAdded"),
    );
  }

  /** Opens a project file from anywhere on the computer; one outside the library is listed under Elsewhere. */
  async function openAnotherProject() {
    try {
      const path = await chooseProjectFile();
      if (!path) return;
      await useProjectFile(path);
    } catch (error) {
      saveStatus = { state: "error", message: errorMessage(error) };
    }
  }

  // The library as its trees show it, beside the page and on Home.
  const libraryView = $derived<LibraryView>({
    root: libraryRoot,
    entries: libraryEntries,
    known: prefs.knownProjects,
    currentPath: session.path,
    shelf,
    notes: notesStore.notes,
    openTodos: notesStore.tasks.filter((task) => task.todoState !== "done").length,
  });

  /** The library folder from Settings: never in a synced folder, never with the backups. */
  async function pickLibraryFolder() {
    try {
      const folder = await chooseBackupFolder(t("dialogLibraryFolder"));
      if (!folder) return;
      if (looksSynced(folder)) {
        backupMessage = t("librarySynced");
        return;
      }
      if (prefs.backupFolder && (isInside(folder, prefs.backupFolder) || isInside(prefs.backupFolder, folder))) {
        backupMessage = t("libraryBackupApart");
        return;
      }
      if (await invoke<boolean>("project_file_exists", { path: projectFile(folder) })) {
        backupMessage = t("libraryIsProject");
        return;
      }
      prefs = { ...prefs, libraryFolder: folder };
      libraryRoot = folder;
      await refreshLibrary();
      backupMessage = t("libraryMoved", { path: folder });
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  function setBookGoal(words: number) {
    if (!writing) return;
    writing = { ...writing, wordGoal: words };
    autosave.schedule();
  }

  function setProjectLanguage(language: WritingLanguage) {
    if (!writing) return;
    writing = { ...writing, language };
    autosave.schedule();
    void autosave.flush().catch(() => undefined);
  }

  async function addDictionaryWord(language: WritingLanguage, word: string) {
    const cleaned = word.trim();
    if (!cleaned) return;
    try {
      // After any change under way, so the word goes into the open project's file.
      await oneAtATime(async () => {
        await invoke("add_personal_word", { language, word: cleaned });
        await rememberPersonalWord(language, cleaned);
        dictionary = await listPersonalWords();
      });
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  async function removeDictionaryWord(language: WritingLanguage, word: string) {
    try {
      await oneAtATime(async () => {
        await forgetPersonalWord(language, word);
        dictionary = await listPersonalWords();
      });
      try {
        await invoke("remove_personal_word", { language, word });
      } catch {
        // Pensieve has forgotten the word; only Windows' copy is left, and it does no harm.
      }
    } catch (error) {
      backupMessage = errorMessage(error);
    }
  }

  /**
   * Copies the open project, kept outside the library, into a folder of its own in it, and opens the
   * copy. The old file stays where it was, off the lists, so nobody edits the stale one.
   */
  async function moveIntoLibrary() {
    if (!writing || !shelf) return;
    try {
      await withEditorClosed(async () => {
        // The project open when this change runs.
        const source = session.path;
        if (isInside(source, libraryRoot)) return;
        const name = shelf?.title.trim() || projectName(source) || t("untitled");
        let folder = "";
        // Saves wait from the copy until the copy is the open file: one made in between would stay in the old one.
        // A copy that won't open goes to the Recycle Bin rather than stay in the library as a project that won't
        // open, and the project stays where it was, opened there again.
        const opened = await session.moveTo(
          async () => {
            folder = await freeProjectFolder(libraryRoot, name);
            // A whole copy from SQLite itself, in the save queue: nothing written meanwhile is left behind (ARCH-6).
            return copyOpenProject(folder);
          },
          async (path) => namedByFolder(path, await openShelf(writingId, { title: name, writingTitle: name, welcome: false })),
          () => invoke("trash_project_folder", { path: folder, library: libraryRoot }),
        );
        const destination = session.path;
        prefs = { ...prefs, knownProjects: prefs.knownProjects.filter((book) => book.path.toLowerCase() !== source.toLowerCase()) };
        shelf = opened.shelf;
        rememberProject();
        backupMessage = t("projectMoved", { path: destination });
        notice(t("projectMoved", { path: destination }));
      });
      await refreshLibrary();
    } catch (error) {
      backupMessage = errorMessage(error);
      reportSaveError(errorMessage(error));
    }
  }

  function statusText(status: SaveStatus): string {
    if (status.state === "saving") return t("saving");
    if (status.state === "unsaved") return t("unsaved");
    if (status.state === "error") return t("notSaved");
    return t("saved");
  }
</script>

<svelte:window
  onkeydowncapture={browserKeys}
  onkeydown={onKeydown}
  ondragover={(event) => {
    // A file dragged in from Explorer comes in (owner, 14 October), or is refused over a window, so it can
    // never open in Pensieve's place.
    const data = event.dataTransfer;
    if (!event.defaultPrevented && data?.types.includes("Files")) {
      event.preventDefault();
      data.dropEffect = dropTarget() ? "copy" : "none";
    }
  }}
  ondrop={(event) => {
    if (!event.defaultPrevented && event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      takeDropped([...event.dataTransfer.files]);
    }
  }}
/>

{#snippet homeHeader()}
  <HomeHeader
    update={updates.offer}
    onUpdate={() => void updates.install()}
    {prefs}
    now={clock}
    error={saveStatus.state === "error" ? saveStatus.message : homeNotice}
    appearance={resolvedTheme(prefs.theme, new Date(clock))}
    {settingsOpen}
    onLanguage={() => (prefs = { ...prefs, uiLanguage: prefs.uiLanguage === "sl" ? "en" : "sl" })}
    onTheme={(theme) => (prefs = { ...prefs, theme })}
    onSearch={() => openSearch()}
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
    update={updates.offer}
    onUpdate={() => void updates.install()}
    project={writing?.title ?? t("untitled")}
    {view}
    saveLabel={statusText(saveStatus)}
    saveState={saveStatus.state}
    language={writing && activeChapter ? (effectiveLanguage(writing, activeChapter) === "sl" ? "SL" : "EN") : "EN"}
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
    expanded={prefs.toolsExpanded}
    onExpanded={(open) => (prefs = { ...prefs, toolsExpanded: open })}
    paper={prefs.paper}
    paperSize={prefs.paperSize}
    onPaper={(paper, size) => (prefs = { ...prefs, paper, paperSize: size })}
    onZen={() => void setZen(true)}
    repetitions={prefs.repetitions}
    onRepetitions={(on) => (prefs = { ...prefs, repetitions: on })}
    revision={editorRevision}
    chaptersOpen={!collapsed}
    notesOpen={prefs.panel === "notes"}
    todosOpen={prefs.panel === "todos"}
    goalsOpen={prefs.panel === "goals"}
    notesCount={chapterNotes.length}
    todosCount={chapterTodos.filter((task) => task.todoState !== "done").length}
    {wordsToday}
    onToggleChapters={() => (collapsed = !collapsed)}
    onToggleNotes={() => togglePanel("notes")}
    onToggleTodos={() => togglePanel("todos")}
    onToggleGoals={() => togglePanel("goals")}
    findOpen={find.open}
    onFind={() => {
      view = "write";
      if (find.open) find.close();
      else find.show("chapter");
    }}
    manuscriptFont={prefs.manuscriptFont}
    manuscriptPt={prefs.manuscriptPt}
    onReplace={() => {
      view = "write";
      find.show(find.scope === "all" ? "chapter" : find.scope, true);
    }}
    loadNotes={() => (projectId ? listNotes() : Promise.resolve([]))}
    onComment={newComment}
    onNotice={notice}
  />
  {/if}
  {#if view === "write"}
<div class="shell" class:collapsed class:zen class:paneled={panelOpen}>
  <Sidebar
    {chapters}
    {activeId}
    {collapsed}
    article={!!writing && !writing.split}
    onSelect={selectChapter}
    onCreate={addChapter}
    onRename={renameChapter}
    onDuplicate={duplicateChapter}
    onDelete={deleteChapter}
    onReorder={reorderChapters}
    onHistory={() => void versions.show()}
    onHide={() => (collapsed = true)}
    view={prefs.sidebarView}
    onView={(next) => (prefs = { ...prefs, sidebarView: next })}
    library={libraryView}
    {writingId}
    writingTitle={writing?.title ?? ""}
    writingSplit={writing?.split ?? true}
    {writingWords}
    actions={libraryActions}
  />
  <section class="writing">
    {#if zen}
      <!-- Zen's still scene for the look on now, around the page. -->
      <div class="zen-scene" aria-hidden="true"></div>
    {/if}
    <!-- Candlelit sparks drift over the desk, behind the page and everything else here. -->
    <Particles active={resolvedTheme(prefs.theme, new Date(clock)) === "candlelit" && !prefs.gentle && !zen} />
    {#if collapsed && !zen}
      <!-- The folded chapter list leaves a tab at the desk's edge to bring it back. -->
      <button type="button" class="show-chapters" title={t(libraryShown ? "showLibrary" : "showChapters")} aria-label={t(libraryShown ? "showLibrary" : "showChapters")} onclick={() => (collapsed = false)}>
        <Icon name="panelLeftOpen" />
      </button>
    {/if}
    {#if find.open && FindPart.current}
      {@const FindPanel = FindPart.current}
      <FindPanel
        bind:query={find.query}
        bind:replacement={find.replacement}
        bind:scope={find.scope}
        bind:options={find.options}
        bind:replaceShown={find.replaceShown}
        bind:input={find.input}
        found={find.found}
        sources={find.sources}
        progress={find.progress}
        unread={find.unread}
        openPath={session.path}
        notice={find.notice}
        onStep={(step) => find.step(step)}
        onReplace={() => find.replaceOne()}
        onReplaceAll={() => void find.replaceEvery()}
        onOpen={(hit) => void openFindHit(hit)}
        onClose={() => find.close()}
      />
    {/if}
    {#if splitBack}
      <!-- A heading just made a new chapter: a few seconds to take it back, as Ctrl+Z can't reach it. -->
      <p class="write-notice" role="status">
        {t("splitNotice", { title: splitBack.title })}
        <button type="button" class="notice-undo" onclick={() => void takeBackSplit()}>{t("undo")}</button>
      </p>
    {:else if writeNotice}
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
    <div class="stage">
      {#if activeChapter && !restoring}
        {@const chapter = activeChapter}
        {#key chapter.id}
          <div
            class="page-row"
            class:commented={commentCount > 0 && !zen}
            class:paged={sheet !== null}
            style:--sheet={zen ? `calc(${prefs.columnRem}rem + 2 * var(--zen-margin))` : sheet ? `${paperSize.width}px` : pageWidthValue(prefs.pageWidth)}
            style:--leaf-h={sheet ? `${paperSize.height}px` : undefined}
            style:--leaf-margin={sheet ? `${paperSize.margin}px` : undefined}
          >
          <div class="sheet">
            {#if sheet}
              <!-- The sheets of paper behind the text, each numbered at its foot. -->
              {#each { length: leafCount }, index (index)}
                <div class="leaf" style:top="{index * (sheet.height + sheet.gap)}px" aria-hidden="true"><span class="folio">{index + 1}</span></div>
              {/each}
            {/if}
            <article
              class="paper"
              style:padding={sheet ? `${sheet.top}px ${paperSize.margin}px ${sheet.bottom}px` : undefined}
              style:min-height={sheet ? `${leafCount * (sheet.height + sheet.gap) - sheet.gap}px` : undefined}
              style:--pv-sheet-room={sheet ? `${sheet.height - sheet.top - sheet.bottom}px` : undefined}
            >
              {#if EditorPart.current}
                {@const Editor = EditorPart.current}
                <Editor
                  page
                  docId={chapter.id}
                  initialContent={composePage(chapters, chapters.findIndex((item) => item.id === chapter.id), writing?.split ?? true)}
                  language={writing ? effectiveLanguage(writing, chapter) : "en"}
                  typewriter={prefs.typewriter}
                  {sheet}
                  keySounds={prefs.keySounds}
                  smoothTyping={prefs.smoothTyping}
                  repetitions={prefs.repetitions && !zen}
                  onFound={(found) => (find.found = found)}
                  keyVolume={prefs.keySoundVolume}
                  onSheets={(count) => {
                    sheetCount = count;
                    // Lines a break moved take their comment cards with them.
                    editorRevision += 1;
                  }}
                  live={false}
                  onChange={(json, _text, id) => updateChapter(id ?? chapter.id, json)}
                  onEdit={() => autosave.schedule()}
                  onText={(text, id) => updateChapterText(id ?? chapter.id, text)}
                  onEditor={(next) => {
                    textEditor = next;
                    editorChapter = next ? chapter.id : "";
                    if (next) {
                      editorBegan = startsPart(chapters, chapters.findIndex((item) => item.id === chapter.id));
                      editorWriting = writing?.id ?? "";
                      editorSplit = writing?.split ?? true;
                    }
                    refreshFootnotes();
                    const finding = pageFind;
                    if (next && finding?.id === chapter.id) {
                      pageFind = null;
                      find.showMatchAt(next, finding.nth);
                    }
                    const opened = pageSpot;
                    if (next && opened?.id === chapter.id) {
                      pageSpot = null;
                      // The keyboard goes to the spot now; the page's first focus, a frame later, finds it there and leaves it.
                      placeSpot(next, opened.spot);
                    }
                  }}
                  onActivity={() => {
                    editorRevision += 1;
                    watchHeadings();
                  }}
                  onOpenNote={(target) => {
                    // A linked name opens its note in the panel beside the page.
                    const title = target.title.trim().toLowerCase();
                    const id = target.id || (notesStore.notes.find((note) => note.title.trim().toLowerCase() === title)?.id ?? "");
                    if (id) showNote(id);
                  }}
                />
              {/if}
              {#if textEditor && SelectionBarPart.current}
                {@const SelectionBar = SelectionBarPart.current}
                <SelectionBar
                  editor={textEditor}
                  {zen}
                  onComment={newComment}
                  onNote={() => void noteFromSelection()}
                  onFind={(words) => find.showWords(words)}
                  onWords={(count) => (selectedWords = count)}
                />
              {/if}
              {#if pageNotes.length > 0}
                <!-- On sheets, the footnotes have a sheet of their own after the chapter's. -->
                <ol
                  class="page-notes"
                  class:on-sheet={sheet !== null}
                  style:top={sheet ? `${sheetCount * (sheet.height + sheet.gap) + sheet.top}px` : undefined}
                >
                  {#each pageNotes as note, index (index)}
                    <li>{note || "…"}</li>
                  {/each}
                </ol>
              {/if}
            </article>
          </div>
          {#if !zen && CommentRailPart.current}
            {@const CommentRail = CommentRailPart.current}
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
        error={saveStatus.state === "error" ? saveStatus.message : ""}
        {zen}
        onZen={() => void setZen(!zen)}
        today={wordsToday}
        appearance={resolvedTheme(prefs.theme, new Date(clock))}
        onTheme={(theme) => (prefs.theme = theme)}
        ambience={prefs.ambience}
        ambienceVolume={prefs.ambienceVolume}
        keySounds={prefs.keySounds}
        keySoundVolume={prefs.keySoundVolume}
        onSound={(change) => (prefs = { ...prefs, ...change })}
        focusMinutes={prefs.pomodoroFocus}
        breakMinutes={prefs.pomodoroBreak}
        selected={selectedWords}
      />
    </div>
    {#if zen}
      <ZenBar editor={textEditor} revision={editorRevision} words={chapterWords} selected={selectedWords} bind:column={prefs.columnRem} onLeave={() => void setZen(false)} onRefused={notice} />
    {/if}
  </section>
  {#if panelOpen && writing && activeChapter}
    {#if prefs.panel === "notes" && notesStore.draft && NotePanePart.current}
      {@const NotePane = NotePanePart.current}
      <!-- Each note is set out afresh, so a new one's name is ready to be typed. -->
      {#key notesStore.draft.note.id}
        <NotePane
          note={notesStore.draft.note}
          fresh={notesStore.draft.fresh}
          language={writing.language}
          index={noteIndex}
          total={noteOrder.length}
          onEdit={editPaneNote}
          onOpenLinked={openLinkedNote}
          onBack={() => leaveNote()}
          onPrevious={noteIndex > 0 ? () => showNote(noteOrder[noteIndex - 1]) : undefined}
          onNext={noteIndex >= 0 && noteIndex < noteOrder.length - 1 ? () => showNote(noteOrder[noteIndex + 1]) : undefined}
          onOpenInNotes={() => void paneNoteToNotes()}
          onClose={closePanel}
        />
      {/key}
    {:else}
      <ChapterPanel
        list={prefs.panel || "notes"}
        todos={notesStore.tasks}
        chapterId={activeChapter.id}
        {chapters}
        {todoScope}
        onTodoScope={(scope) => (todoScope = scope)}
        notes={noteList}
        book={notesStore.notes}
        bind:query={noteQuery}
        onNewNote={() => void newNoteIn("ideas", "", activeId ?? "")}
        onOpenNote={(id) => showNote(id)}
        onToggleTodo={(task) => void toggleChapterTodo(task)}
        onAddTodo={addPanelTodo}
        onOpenBoard={() => (view = "todos")}
        {wordsToday}
        dailyGoal={prefs.dailyGoal}
        {chapterWords}
        chapterGoal={activeChapter.wordGoal}
        onDailyGoal={(goal) => (prefs = { ...prefs, dailyGoal: goal })}
        onChapterGoal={(goal) => activeId && updateChapterMeta(activeId, { wordGoal: goal })}
        onClose={closePanel}
      />
    {/if}
  {/if}
</div>
  {:else if writing}
    <div class="alt" class:home={view === "home"} class:settings={view === "settings"}>
      {#if view === "home"}
        {@render homeHeader()}
        <span class="decor-low" aria-hidden="true"></span>
        <Dashboard
          {writing}
          projectTitle={shelf?.title ?? ""}
          openSummary={projectSummary()}
          lastChapterId={prefs.lastOpened.writingId === writingId ? prefs.lastOpened.chapterId : ""}
          {prefs}
          now={clock}
          {wordsToday}
          layout={prefs.homeLayout}
          onLayout={(layout) => (prefs = { ...prefs, homeLayout: layout })}
          library={libraryView}
          actions={homeLibraryActions}
          {writingWords}
          onContinue={(chapterId) => {
            // A chapter from Home's tree opens in the writing on Home; Continue opens what was open last.
            if (chapterId) {
              activeId = chapterId;
              view = "write";
            } else void continueWriting();
          }}
          onZen={(chapterId) => {
            if (chapterId) {
              activeId = chapterId;
              view = "write";
              void setZen(true);
            } else void continueWriting(true);
          }}
          onOpenTodos={() => (view = "todos")}
          onAmbience={() => {
            settingsSection = "Ambience";
            settingsReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            settingsOpen = true;
          }}
          tasks={notesStore.tasks}
          onToggleTask={(task) => void toggleChapterTodo(task)}
          loadError={notesStore.error}
          onStartProject={() => startProject()}
          books={homeProjects}
          currentPath={session.path}
          onOpenBook={(path) => void openFromLibrary(path)}
          appearance={resolvedTheme(prefs.theme, new Date(clock))}
        />
      {:else if view === "notes" && NotesPart.current}
        {@const Notes = NotesPart.current}
        {#key projectId}
        <Notes
          {projectId}
          store={notesStore}
          {writingId}
          {chapters}
          language={writing.language}
          focusChapterId={activeId ?? ""}
          openRequest={noteOpenRequest}
          onOpenHandled={() => (noteOpenRequest = null)}
          onSaveError={reportSaveError}
          onShowTodos={() => (view = "todos")}
        />
        {/key}
      {:else if view === "ideas" && IdeasPart.current}
        {@const IdeasView = IdeasPart.current}
        {#key projectId}
          <IdeasView
            {projectId}
            store={notesStore}
            projectPath={session.path}
            projectTitle={projectName(session.path) || shelf?.title || ""}
            {writingId}
            language={writing.language}
            loadOthers={readOtherIdeas}
            createRequest={ideasCreate}
            onCreateHandled={() => (ideasCreate = null)}
            openRequest={ideaOpen}
            onOpenHandled={() => (ideaOpen = null)}
            onOpenElsewhere={(card) => void openIdeaInItsProject(card)}
            onOpenInNotes={openNoteInView}
            onSaveError={reportSaveError}
          />
        {/key}
      {:else if view === "todos" && TodosPart.current}
        {@const Todos = TodosPart.current}
        {#key projectId}
        <Todos
          {projectId}
          store={notesStore}
          {chapters}
          onSaveError={reportSaveError}
          onShowNotes={() => (view = "notes")}
        />
        {/key}
      {:else if view === "outline" && OutlinePart.current}
        {@const Outline = OutlinePart.current}
        <Outline
          {chapters}
          title={writing?.title ?? ""}
          layout={prefs.outlineLayout}
          canAdd={writing?.split ?? false}
          onLayout={(layout) => (prefs = { ...prefs, outlineLayout: layout })}
          onUpdate={updateChapterMeta}
          onReorder={reorderChapters}
          onOpen={(id) => {
            view = "write";
            void selectChapter(id);
          }}
          onRename={renameChapter}
          onCreate={() => void addChapter()}
        />
      {:else if view === "book" && BookPart.current}
        {@const Book = BookPart.current}
        <Book
          {chapters}
          title={writing?.title ?? ""}
          onLaidOut={() => {
            if (!printWhenLaidOut) return;
            printWhenLaidOut = false;
            window.print();
          }}
          onOpenLink={(href) => void openLink(href)}
        />
      {/if}
    </div>
  {:else}
    <div class="alt home">
      {@render homeHeader()}
      <p class="opening">{t("opening")}</p>
    </div>
  {/if}
  {#if welcomeShown && WelcomePart.current}
    {@const Welcome = WelcomePart.current}
    <Welcome
      theme={prefs.theme}
      appearance={resolvedTheme(prefs.theme, new Date(clock))}
      onTheme={(theme) => (prefs = { ...prefs, theme })}
      onDone={() => (prefs = { ...prefs, welcomed: true })}
    />
  {/if}
  {#if tourShown}
    {@const place = tourShown}
    {#key place}
      <Tour steps={tourFor(place)} onDone={(stopAll) => tourDone(place, stopAll)} />
    {/key}
  {/if}
  {#if settingsOpen && writing && SettingsPart.current}
    {@const Settings = SettingsPart.current}
    <Settings
      appVersion={updates.appVersion}
      updateVersion={updates.found?.version ?? ""}
      updateCheck={updates.checking}
      updateCheckMessage={updates.checkMessage}
      onCheckUpdate={() => void updates.check(true)}
      onInstallUpdate={() => void updates.install()}
      {prefs}
      {backupMessage}
      onChange={(patch) => (prefs = { ...prefs, ...patch })}
      onChooseFolder={() => void driveBackup.pickFolder()}
      onBackup={() => void driveBackup.now()}
      projectLocation={session.path}
      projectLanguage={writing.language}
      bookGoal={writing.wordGoal}
      onBookGoal={setBookGoal}
      {dictionary}
      onMoveProject={() => void moveIntoLibrary()}
      libraryFolder={libraryRoot}
      onChooseLibraryFolder={() => void pickLibraryFolder()}
      insideLibrary={!!libraryRoot && isInside(session.path, libraryRoot)}
      split={writing.split}
      {writingWords}
      onSplit={(split) => void writingOps.setSplit(writing?.id ?? "", split)}
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
      {keptCount}
      onBringBackKept={() => void bringBackKept()}
      onRemoveKept={() => void removeKept()}
      bookTitle={writing.title}
      onAddExamples={() => void addExampleBooks()}
      examplesAdded={sampleNames.some((name) => name !== "long-test-book")}
      projectTitle={shelf?.title ?? ""}
      wordCopyName={wordCopy.fileName(writing)}
      onAddLongBook={() => void addLongBook()}
      longBookAdded={sampleNames.includes("long-test-book")}
      onChooseWordFolder={() => void wordCopy.pickFolder()}
      onUpdateWordCopy={() => {
        wordCopy.held = "";
        void wordCopy.update(true);
      }}
      onStopWordCopy={() => (prefs = { ...prefs, wordCopyFolder: "", wordCopyError: "" })}
      startSection={settingsSection}
      onClose={() => {
        settingsOpen = false;
        settingsReturn?.focus();
      }}
    />
  {/if}
  {#if versions.open && writing && HistoryPart.current}
    {@const History = HistoryPart.current}
    <History
      snapshots={versions.list}
      chosen={versions.snapshotId}
      preview={versions.preview}
      family={manuscriptFamily(prefs.manuscriptFont)}
      onPick={(id) => void versions.pick(id)}
      onRestoreChapter={() => void versions.restoreChapter()}
      onRestoreBook={() => void versions.restoreBook()}
      onClose={() => (versions.open = false)}
    />
  {/if}
  {#if newProjectAsk && NewProjectPart.current}
    {@const NewProjectWindow = NewProjectPart.current}
    <NewProjectWindow
      places={[{ path: libraryRoot, label: t("library") }, ...projectFolders(libraryEntries, locale())]}
      parent={newProjectAsk.parent}
      dropped={newProjectAsk.dropped}
      onChooseDocuments={() => chooseDocuments(true)}
      onCreate={async (request) => {
        const problem = await createProject(request);
        if (!problem) newProjectAsk = null;
        return problem;
      }}
      onClose={() => (newProjectAsk = null)}
    />
  {/if}
  {#if bringInAsk && writing && BringInPart.current}
    {@const BringInWindow = BringInPart.current}
    <BringInWindow
      mode={bringInAsk.mode}
      sources={bringInAsk.sources}
      project={shelf?.title ?? ""}
      writing={writing.title}
      onePage={!writing.split}
      onAdd={async (drafts) => {
        bringInAsk = null;
        await writingOps.addDrafts(drafts);
      }}
      onReplace={async (read, name) => {
        bringInAsk = null;
        await writingOps.bringBack(read, name);
      }}
      onClose={() => (bringInAsk = null)}
    />
  {/if}
  {#if searchAsk && SearchPart.current}
    {@const SearchWindow = SearchPart.current}
    <SearchWindow
      initial={searchAsk.query}
      openPath={session.path}
      load={readEveryProject}
      onOpen={(hit, query) => void openSearchHit(hit, query)}
      onClose={() => (searchAsk = null)}
    />
  {/if}
  {#if quickIdeaOpen && QuickIdeaPart.current}
    {@const QuickIdea = QuickIdeaPart.current}
    <QuickIdea project={shelf?.title ?? ""} onSave={addIdea} onClose={() => (quickIdeaOpen = false)} />
  {/if}
  {#if saveTrouble && SaveTroublePart.current}
    {@const SaveTrouble = SaveTroublePart.current}
    <SaveTrouble
      kept={saveTrouble.kept}
      message={saveTrouble.message}
      onClose={() => void closeAfterTrouble()}
      onStay={() => (saveTrouble = null)}
      onCopy={copyPlainText}
      onSaveWord={exportWord}
    />
  {:else if rescue.offer && RescueOfferPart.current}
    {@const RescueOffer = RescueOfferPart.current}
    {@const offer = rescue.offer}
    {@const saved = new Date(offer.backup.savedAt)}
    <RescueOffer
      beside={offer.beside}
      title={offer.backup.writings[0]?.title || t("untitled")}
      date={Number.isNaN(saved.getTime()) ? t("unknownDate") : saved.toLocaleString(locale())}
      onBringBack={() => bringBackRescue(offer)}
      onLater={() => rescue.later()}
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

  /* Home sits on the light chrome colour, as in the design; the darker desk is for the page and the cards. */
  .alt.home {
    display: flex;
    flex-direction: column;
    background: var(--pv-chrome);
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
    background: radial-gradient(closest-side, var(--pv-glow), color-mix(in srgb, var(--pv-glow) 36%, transparent) 55%, transparent);
  }

  @media print {
    :global(.titlebar),
    :global(.ribbon),
    :global(.sidebar),
    :global(.statusbar),
    :global(.panel),
    :global(.find-panel) {
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

    .leaf {
      display: none !important;
    }
  }

  /*
   * The scrollbar's room is always kept. Without it, a page as wide as the room left beside the panel
   * changed width each time the scrollbar was looked at again, twice a key, and the whole chapter was laid
   * out anew: a key took twice as long with a panel open on the laptop's screen (9 October).
   */
  .stage {
    position: relative;
    container-type: inline-size;
    overflow: auto;
    scrollbar-gutter: stable;
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
    grid-template-columns: minmax(0, 1fr) minmax(0, var(--sheet, var(--pv-sheet-book))) minmax(0, 1fr);
  }

  /* The cards keep their column: the page stays centred while there is room, then moves left. */
  .page-row.commented {
    grid-template-columns: minmax(0, 1fr) minmax(280px, var(--sheet, var(--pv-sheet-book))) minmax(240px, 1fr);
  }

  .page-row > :global(.rail) {
    grid-column: 3;
  }

  .sheet {
    grid-column: 2;
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0 auto;
  }

  .paper {
    position: relative;
    flex: 1;
    /* Narrower margins on a smaller page leave more of it for the text. */
    padding: var(--pv-sheet-pad-y) clamp(36px, 5cqi, var(--pv-sheet-pad-x));
    background-color: var(--pv-paper);
    background-image: var(--pv-vignette);
    box-shadow: var(--pv-shadow-sheet);
    color: var(--pv-ink);
  }

  /*
   * Zen is one plain page with only the text on it, as in Grammarly, on the look's still scene (owner, 13
   * October): dawn hills, the sunset sea, the candlelit room, the moonlit sea, the forest. The scene is its
   * own layer, painted once, so typing on the page above never paints it again; the page stays opaque, so
   * the text keeps its sharp edges.
   */
  .app.zen .writing {
    --zen-margin: 56px;
    background: var(--pv-desk);
  }

  .app.zen .writing::before {
    display: none;
  }

  .zen-scene {
    position: absolute;
    inset: 0;
    z-index: -1;
    background: var(--pv-desk) center bottom / cover no-repeat;
    pointer-events: none;
    will-change: transform;
  }

  :global(:root[data-theme="daylight"]) .zen-scene {
    background-image: url("/art/zen/zen-daylight.svg");
  }

  :global(:root[data-theme="dusk"]) .zen-scene {
    background-image: url("/art/zen/zen-sunset.svg");
  }

  :global(:root[data-theme="candlelit"]) .zen-scene {
    background-image: url("/art/zen/zen-candlelit.svg");
  }

  :global(:root[data-theme="moonlit"]) .zen-scene {
    background-image: url("/art/zen/zen-moonlit.svg");
  }

  :global(:root[data-theme="forest"]) .zen-scene {
    background-image: url("/art/zen/zen-forest.svg");
  }

  .app.zen .sheet .paper {
    padding: 64px var(--zen-margin) 160px;
    background-image: none;
  }

  :global(:root[data-grain="true"]) .paper {
    background-image: var(--pv-grain), var(--pv-vignette);
  }

  /* Pages: the text lies on sheets drawn behind it, a desk's width apart (see pagination.ts). */
  .page-row.paged .paper {
    background: none;
    box-shadow: none;
  }

  .leaf {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--leaf-h);
    background-color: var(--pv-paper);
    background-image: var(--pv-vignette);
    box-shadow: var(--pv-shadow-sheet);
  }

  :global(:root[data-grain="true"]) .leaf {
    background-image: var(--pv-grain), var(--pv-vignette);
  }

  /* The sheet's number, centred in its bottom margin. */
  .folio {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--leaf-margin) / 2 - 0.5lh);
    text-align: center;
    color: var(--pv-ink-meta);
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    font-size: var(--pv-text-sm);
  }

  .page-notes.on-sheet {
    position: absolute;
    left: var(--leaf-margin);
    right: var(--leaf-margin);
    margin: 0;
  }

  .float-wrap {
    position: absolute;
    left: 50%;
    bottom: 16px;
    z-index: 2;
    transform: translateX(-50%);
  }

  /* A tab on the desk's left edge, halfway down, while the chapter list is folded away. */
  .show-chapters {
    position: absolute;
    top: 50%;
    left: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 26px;
    height: 44px;
    border: 1px solid var(--pv-line);
    border-left: 0;
    border-radius: 0 var(--pv-radius-sm) var(--pv-radius-sm) 0;
    padding: 0;
    background: var(--pv-chrome);
    color: var(--pv-text-subtle);
    transform: translateY(-50%);
  }

  .show-chapters :global(svg) {
    width: 15px;
    height: 15px;
  }

  .show-chapters:hover {
    background: var(--pv-selected);
    color: var(--pv-text);
  }

  .show-chapters:active {
    background: var(--pv-pressed);
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

  .notice-undo {
    margin-left: 8px;
    border: 0;
    padding: 0;
    background: none;
    color: var(--pv-accent);
    font: inherit;
    font-weight: 600;
  }

  .notice-undo:hover {
    text-decoration: underline;
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
