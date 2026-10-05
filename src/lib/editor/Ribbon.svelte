<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { Editor } from "@tiptap/core";
  import type { ManuscriptFont } from "$lib/prefs";
  import { chooseImageFile } from "$lib/storage/backup";
  import { imageType, shrinkImage } from "./imageSize";
  import Icon from "./Icon.svelte";

  let {
    editor,
    revision,
    chaptersOpen,
    notesOpen,
    todosOpen,
    onToggleChapters,
    onToggleNotes,
    onToggleTodos,
    onFind,
    manuscriptFont,
    manuscriptSize,
    onFont,
    onSize,
    onNewNote,
    onAddTodo,
    onReplace,
  }: {
    editor: Editor | null;
    revision: number;
    chaptersOpen: boolean;
    notesOpen: boolean;
    todosOpen: boolean;
    onToggleChapters: () => void;
    onToggleNotes: () => void;
    onToggleTodos: () => void;
    onFind: () => void;
    manuscriptFont: ManuscriptFont;
    manuscriptSize: number;
    onFont: (font: ManuscriptFont) => void;
    onSize: (size: number) => void;
    onNewNote: () => void;
    onAddTodo: () => void;
    onReplace: () => void;
  } = $props();

  let expanded = $state(false);
  let linkOpen = $state(false);
  let imageProblem = $state("");
  let problemTimer: ReturnType<typeof setTimeout> | null = null;
  let linkDraft = $state("https://");

  type Tool = {
    icon?: string;
    glyph?: string;
    title: string;
    wide?: boolean;
    pressed?: boolean;
    disabled?: boolean;
    run: () => void;
  };

  function ready(): Editor | null {
    if (!editor || editor.isDestroyed) return null;
    return editor;
  }

  function format(
    title: string,
    active: (current: Editor) => boolean,
    command: (current: Editor) => void,
    glyph?: string,
    icon?: string,
    enabled: (current: Editor) => boolean = () => true,
  ): Tool {
    const current = ready();
    return {
      icon,
      glyph,
      title,
      pressed: revision >= 0 && current !== null && active(current),
      disabled: current === null || (current !== null && !enabled(current)),
      run: () => {
        const next = ready();
        if (next) command(next);
      },
    };
  }

  const styleValue = $derived.by(() => {
    const current = ready();
    if (!current || revision < 0) return "p";
    if (current.isActive("heading", { level: 1 })) return "h1";
    if (current.isActive("heading", { level: 2 })) return "h2";
    if (current.isActive("heading", { level: 3 })) return "h3";
    return "p";
  });

  const marks = $derived([
    format("Bold (Ctrl+B)", (current) => current.isActive("bold"), (current) => current.chain().focus().toggleBold().run(), "B"),
    format("Italic (Ctrl+I)", (current) => current.isActive("italic"), (current) => current.chain().focus().toggleItalic().run(), "I"),
    format("Underline (Ctrl+U)", (current) => current.isActive("underline"), (current) => current.chain().focus().toggleUnderline().run(), "U"),
    format("Strikethrough", (current) => current.isActive("strike"), (current) => current.chain().focus().toggleStrike().run(), "S"),
  ]);

  const history = $derived([
    format("Undo (Ctrl+Z)", () => false, (current) => current.chain().focus().undo().run(), undefined, "undo", (current) => current.can().undo()),
    format("Redo (Ctrl+Y)", () => false, (current) => current.chain().focus().redo().run(), undefined, "redo", (current) => current.can().redo()),
  ]);

  const blocks = $derived([
    format("Bulleted list", (current) => current.isActive("bulletList"), (current) => current.chain().focus().toggleBulletList().run(), undefined, "bullets"),
    format("Numbered list", (current) => current.isActive("orderedList"), (current) => current.chain().focus().toggleOrderedList().run(), undefined, "numbers"),
    format("Align left", (current) => current.isActive({ textAlign: "left" }), (current) => current.chain().focus().setTextAlign("left").run(), undefined, "align-left"),
    format("Align center", (current) => current.isActive({ textAlign: "center" }), (current) => current.chain().focus().setTextAlign("center").run(), undefined, "align-center"),
    format("Align right", (current) => current.isActive({ textAlign: "right" }), (current) => current.chain().focus().setTextAlign("right").run(), undefined, "align-right"),
    format("Justify", (current) => current.isActive({ textAlign: "justify" }), (current) => current.chain().focus().setTextAlign("justify").run(), undefined, "align-justify"),
  ]);

  function applyStyle(value: string) {
    const current = ready();
    if (!current) return;
    const chain = current.chain().focus();
    if (value === "h1") chain.toggleHeading({ level: 1 }).run();
    else if (value === "h2") chain.toggleHeading({ level: 2 }).run();
    else if (value === "h3") chain.toggleHeading({ level: 3 }).run();
    else chain.setParagraph().run();
  }

  function sceneBreak() {
    ready()
      ?.chain()
      .focus()
      .insertContent({
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [{ type: "text", text: "* *" }],
      })
      .run();
  }

  function shiftIndent(delta: number) {
    const current = ready();
    if (!current) return;
    const type = current.isActive("heading") ? "heading" : "paragraph";
    const indent = Number(current.getAttributes(type).indent ?? 0);
    current.chain().focus().updateAttributes(type, { indent: Math.max(0, Math.min(6, indent + delta)) }).run();
  }

  function applyLink() {
    const current = ready();
    const href = linkDraft.trim();
    if (!current || !href) return;
    if (current.state.selection.empty) {
      current.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      current.chain().focus().setMark("link", { href }).run();
    }
    linkOpen = false;
  }

  async function askImage() {
    imageProblem = "";
    try {
      const path = await chooseImageFile();
      if (!path) return;
      const bytes = await invoke<number[]>("read_image_file", { path });
      const blob = new Blob([new Uint8Array(bytes)], { type: imageType(path) });
      const original = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const src = await shrinkImage(original);
      ready()?.chain().focus().insertContent({ type: "image", attrs: { src, alt: "" } }).run();
    } catch (error) {
      imageProblem = `Couldn't add that picture. ${error instanceof Error ? error.message : String(error)}`;
      if (problemTimer) clearTimeout(problemTimer);
      problemTimer = setTimeout(() => (imageProblem = ""), 8000);
    }
  }

  function clearFormatting() {
    ready()?.chain().focus().unsetAllMarks().clearNodes().run();
  }
</script>

<div class="ribbon" class:expanded role="toolbar" aria-label="Writing tools">
  {#if !expanded}
    <select aria-label="Paragraph style" value={styleValue} onchange={(event) => applyStyle(event.currentTarget.value)}>
      <option value="p">Normal text</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
    </select>
    <span class="rule"></span>
    {#each marks as tool (tool.title)}
      {@render toolButton(tool)}
    {/each}
    <span class="rule"></span>
    {@render toolButton(blocks[0])}
    {@render toolButton(blocks[2])}
    <button type="button" class="tool serif" title="Block quote" aria-label="Block quote" onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleBlockquote().run()}>“</button>
    <button type="button" class="tool scene" title="Scene break" aria-label="Scene break" onmousedown={(event) => event.preventDefault()} onclick={sceneBreak}>* *</button>
    <span class="rule"></span>
    <button type="button" class="more" onclick={() => (expanded = true)}>
      All tools
      <span aria-hidden="true">▾</span>
    </button>
    <span class="spacer"></span>
    <button type="button" class="tool" class:active={chaptersOpen} title="Chapters" aria-pressed={chaptersOpen} onclick={onToggleChapters}>
      <Icon name="chapters" />
    </button>
    <button type="button" class="tool" title="Find (Ctrl+F)" onmousedown={(event) => event.preventDefault()} onclick={onFind}>
      <Icon name="find" />
    </button>
  {:else}
    {@render group("History", history)}
    <section class="group">
      <div class="tools picks">
        <select aria-label="Paragraph style" value={styleValue} onchange={(event) => applyStyle(event.currentTarget.value)}>
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <select aria-label="Manuscript font" value={manuscriptFont} onchange={(event) => onFont(event.currentTarget.value as ManuscriptFont)}>
          <option value="literata">Literata</option>
          <option value="garamond">Garamond</option>
          <option value="typewriter">Typewriter</option>
        </select>
        <select aria-label="Text size" value={manuscriptSize} onchange={(event) => onSize(Number(event.currentTarget.value))}>
          {#each [13, 15, 17, 19, 21, 24] as size (size)}
            <option value={size}>{size}</option>
          {/each}
        </select>
      </div>
      <p>Text</p>
    </section>
    <section class="group">
      <div class="tools">
        {#each marks as tool (tool.title)}
          {@render toolButton(tool)}
        {/each}
        <button type="button" class="tool" title="Superscript" aria-label="Superscript" onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleMark("superscript").run()}>x²</button>
        <button type="button" class="tool color" title="Text colour" aria-label="Text colour" onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleMark("textColor").run()}>A</button>
        <button type="button" class="tool" title="Highlight" onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleMark("highlight").run()}>
          <span class="swatch"></span>
        </button>
        <button type="button" class="tool" title="Clear formatting" onmousedown={(event) => event.preventDefault()} onclick={clearFormatting}>
          <Icon name="clear" />
        </button>
      </div>
      <p>Format</p>
    </section>
    <section class="group">
      <div class="tools">
        {#each blocks as tool (tool.title)}
          {@render toolButton(tool)}
        {/each}
        <button type="button" class="tool" title="Decrease indent" aria-label="Decrease indent" onmousedown={(event) => event.preventDefault()} onclick={() => shiftIndent(-1)}>–</button>
        <button type="button" class="tool" title="Increase indent" aria-label="Increase indent" onmousedown={(event) => event.preventDefault()} onclick={() => shiftIndent(1)}>+</button>
      </div>
      <p>Paragraph</p>
    </section>
    <section class="group">
      <div class="tools">
        <button type="button" class="tool serif" title="Block quote" aria-label="Block quote" onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleBlockquote().run()}>“</button>
        <button type="button" class="tool scene" title="Scene break" aria-label="Scene break" onmousedown={(event) => event.preventDefault()} onclick={sceneBreak}>* *</button>
        <button type="button" class="tool" title="Image" aria-label="Image" onmousedown={(event) => event.preventDefault()} onclick={() => void askImage()}>Img</button>
        <button type="button" class="tool" title="Link" onmousedown={(event) => event.preventDefault()} onclick={() => (linkOpen = !linkOpen)}>Link</button>
        {#if linkOpen}
          <form
            class="link-form"
            onsubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <input bind:value={linkDraft} aria-label="Link address" />
            <button type="submit" class="tool text wide">Add</button>
          </form>
        {/if}
        {#if imageProblem}
          <span class="problem" role="alert">{imageProblem}</span>
        {/if}
      </div>
      <p>Insert</p>
    </section>
    <section class="group">
      <div class="tools">
        <button type="button" class="tool" title="New note" onclick={onNewNote}><Icon name="notes" /></button>
        <button type="button" class="tool" title="Add to-do" onclick={onAddTodo}><Icon name="todos" /></button>
        <button type="button" class="tool" class:active={notesOpen} title="Notes panel" aria-pressed={notesOpen} onclick={onToggleNotes}><Icon name="notes" /></button>
        <button type="button" class="tool" class:active={todosOpen} title="To-dos panel" aria-pressed={todosOpen} onclick={onToggleTodos}><Icon name="todos" /></button>
      </div>
      <p>Pensieve</p>
    </section>
    <section class="group last">
      <div class="tools">
        <button type="button" class="tool" title="Find (Ctrl+F)" onmousedown={(event) => event.preventDefault()} onclick={onFind}><Icon name="find" /></button>
        <button type="button" class="tool" title="Replace" onmousedown={(event) => event.preventDefault()} onclick={onReplace}><Icon name="redo" /></button>
      </div>
      <p>Find</p>
    </section>
    <span class="spacer"></span>
    <button type="button" class="more fewer" onclick={() => (expanded = false)}>
      Fewer
      <span aria-hidden="true">▴</span>
    </button>
  {/if}
</div>

{#snippet toolButton(tool: Tool)}
  <button
    type="button"
    class="tool"
    class:active={tool.pressed}
    class:serif={tool.glyph === "I" || tool.glyph === "“"}
    title={tool.title}
    aria-label={tool.title}
    aria-pressed={tool.pressed}
    disabled={tool.disabled}
    onmousedown={(event) => event.preventDefault()}
    onclick={tool.run}
  >
    {#if tool.glyph}
      {tool.glyph}
    {:else if tool.icon}
      <Icon name={tool.icon} />
    {/if}
  </button>
{/snippet}

{#snippet group(label: string, tools: Tool[])}
  <section class="group">
    <div class="tools">
      {#each tools as tool (tool.title)}
        {@render toolButton(tool)}
      {/each}
    </div>
    <p>{label}</p>
  </section>
{/snippet}

<style>
  .ribbon {
    display: flex;
    align-items: center;
    gap: 4px;
    height: var(--pv-toolbar-h);
    padding: 0 16px;
    flex: none;
    border-bottom: 1px solid var(--pv-line);
    background: var(--pv-chrome);
    color: var(--pv-text-2);
    overflow-x: auto;
  }

  .ribbon.expanded {
    align-items: stretch;
    height: auto;
    padding: 8px 12px 0;
    background: var(--pv-chrome-raised);
  }

  select {
    height: var(--pv-tool-h);
    border: 1px solid var(--pv-line-strong);
    background: var(--pv-field);
    color: var(--pv-text);
    border-radius: var(--pv-radius-xs);
    padding: 0 8px;
    font-size: var(--pv-text-md);
  }

  .expanded select {
    background: var(--pv-paper);
    color: var(--pv-ink);
  }

  .rule {
    width: 1px;
    height: 16px;
    background: var(--pv-line);
    margin: 0 4px;
    flex: none;
  }

  .spacer {
    flex: 1;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 0 8px;
    border-right: 1px solid var(--pv-divider);
  }

  .group.last {
    border-right: 0;
  }

  .tools {
    display: flex;
    gap: 2px;
    align-items: center;
    flex: 1;
  }

  .picks {
    gap: 4px;
  }

  .group p {
    margin: 0;
    padding-bottom: 5px;
    text-align: center;
    font-size: var(--pv-text-2xs);
    color: var(--pv-text-faint);
  }

  .tool,
  .more {
    display: grid;
    place-items: center;
    height: var(--pv-tool-h);
    border: 0;
    background: transparent;
    color: var(--pv-text-2);
    border-radius: var(--pv-radius-xs);
    padding: 0;
  }

  .tool {
    width: var(--pv-tool-w);
    font-size: var(--pv-text-lg);
    font-weight: 700;
  }

  .tool.serif {
    font-family: var(--pv-font-manuscript);
    font-weight: 400;
    font-size: 18px;
  }

  .tool.scene {
    width: auto;
    padding: 0 6px;
    font-size: 12px;
    letter-spacing: 2px;
    font-weight: 400;
  }

  .tool.color {
    font-weight: 600;
    box-shadow: inset 0 -3px var(--pv-accent);
  }

  .swatch {
    width: 13px;
    height: 11px;
    background: var(--pv-highlight, #f2dc8f);
    border: 1px solid var(--pv-highlight-edge, #d9bf63);
  }

  .tool.text {
    font-family: var(--pv-font-ui);
    font-size: 10px;
    font-weight: 600;
  }

  .tool.wide {
    width: auto;
    padding: 0 6px;
  }

  .link-form {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .problem {
    max-width: 16rem;
    font-size: var(--pv-text-sm);
    line-height: 1.3;
    color: var(--danger);
  }

  .link-form input {
    width: 12rem;
    height: var(--pv-tool-h);
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    padding: 0 8px;
  }

  .tool:hover:not(:disabled),
  .more:hover {
    background: var(--pv-selected);
  }

  .tool:active:not(:disabled) {
    background: var(--pv-pressed);
  }

  .tool.active {
    background: var(--pv-pressed);
    color: var(--pv-text);
  }

  .tool:disabled {
    color: var(--pv-empty);
  }

  .tool :global(svg) {
    width: 15px;
    height: 15px;
  }

  .more {
    display: flex;
    align-items: center;
    gap: 5px;
    width: auto;
    padding: 0 8px;
    font-size: var(--pv-text-md);
    font-weight: 400;
    color: var(--pv-text-muted);
  }

  .fewer {
    align-self: center;
    margin-bottom: 14px;
    background: var(--pv-pressed);
  }
</style>
