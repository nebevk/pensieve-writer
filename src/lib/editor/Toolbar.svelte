<script lang="ts">
  import type { Editor } from "@tiptap/core";

  let { editor, revision }: { editor: Editor | null; revision: number } = $props();

  type Tool = {
    label: string;
    title: string;
    active: (current: Editor) => boolean;
    run: (current: Editor) => void;
  };

  const groups: Tool[][] = [
    [
      {
        label: "B",
        title: "Bold (Ctrl+B)",
        active: (current) => current.isActive("bold"),
        run: (current) => current.chain().focus().toggleBold().run(),
      },
      {
        label: "I",
        title: "Italic (Ctrl+I)",
        active: (current) => current.isActive("italic"),
        run: (current) => current.chain().focus().toggleItalic().run(),
      },
      {
        label: "U",
        title: "Underline (Ctrl+U)",
        active: (current) => current.isActive("underline"),
        run: (current) => current.chain().focus().toggleUnderline().run(),
      },
      {
        label: "S",
        title: "Strikethrough",
        active: (current) => current.isActive("strike"),
        run: (current) => current.chain().focus().toggleStrike().run(),
      },
    ],
    [
      {
        label: "P",
        title: "Paragraph",
        active: (current) => current.isActive("paragraph"),
        run: (current) => current.chain().focus().setParagraph().run(),
      },
      {
        label: "H1",
        title: "Heading 1",
        active: (current) => current.isActive("heading", { level: 1 }),
        run: (current) => current.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        label: "H2",
        title: "Heading 2",
        active: (current) => current.isActive("heading", { level: 2 }),
        run: (current) => current.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: "H3",
        title: "Heading 3",
        active: (current) => current.isActive("heading", { level: 3 }),
        run: (current) => current.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        label: "Quote",
        title: "Block quote",
        active: (current) => current.isActive("blockquote"),
        run: (current) => current.chain().focus().toggleBlockquote().run(),
      },
    ],
    [
      {
        label: "• List",
        title: "Bulleted list",
        active: (current) => current.isActive("bulletList"),
        run: (current) => current.chain().focus().toggleBulletList().run(),
      },
      {
        label: "1. List",
        title: "Numbered list",
        active: (current) => current.isActive("orderedList"),
        run: (current) => current.chain().focus().toggleOrderedList().run(),
      },
    ],
    [
      {
        label: "Left",
        title: "Align left",
        active: (current) => current.isActive({ textAlign: "left" }),
        run: (current) => current.chain().focus().setTextAlign("left").run(),
      },
      {
        label: "Center",
        title: "Align center",
        active: (current) => current.isActive({ textAlign: "center" }),
        run: (current) => current.chain().focus().setTextAlign("center").run(),
      },
      {
        label: "Right",
        title: "Align right",
        active: (current) => current.isActive({ textAlign: "right" }),
        run: (current) => current.chain().focus().setTextAlign("right").run(),
      },
      {
        label: "Justify",
        title: "Justify",
        active: (current) => current.isActive({ textAlign: "justify" }),
        run: (current) => current.chain().focus().setTextAlign("justify").run(),
      },
    ],
  ];

  function ready(): Editor | null {
    if (!editor || editor.isDestroyed) return null;
    return editor;
  }

  function pressed(tool: Tool): boolean {
    const current = ready();
    return revision >= 0 && current !== null && tool.active(current);
  }
</script>

<div class="toolbar" role="toolbar" aria-label="Formatting">
  {#each groups as group, groupIndex (groupIndex)}
    {#if groupIndex > 0}
      <span class="divider" aria-hidden="true"></span>
    {/if}
    {#each group as tool (tool.title)}
      <button
        type="button"
        class:mark={tool.label.length === 1}
        class:active={pressed(tool)}
        title={tool.title}
        aria-pressed={pressed(tool)}
        disabled={ready() === null}
        onmousedown={(event) => event.preventDefault()}
        onclick={() => {
          const current = ready();
          if (current) tool.run(current);
        }}
      >
        {tool.label}
      </button>
    {/each}
  {/each}
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem;
    padding: 0.15rem 0.7rem 0.45rem;
  }

  button {
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.45rem;
    font-size: 0.82rem;
  }

  button.mark {
    font-family: Georgia, serif;
    font-size: 0.95rem;
    min-width: 1.8rem;
  }

  button[title^="Bold"] {
    font-weight: 700;
  }

  button[title^="Italic"] {
    font-style: italic;
  }

  button[title^="Underline"] {
    text-decoration: underline;
  }

  button[title^="Strikethrough"] {
    text-decoration: line-through;
  }

  button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.45);
  }

  button.active {
    background: var(--paper);
    border-color: var(--line);
  }

  button:disabled {
    opacity: 0.45;
  }

  .divider {
    width: 1px;
    height: 1.1rem;
    margin: 0 0.25rem;
    background: var(--line);
  }
</style>
