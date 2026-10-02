<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Editor, type JSONContent } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import TextAlign from "@tiptap/extension-text-align";
  import type { DocumentJson, WritingLanguage } from "$lib/model";
  import { Highlight, ImageBlock, Indent, LinkMark, Superscript, TextColor } from "./marks";
  import { TextLanguage } from "./textLanguage";

  let {
    initialContent,
    onChange,
    onEditor,
    onActivity,
    language = "en",
    typewriter = false,
  }: {
    initialContent: DocumentJson;
    onChange: (json: DocumentJson, text: string) => void;
    onEditor: (editor: Editor | null) => void;
    onActivity: () => void;
    language?: WritingLanguage;
    typewriter?: boolean;
  } = $props();

  let typewriterOn = false;

  let host: HTMLDivElement | undefined = $state();
  let editor = $state<Editor | null>(null);
  let publish: (json: DocumentJson, text: string) => void = () => {};
  let notify = () => {};

  $effect(() => {
    publish = onChange;
    notify = onActivity;
    const lang = language === "sl" ? "sl" : "en";
    typewriterOn = typewriter;
    if (editor && !editor.isDestroyed) editor.view.dom.setAttribute("lang", lang);
  });

  onMount(() => {
    if (!host) return;
    publish = onChange;
    notify = onActivity;
    editor = new Editor({
      element: host,
      extensions: [
        StarterKit,
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
      ],
      content: initialContent as JSONContent,
      autofocus: "end",
      editorProps: {
        attributes: {
          spellcheck: "true",
          lang: language === "sl" ? "sl" : "en",
          "aria-label": "Chapter text",
        },
      },
      onUpdate: ({ editor: current }) => {
        publish(current.getJSON() as DocumentJson, current.getText());
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
    onEditor(editor);
  });

  onDestroy(() => {
    onEditor(null);
    editor?.destroy();
    editor = null;
  });
</script>

<div class="editor-host" bind:this={host}></div>

<style>
  .editor-host {
    min-height: 70vh;
  }

  .editor-host :global(.ProseMirror) {
    min-height: 70vh;
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

  .editor-host :global(.ProseMirror > p:first-child::first-letter) {
    float: left;
    font-size: var(--pv-dropcap);
    line-height: 0.8;
    padding: 0.08em 0.08em 0 0;
    color: var(--pv-ink-accent);
  }

  .editor-host :global(.ProseMirror p + p) {
    text-indent: var(--pv-manuscript-indent);
  }

  .editor-host :global(.ProseMirror h1),
  .editor-host :global(.ProseMirror h2),
  .editor-host :global(.ProseMirror h3) {
    font-family: var(--pv-font-manuscript);
    font-weight: 400;
    line-height: 1.25;
    margin: 1.2em 0 0.4em;
    text-indent: 0;
  }

  .editor-host :global(.ProseMirror blockquote) {
    margin: 0.6em 0;
    padding-left: 1rem;
    border-left: 2px solid var(--pv-ink-rule-accent);
    color: var(--pv-ink-2);
  }

  .editor-host :global(.ProseMirror ul),
  .editor-host :global(.ProseMirror ol) {
    margin: 0 0 0.85em;
    padding-left: 1.4rem;
  }

  .editor-host :global(.ProseMirror u) {
    text-decoration: underline;
  }

  .editor-host :global(.ProseMirror s) {
    text-decoration: line-through;
  }

  .editor-host :global(.ProseMirror img) {
    max-width: 100%;
    height: auto;
  }

  .editor-host :global(.ProseMirror a) {
    color: var(--pv-ink-accent);
    text-decoration-color: var(--pv-ink-link-underline);
  }

  .editor-host :global(.ProseMirror hr) {
    border: 0;
    border-top: 1px solid var(--pv-ink-rule);
    margin: 1.4em 0;
  }
</style>
