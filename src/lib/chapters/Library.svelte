<script lang="ts">
  import type { Snippet } from "svelte";
  import type { WritingOutline } from "$lib/model";
  import type { NoteCategory } from "$lib/storage/organize";
  import { compactWords } from "$lib/editor/counts";
  import { collator, fileIcon, folderOf, isDocumentFile, isInside, parentFolder, projectFile, projectFiles, sameFolder, sortEntries, type LibraryActions, type LibraryEntry, type LibraryView } from "./library";
  import { answered, isOpen, setOpen } from "./treeState.svelte";
  import { LONG_PAGE_WORDS } from "./page";
  import TreeMenu, { type MenuItem } from "./TreeMenu.svelte";
  import { locale, plural, t } from "$lib/ui.svelte";
  import type { UiKey } from "$lib/i18n";
  import Icon from "$lib/editor/Icon.svelte";

  let {
    library,
    actions,
    chapterRows,
    createRequest = null,
    writingId,
    writingTitle,
    writingSplit,
    writingWords,
  }: {
    library: LibraryView;
    actions: LibraryActions;
    /** The open writing as it is now: its title and split as they change, and its words as she types. */
    writingId: string;
    writingTitle: string;
    writingSplit: boolean;
    writingWords: number;
    /** The open writing's chapters, drawn at the depth given; a one-page writing has none to draw. */
    chapterRows?: Snippet<[number]>;
    /** The header's "New writing" or "New folder", by the time it was asked. */
    createRequest?: { kind: "writing" | "folder"; at: number } | null;
  } = $props();

  type Kind =
    | "folder"
    | "project"
    | "wfolder"
    | "writing"
    | "chapters"
    | "part"
    | "chapter"
    | "notes"
    | "group"
    | "note"
    | "todos"
    | "deleted"
    | "elsewhere"
    | "files"
    | "pfolder"
    | "file"
    | "input";

  /** One line of the tree. */
  type Row = {
    key: string;
    depth: number;
    kind: Kind;
    name: string;
    icon: string;
    expandable: boolean;
    open: boolean;
    current?: boolean;
    /** Words, or a count of notes or to-dos, shown at the right. */
    words?: number;
    count?: number;
    /** Words counted as she types, drawn apart so the rows aren't made again at every word: the open writing's, or its project's. */
    live?: "writing" | "project";
    /** A library folder's path, or a project's file. */
    path?: string;
    /** A writing's, chapter's or note's id. */
    id?: string;
    writingId?: string;
    number?: number;
    deleted?: boolean;
    category?: NoteCategory;
    split?: boolean;
    folder?: string;
    /** A library folder with no folders or projects in it, so it can be deleted. */
    empty?: boolean;
    /** How many levels of folders and projects a library folder holds below itself, as listed. */
    below?: number;
  };

  /** A name being typed in the tree: for something new, or for a new name. */
  type Editing = {
    mode: "new" | "rename";
    what: "project" | "libraryFolder" | "writing" | "writingFolder" | "note";
    /** The row it opens under (new) or replaces (rename). */
    key: string;
    /** For something new: the library folder or writing folder it goes in. For a rename: what is renamed. */
    target: string;
    /** A renamed folder's or project's name as it was, so keeping it changes nothing. */
    name?: string;
    category?: NoteCategory;
    value: string;
    error: string;
  };

  const GROUPS: { id: NoteCategory; key: UiKey; icon: string }[] = [
    { id: "characters", key: "groupCharacters", icon: "users" },
    { id: "places", key: "groupPlaces", icon: "mapPin" },
    { id: "research", key: "groupResearch", icon: "search" },
    { id: "ideas", key: "groupIdeas", icon: "lightbulb" },
  ];

  /** How many folders deep the library is listed (DEPTH in library.rs). */
  const LISTED_DEPTH = 6;
  /** Whether a library folder holds a project, at any depth. */
  const holdsProjects = (entry: LibraryEntry): boolean => entry.children.some((child) => child.project || (!child.file && holdsProjects(child)));
  /** How many levels of folders and projects an entry holds below itself, as listed: 0 for none. */
  const levelsIn = (entry: LibraryEntry): number =>
    entry.project || entry.file ? 0 : Math.max(0, ...entry.children.filter((child) => !child.file).map((child) => 1 + levelsIn(child)));

  let editing = $state<Editing | null>(null);
  let committing = false;
  let menu = $state<{ x: number; y: number; items: MenuItem[]; back: HTMLElement | null } | null>(null);
  let tree = $state<HTMLDivElement | undefined>(undefined);
  // The row being dragged, and where it would land: a row's key, or "root" for the library's top.
  let dragged = $state<Row | null>(null);
  let dropKey = $state<string | null>(null);

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const insideLibrary = (path: string) => !!library.root && isInside(path, library.root);
  const currentFile = $derived(library.currentPath);
  const openProjectRow = $derived(`project:${currentFile.toLowerCase()}`);
  // Sorted once for each new listing, not again for every change in the rows.
  const listing = $derived(library.entries);
  const entries = $derived(sortEntries(listing, locale()));
  const listed = $derived(new Set(projectFiles(library.entries).map((file) => file.toLowerCase())));
  // The open project's folder as listed, for its own files and folders.
  const openEntry = $derived.by(() => {
    const find = (list: LibraryEntry[]): LibraryEntry | null => {
      for (const entry of list) {
        if (entry.project && same(projectFile(entry.path), currentFile)) return entry;
        const inside = !entry.project && !entry.file ? find(entry.children) : null;
        if (inside) return inside;
      }
      return null;
    };
    return find(entries);
  });
  // The file last clicked: one click picks it, a double click (or Enter) opens it.
  let pickedFile = $state("");
  // The open project's words apart from the open writing's, which are added as she types.
  const otherWords = $derived(
    (library.shelf?.writings ?? [])
      .filter((item) => !item.deletedAt && item.id !== writingId)
      .reduce((sum, item) => sum + item.chapters.reduce((total, chapter) => total + chapter.words, 0), 0),
  );

  // A name to type for something new, asked for by the header, once.
  $effect(() => {
    const asked = createRequest;
    if (!asked || asked.at <= answered.header) return;
    answered.header = asked.at;
    if (asked.kind === "folder") startNew("libraryFolder", "root", library.root);
    else startNew("writing", openProjectRow, "");
  });

  const rows = $derived.by(() => {
    const list: Row[] = [];
    const known = library.known;
    const shelf = library.shelf;
    const order = collator(locale());

    const pushInput = (key: string, depth: number) => {
      const edit = editing;
      if (!edit || edit.mode !== "new" || edit.key !== key) return;
      const icon = edit.what === "writing" ? "book" : edit.what === "note" ? "notes" : edit.what === "writingFolder" ? "layers" : "folder";
      list.push({ key: `input:${key}`, depth, kind: "input", name: "", icon, expandable: false, open: false });
    };
    const renamed = (key: string, depth: number, icon: string): boolean => {
      const edit = editing;
      if (!edit || edit.mode !== "rename" || edit.key !== key) return false;
      list.push({ key: `input:${key}`, depth, kind: "input", name: "", icon, expandable: false, open: false });
      return true;
    };

    const pushOutline = (outline: WritingOutline, depth: number) => {
      // Chapters in the part they are read in: the last one begun before them, as in Word.
      let lastPart = "";
      let group = "";
      let groupOpen = true;
      const ordered = [...outline.chapters].sort((a, b) => a.position - b.position);
      ordered.forEach((chapter, index) => {
        const part = chapter.part.trim();
        if (part && part !== lastPart) {
          const key = `part:${outline.id}:${index}:${part}`;
          groupOpen = isOpen(key, false);
          list.push({ key, depth, kind: "part", name: part, icon: "bookmark", expandable: true, open: groupOpen });
        }
        lastPart = part;
        if (part) group = part;
        if (group && !groupOpen) return;
        list.push({
          key: `oc:${chapter.id}`,
          depth: depth + (group ? 1 : 0),
          kind: "chapter",
          name: chapter.title,
          icon: "",
          expandable: false,
          open: false,
          id: chapter.id,
          writingId: outline.id,
          number: index + 1,
          words: chapter.words,
        });
      });
    };

    const pushWriting = (outline: WritingOutline, depth: number, deleted = false) => {
      const current = outline.id === writingId;
      const title = current ? writingTitle : outline.title;
      const split = current ? writingSplit : outline.split;
      const key = `writing:${outline.id}`;
      const icon = !split ? "fileText" : current ? "bookOpen" : "book";
      if (renamed(key, depth, icon)) return;
      const unfolds = !deleted && split && (current || outline.chapters.length > 0);
      const open = unfolds && isOpen(key, current);
      list.push({
        key,
        depth,
        kind: "writing",
        name: title,
        icon,
        expandable: unfolds,
        open,
        current,
        id: outline.id,
        path: currentFile,
        words: current ? undefined : outline.chapters.reduce((sum, chapter) => sum + chapter.words, 0),
        live: current ? "writing" : undefined,
        deleted,
        split,
        folder: outline.folder,
      });
      if (!open) return;
      if (current) list.push({ key: `chapters:${outline.id}`, depth: depth + 1, kind: "chapters", name: "", icon: "", expandable: false, open: false });
      else pushOutline(outline, depth + 1);
    };

    const pushShelf = (depth: number) => {
      if (!shelf) return;
      pushInput(openProjectRow, depth);
      const live = shelf.writings.filter((item) => !item.deletedAt);
      for (const folder of shelf.folders) {
        const key = `wf:${folder}`;
        if (renamed(key, depth, "layers")) continue;
        const inside = live.filter((item) => item.folder === folder);
        const open = isOpen(key, inside.some((item) => item.id === writingId));
        list.push({ key, depth, kind: "wfolder", name: folder, icon: "layers", expandable: true, open, count: inside.length, folder });
        if (!open) continue;
        pushInput(key, depth + 1);
        for (const item of inside) pushWriting(item, depth + 1);
      }
      for (const item of live.filter((entry) => !entry.folder || !shelf.folders.includes(entry.folder))) pushWriting(item, depth);

      const notesOpen = isOpen("notes", false);
      list.push({ key: "notes", depth, kind: "notes", name: t("notes"), icon: "notebook", expandable: true, open: notesOpen, count: library.notes.length });
      if (notesOpen) {
        pushInput("notes", depth + 1);
        for (const group of GROUPS) {
          const key = `group:${group.id}`;
          const inGroup = library.notes.filter((note) => note.category === group.id).sort((a, b) => order.compare(a.title, b.title));
          const open = isOpen(key, false);
          list.push({ key, depth: depth + 1, kind: "group", name: t(group.key), icon: group.icon, expandable: inGroup.length > 0, open, count: inGroup.length, category: group.id });
          pushInput(key, depth + 2);
          if (!open) continue;
          for (const note of inGroup) {
            const noteKey = `note:${note.id}`;
            if (renamed(noteKey, depth + 2, "notes")) continue;
            list.push({ key: noteKey, depth: depth + 2, kind: "note", name: note.title, icon: "notes", expandable: false, open: false, id: note.id, category: note.category });
          }
        }
      }
      list.push({ key: "todos", depth, kind: "todos", name: t("todos"), icon: "todos", expandable: false, open: false, count: library.openTodos });

      // Her own files and folders in the project's folder, as Explorer would show them.
      const own = openEntry?.children ?? [];
      if (openEntry && own.length > 0) {
        const open = isOpen("files", false);
        list.push({ key: "files", depth, kind: "files", name: t("files"), icon: open ? "folderOpen" : "folder", expandable: true, open, count: own.length, path: openEntry.path });
        if (open) pushFiles(own, depth + 1);
      }

      const deleted = shelf.writings.filter((item) => item.deletedAt);
      if (deleted.length > 0) {
        const open = isOpen("deleted", false);
        list.push({ key: "deleted", depth, kind: "deleted", name: t("deletedFolder"), icon: "trash", expandable: true, open, count: deleted.length });
        if (open) for (const item of deleted) pushWriting(item, depth + 1, true);
      }
    };

    const pushFile = (file: LibraryEntry, depth: number) => {
      list.push({ key: `file:${file.path.toLowerCase()}`, depth, kind: "file", name: file.name, icon: fileIcon(file.name), expandable: false, open: false, path: file.path });
    };

    /** A project's own folders (folded until opened) and files. */
    const pushFiles = (inside: LibraryEntry[], depth: number) => {
      for (const folder of inside.filter((entry) => !entry.file)) {
        const key = `pdir:${folder.path.toLowerCase()}`;
        const open = folder.children.length > 0 && isOpen(key, false);
        list.push({ key, depth, kind: "pfolder", name: folder.name, icon: open ? "folderOpen" : "folder", expandable: folder.children.length > 0, open, path: folder.path });
        if (open) pushFiles(folder.children, depth + 1);
      }
      for (const file of inside.filter((entry) => entry.file)) pushFile(file, depth);
    };

    const pushProject = (file: string, name: string, depth: number) => {
      const key = `project:${file.toLowerCase()}`;
      if (same(file, currentFile) && shelf) {
        const open = isOpen(key, true);
        if (!renamed(key, depth, "library")) {
          list.push({ key, depth, kind: "project", name: name || shelf.title, icon: "library", expandable: true, open, current: true, path: file, live: "project" });
        }
        if (open) pushShelf(depth + 1);
        return;
      }
      const summary = known.find((item) => same(item.path, file))?.summary;
      const writings = summary?.writings ?? [];
      const open = writings.length > 0 && isOpen(key, false);
      if (!renamed(key, depth, "library")) {
        list.push({ key, depth, kind: "project", name, icon: "library", expandable: writings.length > 0, open, path: file, words: summary?.words });
      }
      if (!open) return;
      for (const item of writings) {
        list.push({
          key: `cw:${file.toLowerCase()}:${item.id}`,
          depth: depth + 1,
          kind: "writing",
          name: item.title,
          icon: item.split ? "book" : "fileText",
          expandable: false,
          open: false,
          id: item.id,
          path: file,
          words: item.words,
          split: item.split,
        });
      }
    };

    const walk = (entries: LibraryEntry[], depth: number) => {
      for (const folder of entries.filter((entry) => !entry.project && !entry.file)) {
        const key = `dir:${folder.path.toLowerCase()}`;
        // The library's own folders of projects start unfolded; a folder inside one starts folded, as
        // everything unfolded does (owner, 8 October), unless the project on the page is in it.
        const open = isOpen(key, (depth === 0 && holdsProjects(folder)) || (!!currentFile && isInside(currentFile, folder.path)));
        if (!renamed(key, depth, open ? "folderOpen" : "folder")) {
          list.push({ key, depth, kind: "folder", name: folder.name, icon: open ? "folderOpen" : "folder", expandable: true, open, path: folder.path, empty: folder.children.length === 0, below: levelsIn(folder) });
        }
        if (!open) continue;
        pushInput(key, depth + 1);
        walk(folder.children, depth + 1);
      }
      for (const project of entries.filter((entry) => entry.project)) pushProject(projectFile(project.path), project.name, depth);
      for (const file of entries.filter((entry) => entry.file)) pushFile(file, depth);
    };

    pushInput("root", 0);
    walk(entries, 0);

    // Projects kept outside the library: opened from elsewhere, or from before the library. The open
    // project is always somewhere: here, when the library's listing doesn't have it (yet).
    const inLibrary = (file: string) => !!library.root && isInside(file, library.root);
    const elsewhere = known.filter((item) => !inLibrary(item.path));
    if (currentFile && !listed.has(currentFile.toLowerCase()) && !elsewhere.some((item) => same(item.path, currentFile))) {
      elsewhere.unshift({ path: currentFile, title: shelf?.title ?? "" });
    }
    if (elsewhere.length > 0) {
      const open = isOpen("elsewhere", true);
      list.push({ key: "elsewhere", depth: 0, kind: "elsewhere", name: t("elsewhere"), icon: open ? "folderOpen" : "folder", expandable: true, open });
      if (open) for (const item of elsewhere) pushProject(item.path, item.title || shelf?.title || "", 1);
    }
    return list;
  });

  function toggle(row: Row) {
    if (row.expandable) setOpen(row.key, !row.open);
  }

  function activate(row: Row, element: HTMLElement) {
    if (row.kind === "file") {
      pickedFile = row.key;
    } else if (row.kind === "folder" || row.kind === "wfolder" || row.kind === "notes" || row.kind === "group" || row.kind === "deleted" || row.kind === "elsewhere" || row.kind === "part" || row.kind === "files" || row.kind === "pfolder") {
      toggle(row);
    } else if (row.kind === "project") {
      if (row.current) toggle(row);
      else if (row.path) actions.openProject(row.path);
    } else if (row.kind === "writing") {
      if (row.deleted) openMenu(row, element);
      else if (row.current) toggle(row);
      else if (row.path && row.id) actions.openWriting(row.path, row.id);
    } else if (row.kind === "chapter") {
      if (row.writingId && row.id) actions.openWriting(currentFile, row.writingId, row.id);
    } else if (row.kind === "note") {
      if (row.id) actions.openNote(row.id);
    } else if (row.kind === "todos") {
      actions.openTodos();
    }
  }

  function startNew(what: Editing["what"], key: string, target: string, category?: NoteCategory) {
    // Something new in the open project: the rows down to it unfold, so its name can be typed where it will be.
    if (what === "writing" || what === "writingFolder" || what === "note") revealOpenProject();
    if (key !== "root") setOpen(key, true);
    if (what === "note") setOpen("notes", true);
    editing = { mode: "new", what, key, target, category, value: "", error: "" };
  }

  /** Unfolds the library folders that hold the open project, and the project itself. */
  function revealOpenProject() {
    const walk = (entries: LibraryEntry[]) => {
      for (const entry of entries) {
        if (entry.project || !isInside(currentFile, entry.path)) continue;
        setOpen(`dir:${entry.path.toLowerCase()}`, true);
        walk(entry.children);
      }
    };
    walk(library.entries);
    setOpen("elsewhere", true);
    setOpen(openProjectRow, true);
  }

  function startRename(row: Row) {
    if (row.kind === "writing" && row.id && !row.deleted && same(row.path ?? "", currentFile)) {
      editing = { mode: "rename", what: "writing", key: row.key, target: row.id, value: row.name, error: "" };
    } else if (row.kind === "wfolder" && row.folder) {
      editing = { mode: "rename", what: "writingFolder", key: row.key, target: row.folder, value: row.name, error: "" };
    } else if (row.kind === "note" && row.id) {
      editing = { mode: "rename", what: "note", key: row.key, target: row.id, value: row.name, error: "" };
    } else if (row.kind === "folder" && row.path) {
      editing = { mode: "rename", what: "libraryFolder", key: row.key, target: row.path, name: row.name, value: row.name, error: "" };
    } else if (row.kind === "project" && row.path && insideLibrary(row.path)) {
      // A project is renamed as its folder is: the name Explorer shows.
      editing = { mode: "rename", what: "project", key: row.key, target: folderOf(row.path).path, name: row.name, value: row.name, error: "" };
    }
  }

  async function commit() {
    const edit = editing;
    if (!edit || committing) return;
    const value = edit.value.trim();
    const unchanged = edit.mode === "rename" && (edit.name !== undefined ? value === edit.name : value === edit.target && edit.what !== "writing");
    if (!value || unchanged) {
      editing = null;
      return;
    }
    committing = true;
    try {
      let problem: string | null = null;
      if (edit.mode === "new") {
        if (edit.what === "libraryFolder") problem = await actions.newLibraryFolder(edit.target, value);
        else if (edit.what === "writing") problem = await actions.newWriting(edit.target, value);
        else if (edit.what === "writingFolder") problem = await actions.newWritingFolder(value);
        else if (edit.what === "note" && edit.category) actions.newNote(edit.category, value);
      } else if (edit.what === "writing") actions.renameWriting(edit.target, value);
      else if (edit.what === "writingFolder") problem = await actions.renameWritingFolder(edit.target, value);
      else if (edit.what === "note") actions.renameNote(edit.target, value);
      else if (edit.what === "project" || edit.what === "libraryFolder") problem = await actions.renameLibraryEntry(edit.target, value);
      // Only the name this was for: a new writing takes a moment to open, and a name she began typing
      // meanwhile (a new folder, say) stays open.
      if (editing === edit) editing = problem ? { ...edit, error: problem } : null;
    } finally {
      committing = false;
    }
  }

  function onInputKey(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      editing = null;
    }
  }

  /** The new name's field takes the keyboard, with what is there selected, as Explorer does. */
  function takeKeyboard(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  /** Asks before something that can't simply be put back. */
  function confirm(back: HTMLElement | null, at: { x: number; y: number }, question: string, label: string, run: () => void) {
    menu = {
      ...at,
      back,
      items: [{ text: question }, "rule", { label, danger: true, run }, { label: t("cancel"), run: () => undefined }],
    };
  }

  function menuFor(row: Row, back: HTMLElement | null, at: { x: number; y: number }): MenuItem[] {
    const shelf = library.shelf;
    const reveal = (path: string): MenuItem => ({ label: t("showInExplorer"), run: () => actions.showInExplorer(path) });
    if (row.kind === "file" && row.path) {
      const path = row.path;
      const items: MenuItem[] = [{ label: t("openItem"), run: () => actions.openFile(path) }, reveal(path)];
      if (isDocumentFile(row.name)) items.push("rule", { label: t("importAsWriting"), run: () => actions.importAsWriting(path) });
      return items;
    }
    if ((row.kind === "files" || row.kind === "pfolder") && row.path) return [reveal(row.path)];
    if (row.kind === "folder" && row.path) {
      const path = row.path;
      const items: MenuItem[] = [];
      // The library is read six folders deep; something made deeper than that wouldn't show.
      if (row.depth < LISTED_DEPTH - 1) {
        items.push(
          { label: t("newProjectTitle"), run: () => actions.startProject(path) },
          { label: t("newFolderTitle"), run: () => startNew("libraryFolder", row.key, path) },
          "rule",
        );
      }
      // Only an empty folder goes; Windows keeps one with anything in it.
      items.push(
        { label: t("rename"), keys: "F2", run: () => startRename(row) },
        { label: t("deleteFolder"), keys: "Del", disabled: !row.empty, run: () => actions.deleteLibraryFolder(path) },
        "rule",
        reveal(path),
      );
      return items;
    }
    if (row.kind === "project") {
      const rename: MenuItem[] = ["rule"];
      if (row.path && insideLibrary(row.path)) rename.push({ label: t("rename"), keys: "F2", run: () => startRename(row) });
      // Explorer opens on the project's folder, its file picked.
      if (row.path) rename.push(reveal(row.path));
      if (!row.current || !shelf) return [{ label: t("openItem"), run: () => row.path && actions.openProject(row.path) }, ...rename];
      const items: MenuItem[] = [
        { label: t("newWritingTitle"), run: () => startNew("writing", row.key, "") },
        { label: t("newFolderTitle"), run: () => startNew("writingFolder", row.key, "") },
        { label: t("newNoteTitle"), run: () => startNew("note", "group:ideas", "", "ideas") },
        ...rename,
      ];
      if (library.root && !isInside(currentFile, library.root)) items.push("rule", { label: t("moveIntoLibrary"), run: () => actions.moveIntoLibrary() });
      return items;
    }
    if (row.kind === "wfolder" && row.folder) {
      const folder = row.folder;
      return [
        { label: t("newWritingTitle"), run: () => startNew("writing", row.key, folder) },
        "rule",
        { label: t("rename"), keys: "F2", run: () => startRename(row) },
        { label: t("deleteFolder"), run: () => actions.deleteWritingFolder(folder) },
      ];
    }
    if (row.kind === "writing" && row.id) {
      const id = row.id;
      if (!same(row.path ?? "", currentFile)) return [{ label: t("openItem"), run: () => row.path && actions.openWriting(row.path, id) }];
      if (row.deleted) {
        return [
          { label: t("putBack"), run: () => actions.putBack(id) },
          {
            label: t("deleteForGood"),
            danger: true,
            run: () => confirm(back, at, t("deleteForGoodQuestion", { title: row.name }), t("deleteForGood"), () => actions.eraseWriting(id)),
          },
        ];
      }
      const items: MenuItem[] = [
        { label: t("openItem"), run: () => actions.openWriting(currentFile, id) },
        { label: t("rename"), keys: "F2", run: () => startRename(row) },
        { label: t("duplicate"), run: () => actions.duplicateWriting(id) },
        {
          label: t("splitChapters"),
          checked: !!row.split,
          run: () => {
            if (!row.split) return actions.setSplit(id, true);
            const words = row.live ? writingWords : (row.words ?? 0);
            const question = t("joinQuestion") + (words > LONG_PAGE_WORDS ? ` ${t("joinLong", { words: plural("hasWords", words) })}` : "");
            confirm(back, at, question, t("join"), () => actions.setSplit(id, false));
          },
        },
      ];
      const folders = (shelf?.folders ?? []).filter((name) => name !== row.folder);
      if (folders.length > 0 || row.folder) items.push("rule");
      for (const name of folders) items.push({ label: t("moveTo", { name }), run: () => actions.moveWriting(id, name) });
      if (row.folder) items.push({ label: t("moveOutOfFolder"), run: () => actions.moveWriting(id, "") });
      items.push("rule", { label: t("delete"), keys: "Del", danger: true, run: () => actions.deleteWriting(id) });
      return items;
    }
    if (row.kind === "notes") return [{ label: t("newNoteTitle"), run: () => startNew("note", "group:ideas", "", "ideas") }];
    if (row.kind === "group" && row.category) {
      const category = row.category;
      return [{ label: t("newNoteTitle"), run: () => startNew("note", row.key, "", category) }];
    }
    if (row.kind === "note" && row.id) {
      const id = row.id;
      const items: MenuItem[] = [
        { label: t("openItem"), run: () => actions.openNote(id) },
        { label: t("rename"), keys: "F2", run: () => startRename(row) },
        { label: t("duplicate"), run: () => actions.duplicateNote(id) },
        "rule",
      ];
      for (const group of GROUPS.filter((item) => item.id !== row.category)) {
        items.push({ label: t("moveTo", { name: t(group.key) }), run: () => actions.moveNote(id, group.id) });
      }
      items.push("rule", {
        label: t("delete"),
        keys: "Del",
        danger: true,
        run: () => confirm(back, at, t("deleteNoteQuestion", { title: row.name }), t("delete"), () => actions.deleteNote(id)),
      });
      return items;
    }
    if (row.kind === "todos") return [{ label: t("openItem"), run: () => actions.openTodos() }];
    if (row.kind === "chapter" && row.id && row.writingId) {
      const writingId = row.writingId;
      const id = row.id;
      return [{ label: t("openItem"), run: () => actions.openWriting(currentFile, writingId, id) }];
    }
    return [];
  }

  function openMenu(row: Row, element: HTMLElement, event?: MouseEvent) {
    const box = element.getBoundingClientRect();
    const at = event ? { x: event.clientX, y: event.clientY } : { x: box.left + 24, y: box.bottom };
    const items = menuFor(row, element, at);
    if (items.length > 0) menu = { ...at, items, back: element };
  }

  /** Rows that can be dragged: library folders and projects, the open project's writings, and notes. */
  function canDrag(row: Row): boolean {
    if (row.kind === "folder") return !!row.path;
    if (row.kind === "project") return !!row.path && insideLibrary(row.path);
    if (row.kind === "writing") return !!row.id && !row.deleted && same(row.path ?? "", currentFile);
    return row.kind === "note" && !!row.id;
  }

  /**
   * What dropping the dragged row on `row` does, or null when it can't go there. A folder or a project goes
   * into a library folder (`row` null: the library's top); a writing into a writing folder, out of one onto
   * its project, or just before another writing; a note into another group.
   */
  function dropOn(row: Row | null): (() => void) | null {
    const item = dragged;
    if (!item) return null;
    if (item.kind === "folder" || item.kind === "project") {
      const from = item.kind === "project" ? folderOf(item.path ?? "").path : (item.path ?? "");
      const into = row === null ? library.root : row.kind === "folder" ? (row.path ?? "") : "";
      if (!from || !into || isInside(into, from) || sameFolder(parentFolder(from), into)) return null;
      // The library is read six folders deep, as the folder menu knows: nothing may land deeper, or it wouldn't show.
      if ((row === null ? 0 : row.depth + 1) + (item.below ?? 0) > LISTED_DEPTH - 1) return null;
      return () => actions.moveLibraryEntry(from, into);
    }
    if (item.kind === "writing" && item.id && row) {
      const id = item.id;
      if (row.kind === "wfolder" && row.folder && row.folder !== item.folder) {
        const folder = row.folder;
        return () => actions.moveWriting(id, folder);
      }
      if (row.kind === "project" && row.current && item.folder) return () => actions.moveWriting(id, "");
      if (row.kind === "writing" && row.id && row.id !== id && !row.deleted && same(row.path ?? "", currentFile)) {
        const before = row.id;
        return () => actions.placeWriting(id, before);
      }
      return null;
    }
    if (item.kind === "note" && item.id && row?.kind === "group" && row.category && row.category !== item.category) {
      const id = item.id;
      const category = row.category;
      return () => actions.moveNote(id, category);
    }
    return null;
  }

  function endDrag() {
    dragged = null;
    dropKey = null;
  }

  /** Over a row: it shows where the dragged row would land, when it can. */
  function dragOver(event: DragEvent, row: Row | null) {
    if (!dropOn(row)) return;
    event.preventDefault();
    event.stopPropagation();
    dropKey = row?.key ?? "root";
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function drop(event: DragEvent, row: Row | null) {
    const run = dropOn(row);
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    endDrag();
    run();
  }

  /** The library's own empty space: below the rows, or its "empty library" line; never anything inside a row. */
  function onEmptySpace(event: Event): boolean {
    const target = event.target;
    return !!tree && (target === tree || (target instanceof HTMLElement && target.parentElement === tree && target.classList.contains("empty")));
  }

  function rowOf(element: Element | null): Row | undefined {
    const key = element instanceof HTMLElement ? element.dataset.key : undefined;
    return key ? rows.find((row) => row.key === key) : undefined;
  }

  /**
   * The keyboard moves through the rows as in a file explorer: up and down, Home and End, right to unfold
   * a row and left to fold it; F2 renames, Delete deletes, and the menu key or Shift+F10 opens the menu.
   */
  function onKeydown(event: KeyboardEvent) {
    const button = event.target instanceof HTMLButtonElement ? event.target : null;
    const all = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button.tree-row")];
    const index = button ? all.indexOf(button) : -1;
    if (!button || index < 0) return;
    const row = rowOf(button);
    if (row && (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) {
      event.preventDefault();
      openMenu(row, button);
      return;
    }
    if (row && event.key === "F2") {
      event.preventDefault();
      startRename(row);
      return;
    }
    if (row?.kind === "file" && row.path && event.key === "Enter") {
      event.preventDefault();
      actions.openFile(row.path);
      return;
    }
    if (row && event.key === "Delete") {
      if (row.kind === "writing" && row.id && !row.deleted && same(row.path ?? "", currentFile)) {
        event.preventDefault();
        actions.deleteWriting(row.id);
      } else if (row.kind === "note" && row.id) {
        event.preventDefault();
        const box = button.getBoundingClientRect();
        const id = row.id;
        confirm(button, { x: box.left + 24, y: box.bottom }, t("deleteNoteQuestion", { title: row.name }), t("delete"), () => actions.deleteNote(id));
      } else if (row.kind === "folder" && row.path) {
        // An empty folder goes; one with anything in it stays, and the page says why.
        event.preventDefault();
        actions.deleteLibraryFolder(row.path);
      }
      return;
    }
    const expanded = button.getAttribute("aria-expanded");
    if ((event.key === "ArrowRight" && expanded === "false") || (event.key === "ArrowLeft" && expanded === "true")) {
      event.preventDefault();
      // Unfolding a closed project shows its writings; only a click opens it. A part of the open writing folds by its own click.
      if (row?.expandable) toggle(row);
      else button.click();
      return;
    }
    const next =
      event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? all.length - 1 : -2;
    if (next === -2) return;
    event.preventDefault();
    all[Math.max(0, Math.min(all.length - 1, next))].focus();
  }
</script>

<!-- The library, drawn as a file explorer: its folders and projects, the open project's writings, notes and to-dos. -->
<!-- The empty space below the rows is the library's top: a folder or project dropped there goes to it. -->
<div
  class="library tree-list"
  class:drop-root={dropKey === "root"}
  role="presentation"
  bind:this={tree}
  onkeydown={onKeydown}
  ondragover={(event) => {
    if (onEmptySpace(event)) dragOver(event, null);
    else if (dropKey === "root") dropKey = null;
  }}
  ondragleave={(event) => {
    // Out of the tree, the library's top no longer shows as where the row would land.
    const to = event.relatedTarget;
    if (dropKey === "root" && !(to instanceof Node && event.currentTarget.contains(to))) dropKey = null;
  }}
  ondrop={(event) => {
    if (onEmptySpace(event)) drop(event, null);
  }}
  oncontextmenu={(event) => {
    // Right-click below the rows: something new at the library's top, as in Explorer.
    if (!onEmptySpace(event) || !library.root) return;
    event.preventDefault();
    const root = library.root;
    menu = {
      x: event.clientX,
      y: event.clientY,
      back: null,
      items: [
        { label: t("newProjectTitle"), run: () => actions.startProject(root) },
        { label: t("newFolderTitle"), run: () => startNew("libraryFolder", "root", root) },
      ],
    };
  }}
>
  {#each rows as row (row.key)}
    {#if row.kind === "chapters"}
      {@render chapterRows?.(row.depth)}
    {:else if row.kind === "input" && editing}
      <div class="tree-input" style:--depth={row.depth}>
        <span class="twist" aria-hidden="true"></span>
        <span class="tree-icon" aria-hidden="true"><Icon name={row.icon} /></span>
        <input
          bind:value={editing.value}
          use:takeKeyboard
          aria-label={editing.mode === "rename" ? t("rename") : t(editing.what === "writing" ? "newWritingTitle" : editing.what === "note" ? "newNoteTitle" : "newFolderTitle")}
          aria-invalid={!!editing.error}
          onkeydown={onInputKey}
          onblur={() => void commit()}
        />
      </div>
      {#if editing.error}
        <p class="problem" role="alert" style:--depth={row.depth}>{editing.error}</p>
      {/if}
    {:else if row.kind === "notes" || row.kind === "group"}
      <!-- Notes and each of its groups have a + for a new note there (owner, 8 October). -->
      <div class="with-add">
        {@render rowButton(row)}
        <button
          type="button"
          class="row-add"
          title={t("newNoteTitle")}
          aria-label={row.kind === "group" ? t("newNoteIn", { group: row.name }) : t("newNoteTitle")}
          onclick={() => startNew("note", row.kind === "group" ? row.key : "group:ideas", "", row.category ?? "ideas")}
        >
          <Icon name="plus" />
        </button>
      </div>
    {:else if row.kind === "writing" && row.current && row.split && !row.deleted && chapterRows}
      <!-- The open book has a + for a new chapter at its end, as the notes have (owner, 9 October). -->
      <div class="with-add">
        {@render rowButton(row)}
        <button
          type="button"
          class="row-add"
          title={t("newChapterTitle")}
          aria-label={t("newChapterTitle")}
          onclick={() => {
            setOpen(row.key, true);
            actions.newChapter();
          }}
        >
          <Icon name="plus" />
        </button>
      </div>
    {:else}
      {@render rowButton(row)}
    {/if}
  {:else}
    <p class="empty">{t("emptyLibrary")}</p>
  {/each}
</div>

{#snippet rowButton(row: Row)}
      <button
        type="button"
        class="tree-row {row.kind}"
        class:current={row.current}
        class:gone={row.deleted}
        class:picked={row.kind === "file" && pickedFile === row.key}
        class:drop-target={dropKey === row.key && !(dragged?.kind === "writing" && row.kind === "writing")}
        class:drop-before={dropKey === row.key && dragged?.kind === "writing" && row.kind === "writing"}
        data-key={row.key}
        style:--depth={row.depth}
        aria-expanded={row.expandable ? row.open : undefined}
        title={row.kind === "file" ? `${row.name}\n${t("openFileHint")}` : row.path && (row.kind === "folder" || row.kind === "project") ? row.path : row.name}
        draggable={canDrag(row) ? "true" : undefined}
        onclick={(event) => activate(row, event.currentTarget)}
        ondblclick={() => {
          // A file opens in its own program, as in Explorer.
          if (row.kind === "file") {
            if (row.path) actions.openFile(row.path);
            return;
          }
          // A double click on another writing is two clicks that open it; renaming is for the one open. A
          // folder or a project opens and closes with each click, as in Explorer; F2 or its menu renames it.
          if ((row.kind === "writing" && !row.current) || row.kind === "folder" || row.kind === "project" || row.kind === "files" || row.kind === "pfolder") return;
          startRename(row);
        }}
        ondragstart={(event) => {
          dragged = row;
          // No text on the drag: the page, or a name field, would type it in wherever she lets go.
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        }}
        ondragover={(event) => dragOver(event, row)}
        ondragleave={() => {
          if (dropKey === row.key) dropKey = null;
        }}
        ondrop={(event) => drop(event, row)}
        ondragend={endDrag}
        oncontextmenu={(event) => {
          event.preventDefault();
          openMenu(row, event.currentTarget, event);
        }}
      >
        <span class="twist" class:open={row.open} aria-hidden="true">{#if row.expandable}<Icon name="chevronRight" />{/if}</span>
        {#if row.kind === "chapter"}
          <span class="num">{row.number}</span>
        {:else}
          <span class="tree-icon" aria-hidden="true"><Icon name={row.icon} /></span>
        {/if}
        <span class="name">{row.name}</span>
        {#if row.live}
          <span class="words">{compactWords(row.live === "writing" ? writingWords : otherWords + writingWords)}</span>
        {:else if row.words !== undefined}
          <span class="words">{compactWords(row.words)}</span>
        {:else if row.count}
          <span class="words">{row.count}</span>
        {/if}
      </button>
{/snippet}
{#if menu}
  <!-- A question that takes a menu's place is a menu of its own: it fits the window and takes the keyboard. -->
  {#key menu}
    <TreeMenu
      x={menu.x}
      y={menu.y}
      items={menu.items}
      onClose={() => {
        const back = menu?.back;
        menu = null;
        // Once the menu is gone, the row that opened it gets the keyboard back, unless the choice took it elsewhere.
        setTimeout(() => {
          if (back?.isConnected && (document.activeElement === document.body || !document.activeElement)) back.focus();
        });
      }}
    />
  {/key}
{/if}

<style>
  .library {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 6px 8px;
  }

  .library.drop-root {
    box-shadow: inset 0 0 0 1px var(--pv-accent);
  }

  /* A row with a + at its end, which keeps its count clear of it. */
  .current .tree-icon {
    color: var(--pv-accent);
  }

  .current > .name {
    font-weight: 600;
  }

  /* One of her files, picked with a click; its icon stays quiet beside the writings'. */
  .library :global(.tree-row.picked) {
    background-color: var(--pv-selected);
  }

  .file .tree-icon {
    color: var(--pv-text-faint);
  }

  /* A writing in the Deleted folder. */
  .gone {
    color: var(--pv-text-faint);
  }

  .num {
    width: 16px;
    flex: none;
    text-align: center;
    color: var(--pv-text-faint);
    font-size: 11px;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .words {
    flex: none;
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
  }

  .tree-input input {
    flex: 1;
    min-width: 0;
    height: 20px;
    padding: 0 5px;
    border: 1px solid var(--pv-accent);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    font: inherit;
  }

  .tree-input input:focus-visible {
    outline: none;
  }

  .tree-input input[aria-invalid="true"] {
    border-color: var(--pv-danger);
  }

  .problem {
    margin: 2px 6px 4px calc(26px + var(--depth, 0) * 10px);
    color: var(--pv-danger);
    font-size: var(--pv-text-sm);
    line-height: 1.35;
  }

  .empty {
    margin: 8px 10px;
    color: var(--pv-text-faint);
    font-size: var(--pv-text-sm);
  }
</style>
