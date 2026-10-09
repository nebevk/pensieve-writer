<script lang="ts">
  import { t } from "$lib/ui.svelte";
  import { onDestroy, onMount } from "svelte";
  import { Editor, type JSONContent } from "@tiptap/core";
  import { Selection } from "@tiptap/pm/state";
  import StarterKit from "@tiptap/starter-kit";
  import TextAlign from "@tiptap/extension-text-align";
  import type { DocumentJson, WritingLanguage } from "$lib/model";
  import { Highlight, ImageBlock, Indent, LinkMark, Superscript, TextColor } from "./marks";
  import { TextLanguage } from "./textLanguage";
  import { NoteLinkMark, NoteLinks, type NoteTarget } from "./noteLinks";
  import { Footnote } from "./footnote";
  import { CommentMark } from "./comments";
  import { ChapterPage, bodyText } from "./chapterPage";
  import { Pagination, setSheet, type SheetGeometry } from "./pagination";
  import { UndoSteps } from "./undoSteps";
  import { SmoothTyping, refreshSmoothTyping } from "./smoothTyping";
  import { keySound, prepareKeySounds, type KeySoundStyle } from "$lib/keySounds";

  let {
    docId,
    initialContent,
    onChange,
    onEditor,
    onActivity,
    onEdit,
    onText,
    live = true,
    language = "en",
    typewriter = false,
    noteLinkBrackets = false,
    onOpenNote,
    page = false,
    focusOnOpen = true,
    sheet = null,
    onSheets,
    keySounds = "off",
    keyVolume = 0.5,
    smoothTyping = false,
  }: {
    /** The chapter or note this editor opened. Every change is handed back with it. */
    docId?: string;
    initialContent: DocumentJson;
    onChange: (json: DocumentJson, text: string, docId?: string) => void;
    onEditor: (editor: Editor | null) => void;
    onActivity: () => void;
    onEdit?: () => void;
    onText?: (text: string, docId?: string) => void;
    /** When false, the chapter JSON is read at save time instead of on every keystroke. */
    live?: boolean;
    language?: WritingLanguage;
    typewriter?: boolean;
    /** Draw [[Title]] as links, as notes do; the manuscript links with a mark instead. */
    noteLinkBrackets?: boolean;
    /** Opens the note a clicked link points to. */
    onOpenNote?: (target: NoteTarget) => void;
    /** A chapter's page: its first lines are the chapter's title and, where a part begins, the part's name. */
    page?: boolean;
    /** Whether the page takes the keyboard when it opens; not while a name is being typed elsewhere. */
    focusOnOpen?: boolean;
    /** A chapter's page on sheets of paper (Settings → Paper → Pages), or null for one continuous page. */
    sheet?: SheetGeometry | null;
    /** How many sheets the text fills, whenever that changes. */
    onSheets?: (count: number) => void;
    /** Keys that sound as she types (Settings → Sound), and how loud. */
    keySounds?: KeySoundStyle;
    keyVolume?: number;
    /** The caret glides and new letters ink in (Settings → Appearance). */
    smoothTyping?: boolean;
  } = $props();

  let typewriterOn = false;
  let liveOn = true;
  let reportText: ((text: string, docId?: string) => void) | undefined;
  let markEdited: (() => void) | undefined;
  let countTimer: ReturnType<typeof setTimeout> | null = null;
  // Fixed when the editor opens, so the text it hands back on closing goes to the same chapter or note.
  let ownerId: string | undefined;

  let host: HTMLDivElement | undefined = $state();
  let editor = $state<Editor | null>(null);
  let publish: (json: DocumentJson, text: string, docId?: string) => void = () => {};
  let notify = () => {};
  let openNote: ((target: NoteTarget) => void) | undefined;
  let countSheets: ((count: number) => void) | undefined;
  let keysSound: KeySoundStyle = "off";
  let keysVolume = 0.5;
  let smoothOn = false;
  // The sheet the editor was last told about, so a new one goes in only when it differs.
  let sheetApplied = "null";

  $effect(() => {
    publish = onChange;
    notify = onActivity;
    const lang = language === "sl" ? "sl" : "en";
    typewriterOn = typewriter;
    liveOn = live;
    reportText = onText;
    markEdited = onEdit;
    openNote = onOpenNote;
    countSheets = onSheets;
    keysSound = keySounds;
    keysVolume = keyVolume;
    // Ready before the first key, so that one sounds too.
    if (keySounds !== "off") void prepareKeySounds(keySounds);
    if (editor && !editor.isDestroyed) editor.view.dom.setAttribute("lang", lang);
  });

  $effect(() => {
    const on = page && smoothTyping;
    if (on === smoothOn) return;
    smoothOn = on;
    if (editor && !editor.isDestroyed) refreshSmoothTyping(editor.view);
  });

  $effect(() => {
    const wanted = JSON.stringify(sheet);
    if (!page || !editor || editor.isDestroyed || wanted === sheetApplied) return;
    sheetApplied = wanted;
    setSheet(editor.view, sheet);
  });

  onMount(() => {
    if (!host) return;
    ownerId = docId;
    publish = onChange;
    notify = onActivity;
    const focusAtOpen = focusOnOpen;
    editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ link: false }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        TextLanguage,
        Superscript,
        Highlight,
        TextColor,
        LinkMark,
        ImageBlock,
        Indent,
        NoteLinkMark,
        Footnote,
        CommentMark,
        UndoSteps,
        ...(page
          ? [
              ChapterPage.configure({ titleHint: t("chapterTitleHint"), partHint: t("partTitleHint") }),
              Pagination.configure({ onSheets: (count) => countSheets?.(count) }),
              SmoothTyping.configure({ isOn: () => smoothOn }),
            ]
          : []),
        NoteLinks.configure({ brackets: noteLinkBrackets, onOpen: (target) => openNote?.(target) }),
      ],
      content: initialContent as JSONContent,
      // The first focus is the page's own (onCreate), not the editor's: see takeKeyboard.
      autofocus: false,
      onCreate: ({ editor: current }) => {
        if (focusAtOpen) requestAnimationFrame(() => takeKeyboard(current));
      },
      editorProps: {
        attributes: {
          spellcheck: "true",
          lang: language === "sl" ? "sl" : "en",
          "aria-label": t("chapterText"),
        },
      },
      onUpdate: ({ editor: current }) => {
        // An edit that leaves the cursor where it was, such as a comment turned into a to-do, changes
        // the page too. Typing also moves the cursor, and both arrive together, so this adds no work.
        notify();
        if (liveOn) publish(current.getJSON() as DocumentJson, current.getText(), ownerId);
        else markEdited?.();
        if (countTimer) clearTimeout(countTimer);
        countTimer = setTimeout(() => {
          // A chapter's title and part lines are not counted as its words.
          reportText?.(page ? bodyText(current) : current.getText(), ownerId);
        }, 400);
        if (!typewriterOn || !host) return;
        const scroller = host.closest(".stage");
        if (!(scroller instanceof HTMLElement)) return;
        const coords = current.view.coordsAtPos(current.state.selection.from);
        const box = scroller.getBoundingClientRect();
        scroller.scrollTop += coords.top - (box.top + box.height / 2);
      },
      onSelectionUpdate: () => {
        notify();
      },
    });
    // A key's sound, if she chose one; read from the latest settings, not when the editor opened.
    editor.view.dom.addEventListener("keydown", (event) => keySound(event, keysSound, keysVolume));
    onEditor(editor);
  });

  /**
   * The keyboard at the end of the page, a frame after it opens, decided then: not if it is in the page
   * already (it opened at a spot), nor while she types somewhere else (a name in the library, the find
   * box). The editor's own first focus came a frame after it decided, and took the keyboard from a
   * name begun meanwhile: the field closed, and the name went into the page (8 October).
   */
  function takeKeyboard(current: Editor) {
    if (current.isDestroyed || current.view.hasFocus()) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && (active.matches("input, textarea, select") || active.isContentEditable)) return;
    current.view.dispatch(current.state.tr.setSelection(Selection.atEnd(current.state.doc)).scrollIntoView());
    current.view.focus();
  }

  onDestroy(() => {
    if (countTimer) clearTimeout(countTimer);
    // A live editor has handed back every change already. Handing it back again here would be read
    // during Svelte's teardown, against the list as it was before the change that closed the editor,
    // and bring back a note that was just deleted, or hide one just made.
    if (!liveOn && editor && !editor.isDestroyed) publish(editor.getJSON() as DocumentJson, editor.getText(), ownerId);
    onEditor(null);
    editor?.destroy();
    editor = null;
  });
</script>

<div class="editor-host" bind:this={host}></div>

<style>
  .editor-host {
    position: relative;
    min-height: 8rem;
  }

  /*
   * Smooth typing (smoothTyping.ts): the page's own caret gives way to one that glides, and a letter just
   * typed inks in. It follows its own switch in Settings, so it moves even where Windows' animations are
   * off or Gentle mode is on (the owner has both, and saw nothing).
   */
  .editor-host :global(.ProseMirror.ink-caret-on) {
    caret-color: transparent;
  }

  .editor-host :global(.ink-caret) {
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--pv-ink-accent);
    pointer-events: none;
    opacity: 0;
    will-change: transform;
  }

  .editor-host :global(.ink-caret.shown) {
    opacity: 1;
  }

  .editor-host :global(.ink-caret.gliding) {
    transition: transform 100ms cubic-bezier(0.22, 0.8, 0.3, 1) !important;
  }

  .editor-host :global(.ink-caret.shown.blinking) {
    animation: ink-blink 1.1s steps(1, end) infinite !important;
  }

  @keyframes ink-blink {
    50% {
      opacity: 0;
    }
  }

  /* A veil of paper over letters just typed, faded away by smoothTyping.ts, so they seem to ink in. */
  .editor-host :global(.ink-veil) {
    position: absolute;
    top: 0;
    left: 0;
    background: var(--pv-paper);
    pointer-events: none;
    opacity: 0;
    transform-origin: right center;
    will-change: transform, opacity;
  }

  @media print {
    .editor-host :global(.ink-caret),
    .editor-host :global(.ink-veil) {
      display: none;
    }
  }

  .editor-host :global(.ProseMirror) {
    min-height: 8rem;
    padding: 0;
    outline: none;
    font-family: var(--pv-writing-font, var(--pv-font-manuscript));
    font-size: var(--pv-writing-size, var(--pv-manuscript-size));
    line-height: var(--pv-manuscript-leading);
    color: var(--pv-ink);
    caret-color: var(--pv-ink-accent);
  }

  .editor-host :global(.ProseMirror p) {
    margin: 0;
  }

  /* Paragraphs flush left and a little apart, as in Word and Grammarly; a book's first-line indents
     looked odd while writing. The Word file spaces them the same (PARAGRAPH_GAP in export/word.ts). */
  .editor-host :global(.ProseMirror p + p) {
    margin-top: 0.6em;
  }

  .editor-host :global(.ProseMirror h1),
  .editor-host :global(.ProseMirror h2),
  .editor-host :global(.ProseMirror h3) {
    font-family: var(--pv-font-manuscript);
    font-weight: 400;
    line-height: 1.25;
    margin: 1.2em 0 0.4em;
  }

  .editor-host :global(.ProseMirror h1) {
    font-size: 1.9em;
  }

  .editor-host :global(.ProseMirror h2) {
    font-size: 1.55em;
  }

  .editor-host :global(.ProseMirror h3) {
    font-size: 1.2em;
  }

  .editor-host :global(.ProseMirror > :first-child) {
    margin-top: 0;
  }

  .editor-host :global(.ProseMirror .empty-line::before) {
    content: attr(data-hint);
    float: left;
    height: 0;
    color: var(--pv-ink-meta);
    pointer-events: none;
  }

  .editor-host :global(.ProseMirror blockquote) {
    margin: 0.6em 0;
    padding-left: 1rem;
    border-left: 2px solid var(--pv-ink-rule-accent);
    color: var(--pv-ink-2);
  }

  .editor-host :global(.ProseMirror ul),
  .editor-host :global(.ProseMirror ol) {
    margin: 0.6em 0;
    padding-left: 1.4rem;
  }

  /* A list inside a list item sits close to it, as in Word. */
  .editor-host :global(.ProseMirror li > ul),
  .editor-host :global(.ProseMirror li > ol) {
    margin: 0;
  }

  .editor-host :global(.ProseMirror u) {
    text-decoration: underline;
  }

  .editor-host :global(.ProseMirror s) {
    text-decoration: line-through;
  }

  .editor-host :global(.ProseMirror img) {
    max-width: 100%;
    /* On a sheet, a picture fits the sheet's text (see --pv-sheet-room in +page.svelte). */
    max-height: var(--pv-sheet-room, none);
    height: auto;
    object-fit: contain;
  }

  /* Where a sheet ends: the rest of its text area, its bottom margin, the desk, the next one's top margin. */
  /* Its height is measured the moment it is set, so it never eases into it. */
  .editor-host :global(.page-gap) {
    display: block;
    height: 0;
    transition: none !important;
  }

  /* Out of the way while the text is measured as it lies without breaks (see pagination.ts). */
  .editor-host :global(.page-gap.measuring) {
    display: none;
  }

  /* A block carried to a new sheet starts at its top, as in Word. */
  .editor-host :global(.page-gap:not(.measuring) + *) {
    margin-top: 0;
  }

  /* A printer makes its own pages. */
  @media print {
    .editor-host :global(.page-gap) {
      display: none;
    }
  }

  /* Footnotes number themselves in page order. */
  .editor-host :global(.ProseMirror) {
    counter-reset: footnote;
  }

  .editor-host :global(sup.footnote) {
    color: var(--pv-ink-accent);
    font-family: var(--pv-font-ui);
    font-size: 0.7em;
    font-weight: 600;
    cursor: pointer;
    padding: 0 1px;
  }

  .editor-host :global(sup.footnote::after) {
    counter-increment: footnote;
    content: counter(footnote);
  }

  .editor-host :global(sup.footnote.ProseMirror-selectednode) {
    outline: 1px solid var(--pv-ink-accent);
    border-radius: 2px;
  }

  .editor-host :global(.note-link) {
    color: var(--pv-ink-accent);
    text-decoration: underline;
    text-decoration-color: var(--pv-ink-link-underline);
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .editor-host :global(.note-link-bracket) {
    opacity: 0.35;
  }

  .editor-host :global(.ProseMirror a) {
    color: var(--pv-ink-accent);
    text-decoration-color: var(--pv-ink-link-underline);
  }

  /* Commented words, as in Word; the comment open in the margin is underlined. */
  .editor-host :global(.comment) {
    background: var(--pv-ink-tint);
  }

  .editor-host :global(.comment-active) {
    box-shadow: inset 0 -2px var(--pv-ink-accent);
  }

  .editor-host :global(.ProseMirror hr) {
    border: 0;
    border-top: 1px solid var(--pv-ink-rule);
    margin: 1.4em 0;
  }
</style>
