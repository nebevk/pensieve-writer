import { tick, untrack } from "svelte";
import type { Editor } from "@tiptap/core";
import type { FindScope } from "./FindPanel.svelte";
import type { FindTools, Found } from "./findMarks";
import type { FindOptions } from "./findPattern";
import { replaceInChapterText } from "./find";
import { leadLines, textStart } from "$lib/chapters/page";
import type { Chapter, Shelf, Writing } from "$lib/model";
import { errorMessage } from "$lib/save/autosave";
import { keepSnapshot, loadWriting, sqliteStorage } from "$lib/storage/sqlite";
import { t } from "$lib/ui.svelte";
import type { SearchSource } from "$lib/views/searchAll";

/** What find needs from the page around it (+page.svelte). */
export type FindHost = {
  /** The page's editor, and the chapter and writing it shows. */
  editor: () => Editor | null;
  editorChapter: () => string;
  editorWriting: () => string;
  /** The open writing, and its project's shelf. */
  writing: () => Writing | null;
  setWriting: (next: Writing) => void;
  shelf: () => Shelf | null;
  /** Puts the page's text into the writing; saves the writing now. */
  captureEditor: () => void;
  save: () => Promise<void>;
  refreshShelf: () => Promise<void>;
  /** The open project, or every project (saying how far it has got), for the list. */
  readProject: () => Promise<{ sources: SearchSource[]; unread: string[] }>;
  readEveryProject: (progress: (done: number, total: number) => void) => Promise<{ sources: SearchSource[]; unread: string[] }>;
};

/** Find's work on a page (see findMarks.ts), reached through the page's editor. */
function toolsOf(editor: Editor | null): FindTools | null {
  if (!editor || editor.isDestroyed) return null;
  return (editor.storage as unknown as Record<string, FindTools | undefined>).findMarks ?? null;
}

/**
 * Find in Write (owner, 13 October): the box's words and choices, the page's matches and replacing them, in
 * the chapter or through the whole project. Where a place in the list opens stays with the page.
 */
export class PageFind {
  open = $state(false);
  query = $state("");
  replacement = $state("");
  replaceShown = $state(false);
  scope = $state<FindScope>("chapter");
  options = $state<FindOptions>({ matchCase: false, wholeWord: false });
  /** How many matches the page has, and which she is at. */
  found = $state<Found>({ current: -1, total: 0 });
  /** The project, or every project, the list looks through; null while they are read. */
  sources = $state.raw<SearchSource[] | null>(null);
  progress = $state({ done: 0, total: 0 });
  unread = $state<string[]>([]);
  /** What the last replace did. */
  notice = $state("");
  /** The field, to give it the keyboard. */
  input = $state<HTMLInputElement | undefined>(undefined);
  // Each reading of the projects, so an earlier one finishing late is set aside.
  #reading = 0;
  #host: FindHost;

  /** Made with the page, so its effects live as long as the page. */
  constructor(host: FindHost) {
    this.#host = host;
    // The field has the keyboard whenever find opens.
    $effect(() => {
      if (this.open && this.input) this.input.focus();
    });
    // The page's matches follow the words, Aa and ab as she types them, and leave when find closes.
    $effect(() => {
      const editor = host.editor();
      const open = this.open;
      const query = this.query;
      const options = this.options;
      const tools = toolsOf(editor);
      if (!editor || !tools) return;
      if (!open || !query.trim()) {
        tools.clear(editor.view);
        this.found = { current: -1, total: 0 };
        return;
      }
      const timer = window.setTimeout(() => {
        if (editor.isDestroyed) return;
        const now = tools.queryOf(editor.state);
        if (now.query === query && now.options.matchCase === options.matchCase && now.options.wholeWord === options.wholeWord) return;
        this.found = tools.search(editor.view, query, options);
      }, 120);
      return () => window.clearTimeout(timer);
    });
    // The list reads the project, or every project, each time she turns to it.
    $effect(() => {
      const scope = this.scope;
      if (!this.open || (scope !== "project" && scope !== "all")) return;
      untrack(() => void this.readSources(scope));
    });
  }

  /** The words selected on the page, if any are on one line, become what find looks for, as in Word. */
  takeSelection() {
    const editor = this.#host.editor();
    if (!editor || editor.isDestroyed || editor.state.selection.empty) return;
    const { from, to } = editor.state.selection;
    const words = editor.state.doc.textBetween(from, to, "\n").trim();
    if (words && !words.includes("\n") && words.length <= 100) this.query = words;
  }

  /** Opens find: on the page, or with its list through the project or every project; Replace shown or not. */
  show(scope: FindScope, replace = false) {
    this.takeSelection();
    this.scope = scope;
    this.replaceShown = replace;
    this.notice = "";
    this.open = true;
    void tick().then(() => {
      this.input?.focus();
      this.input?.select();
    });
  }

  /** The selection bar's find: the selected words, looked for through the whole project, as a list. */
  showWords(words: string) {
    const first = words.split("\n")[0].trim().slice(0, 100);
    if (!first) return;
    this.query = first;
    this.show("project");
  }

  /** Opened on words looked for elsewhere (the search across projects), as they were typed there. */
  showQuery(query: string) {
    this.query = query;
    this.options = { matchCase: false, wholeWord: false };
    this.replaceShown = false;
    this.open = true;
  }

  /** Find closes, and the keyboard is back on the page, at the match she was at. */
  close() {
    this.open = false;
    this.notice = "";
    // At once, while the field still has it: the editor's own focus command waits a frame, and the field going
    // meanwhile sometimes left the keyboard nowhere.
    const editor = this.#host.editor();
    if (editor && !editor.isDestroyed) editor.view.focus();
  }

  step(step: 1 | -1) {
    const editor = this.#host.editor();
    const tools = toolsOf(editor);
    if (tools && editor) this.found = tools.step(editor.view, step);
  }

  replaceOne() {
    const editor = this.#host.editor();
    const tools = toolsOf(editor);
    if (!tools || !editor) return;
    this.notice = "";
    tools.replace(editor.view, this.replacement);
    this.found = tools.found(editor.state);
  }

  async replaceEvery() {
    this.notice = "";
    if (this.scope === "project") {
      await this.#replaceInProject();
      return;
    }
    const editor = this.#host.editor();
    const tools = toolsOf(editor);
    if (!tools || !editor) return;
    const count = tools.replaceAll(editor.view, this.replacement, 0, { query: this.query, options: this.options });
    this.found = tools.found(editor.state);
    this.notice = t("replacedSome", { n: count });
  }

  /**
   * Replace all through This project (owner, 13 October): every writing's chapters, not their names nor the
   * notes. Each writing that changes is kept as an earlier version first, as Undo only reaches the page;
   * the open writing changes where it is, its page in the editor.
   */
  async #replaceInProject() {
    const host = this.#host;
    const { query, replacement, options } = this;
    const open = host.writing();
    const project = host.shelf();
    if (!query.trim() || !open || !project) return;
    host.captureEditor();
    const now = new Date().toISOString();
    const replaced = (chapter: Chapter) => {
      const next = replaceInChapterText(chapter, query, replacement, options);
      return { count: next.count, chapter: next.count > 0 ? { ...chapter, contentJson: next.contentJson, plainText: next.plainText, updatedAt: now } : chapter };
    };
    let total = 0;
    try {
      const editor = host.editor();
      const tools = toolsOf(editor);
      const page = tools && editor && host.editorWriting() === open.id ? { tools, editor } : null;
      const pageStart = page ? textStart(page.editor.state.doc) : 0;
      const onPage = page ? page.tools.matches(page.editor.state.doc, query, options).filter((match) => match.from >= pageStart).length : 0;
      const chapters = open.chapters.map((chapter) => (page && chapter.id === host.editorChapter() ? { count: 0, chapter } : replaced(chapter)));
      const here = chapters.reduce((sum, item) => sum + item.count, 0) + onPage;
      if (here > 0) {
        await keepSnapshot(open);
        const current = host.writing();
        if (current?.id !== open.id) return;
        host.setWriting({ ...current, chapters: current.chapters.map((chapter) => chapters.find((item) => item.chapter.id === chapter.id)?.chapter ?? chapter) });
        if (page && onPage > 0) page.tools.replaceAll(page.editor.view, replacement, pageStart, { query, options });
        total += here;
        await host.save();
      }
      let others = false;
      for (const item of project.writings.filter((entry) => !entry.deletedAt && entry.id !== open.id)) {
        const other = await loadWriting(item.id);
        const changed = other.chapters.map(replaced);
        const count = changed.reduce((sum, entry) => sum + entry.count, 0);
        if (count === 0) continue;
        await keepSnapshot(other);
        await sqliteStorage.save({ ...other, chapters: changed.map((entry) => entry.chapter), updatedAt: now });
        total += count;
        others = true;
      }
      if (others) await host.refreshShelf();
      this.notice = t("replacedSome", { n: total });
    } catch (error) {
      this.notice = errorMessage(error);
    }
    const editor = host.editor();
    if (editor) this.found = toolsOf(editor)?.found(editor.state) ?? this.found;
    void this.readSources("project");
  }

  /** The project, or every project, for the list: what she has just written saved first. */
  async readSources(scope: "project" | "all") {
    const reading = ++this.#reading;
    this.sources = null;
    this.unread = [];
    this.progress = { done: 0, total: 0 };
    try {
      const read =
        scope === "all"
          ? await this.#host.readEveryProject((done, total) => {
              if (reading === this.#reading) this.progress = { done, total };
            })
          : await this.#host.readProject();
      if (reading !== this.#reading) return;
      this.sources = read.sources;
      this.unread = read.unread;
    } catch (error) {
      if (reading !== this.#reading) return;
      this.sources = [];
      this.notice = errorMessage(error);
    }
  }

  /** The `nth` time the words are on the page, counted from its title line as the list counts them. */
  showMatchAt(editor: Editor, nth: number) {
    const tools = toolsOf(editor);
    if (!tools) return;
    const doc = editor.state.doc;
    // A part's name above the title line isn't in the list's count.
    const start = leadLines(doc) === 2 ? doc.child(0).nodeSize : 0;
    this.found = tools.searchAt(editor.view, this.query, this.options, nth, start);
  }
}
