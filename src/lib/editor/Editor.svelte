<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Editor, type JSONContent } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import type { DocumentJson } from "$lib/model";

  let {
    initialContent,
    onChange,
  }: {
    initialContent: DocumentJson;
    onChange: (json: DocumentJson, text: string) => void;
  } = $props();

  let host: HTMLDivElement | undefined = $state();
  let editor: Editor | null = null;
  let publish: (json: DocumentJson, text: string) => void = () => {};

  $effect(() => {
    publish = onChange;
  });

  onMount(() => {
    if (!host) return;
    editor = new Editor({
      element: host,
      extensions: [StarterKit],
      content: initialContent as JSONContent,
      autofocus: "end",
      editorProps: {
        attributes: {
          spellcheck: "true",
          lang: "en",
          "aria-label": "Chapter text",
        },
      },
      onUpdate: ({ editor: current }) => {
        publish(current.getJSON() as DocumentJson, current.getText());
      },
    });
  });

  onDestroy(() => {
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
    padding: 3rem 3.25rem 4rem;
    outline: none;
    font-family: var(--font-writing);
    font-size: 1.125rem;
    line-height: 1.7;
    caret-color: var(--ink);
  }

  .editor-host :global(.ProseMirror p) {
    margin: 0 0 0.85em;
  }

  .editor-host :global(.ProseMirror h1),
  .editor-host :global(.ProseMirror h2),
  .editor-host :global(.ProseMirror h3) {
    font-family: var(--font-writing);
    line-height: 1.25;
    margin: 1.2em 0 0.4em;
  }

  .editor-host :global(.ProseMirror blockquote) {
    margin: 0 0 0.85em;
    padding-left: 1rem;
    border-left: 2px solid var(--line);
    color: var(--muted);
  }

  .editor-host :global(.ProseMirror ul),
  .editor-host :global(.ProseMirror ol) {
    margin: 0 0 0.85em;
    padding-left: 1.4rem;
  }
</style>
