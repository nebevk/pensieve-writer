<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { Editor } from "@tiptap/core";
  import type { ManuscriptFont } from "$lib/prefs";
  import { chooseImageFile } from "$lib/storage/backup";
  import { imageType, shrinkImage } from "./imageSize";
  import Icon from "./Icon.svelte";
  import { t } from "$lib/ui.svelte";

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
    loadNotes,
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
    /** The book's notes, for "Link a note". */
    loadNotes: () => Promise<{ id: string; title: string }[]>;
  } = $props();

  let expanded = $state(false);
  let linkOpen = $state(false);
  let notePicker = $state(false);
  let noteChoices = $state<{ id: string; title: string }[]>([]);
  let noteQuery = $state("");
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
    format(`${t("bold")} (Ctrl+B)`, (current) => current.isActive("bold"), (current) => current.chain().focus().toggleBold().run(), "B"),
    format(`${t("italic")} (Ctrl+I)`, (current) => current.isActive("italic"), (current) => current.chain().focus().toggleItalic().run(), "I"),
    format(`${t("underline")} (Ctrl+U)`, (current) => current.isActive("underline"), (current) => current.chain().focus().toggleUnderline().run(), "U"),
    format(t("strikethrough"), (current) => current.isActive("strike"), (current) => current.chain().focus().toggleStrike().run(), "S"),
  ]);

  const history = $derived([
    format(`${t("undo")} (Ctrl+Z)`, () => false, (current) => current.chain().focus().undo().run(), undefined, "undo", (current) => current.can().undo()),
    format(`${t("redo")} (Ctrl+Y)`, () => false, (current) => current.chain().focus().redo().run(), undefined, "redo", (current) => current.can().redo()),
  ]);

  const blocks = $derived([
    format(t("bulletedList"), (current) => current.isActive("bulletList"), (current) => current.chain().focus().toggleBulletList().run(), undefined, "list"),
    format(t("numberedList"), (current) => current.isActive("orderedList"), (current) => current.chain().focus().toggleOrderedList().run(), undefined, "listOrdered"),
    format(t("alignLeft"), (current) => current.isActive({ textAlign: "left" }), (current) => current.chain().focus().setTextAlign("left").run(), undefined, "alignLeft"),
    format(t("alignCenter"), (current) => current.isActive({ textAlign: "center" }), (current) => current.chain().focus().setTextAlign("center").run(), undefined, "alignCenter"),
    format(t("alignRight"), (current) => current.isActive({ textAlign: "right" }), (current) => current.chain().focus().setTextAlign("right").run(), undefined, "alignRight"),
    format(t("justify"), (current) => current.isActive({ textAlign: "justify" }), (current) => current.chain().focus().setTextAlign("justify").run(), undefined, "alignJustify"),
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

  const pickable = $derived(
    noteChoices.filter((note) => note.title.toLowerCase().includes(noteQuery.trim().toLowerCase())).slice(0, 12),
  );
  const onNoteLink = $derived(revision >= 0 && ready()?.isActive("noteLink") === true);

  async function openNotePicker() {
    if (notePicker) {
      notePicker = false;
      return;
    }
    noteQuery = "";
    notePicker = true;
    try {
      noteChoices = [...(await loadNotes())].sort((a, b) => a.title.localeCompare(b.title));
    } catch {
      noteChoices = [];
    }
  }

  /** Links the selected words to a note, or writes the note's name at the cursor as a link. */
  function linkNote(note: { id: string; title: string }) {
    const current = ready();
    notePicker = false;
    if (!current) return;
    const attrs = { noteId: note.id, title: note.title };
    if (current.state.selection.empty) {
      current.chain().focus().insertContent({ type: "text", text: note.title, marks: [{ type: "noteLink", attrs }] }).run();
    } else {
      current.chain().focus().setMark("noteLink", attrs).run();
    }
  }

  /** Adds a footnote after the cursor and selects it, so its note can be written straight away. */
  function insertFootnote() {
    const current = ready();
    if (!current) return;
    const at = current.state.selection.to;
    current.chain().focus().insertContentAt(at, { type: "footnote", attrs: { text: "" } }).setNodeSelection(at).run();
  }

  function unlinkNote() {
    notePicker = false;
    ready()?.chain().focus().extendMarkRange("noteLink").unsetMark("noteLink").run();
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
      imageProblem = t("pictureFailed", { error: error instanceof Error ? error.message : String(error) });
      if (problemTimer) clearTimeout(problemTimer);
      problemTimer = setTimeout(() => (imageProblem = ""), 8000);
    }
  }

  function clearFormatting() {
    ready()?.chain().focus().unsetAllMarks().clearNodes().run();
  }
</script>

<div class="ribbon" class:expanded role="toolbar" aria-label={t("writingTools")}>
  {#if !expanded}
    <select aria-label={t("paragraphStyle")} value={styleValue} onchange={(event) => applyStyle(event.currentTarget.value)}>
      <option value="p">{t("normalText")}</option>
      <option value="h1">{t("heading1")}</option>
      <option value="h2">{t("heading2")}</option>
      <option value="h3">{t("heading3")}</option>
    </select>
    <span class="rule"></span>
    {#each marks as tool (tool.title)}
      {@render toolButton(tool)}
    {/each}
    <span class="rule"></span>
    {@render toolButton(blocks[0])}
    {@render toolButton(blocks[2])}
    <button type="button" class="tool serif" title={t("blockQuote")} aria-label={t("blockQuote")} onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleBlockquote().run()}>“</button>
    <button type="button" class="tool scene" title={t("sceneBreak")} aria-label={t("sceneBreak")} onmousedown={(event) => event.preventDefault()} onclick={sceneBreak}>* *</button>
    <span class="rule"></span>
    <button type="button" class="more" onclick={() => (expanded = true)}>
      {t("allTools")}
      <Icon name="chevronDown" />
    </button>
    <span class="spacer"></span>
    <button type="button" class="tool" class:active={chaptersOpen} title={t("chapters")} aria-label={t("chapters")} aria-pressed={chaptersOpen} onclick={onToggleChapters}>
      <Icon name="chapters" />
    </button>
    <button type="button" class="tool" title={`${t("find")} (Ctrl+F)`} aria-label={t("find")} onmousedown={(event) => event.preventDefault()} onclick={onFind}>
      <Icon name="search" />
    </button>
  {:else}
    {@render group(t("groupHistory"), history)}
    <section class="group">
      <div class="tools picks">
        <select aria-label={t("paragraphStyle")} value={styleValue} onchange={(event) => applyStyle(event.currentTarget.value)}>
          <option value="p">{t("normalText")}</option>
          <option value="h1">{t("heading1")}</option>
          <option value="h2">{t("heading2")}</option>
          <option value="h3">{t("heading3")}</option>
        </select>
        <select aria-label={t("manuscriptFont")} value={manuscriptFont} onchange={(event) => onFont(event.currentTarget.value as ManuscriptFont)}>
          <option value="literata">Literata</option>
          <option value="garamond">Garamond</option>
          <option value="typewriter">{t("fontTypewriter")}</option>
        </select>
        <select aria-label={t("textSize")} value={manuscriptSize} onchange={(event) => onSize(Number(event.currentTarget.value))}>
          {#each [13, 15, 17, 19, 21, 24] as size (size)}
            <option value={size}>{size}</option>
          {/each}
        </select>
      </div>
      <p>{t("groupText")}</p>
    </section>
    <section class="group">
      <div class="tools">
        {#each marks as tool (tool.title)}
          {@render toolButton(tool)}
        {/each}
        <button type="button" class="tool" title={t("superscript")} aria-label={t("superscript")} onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleMark("superscript").run()}>x²</button>
        <button type="button" class="tool color" title={t("textColour")} aria-label={t("textColour")} onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleMark("textColor").run()}>A</button>
        <button type="button" class="tool" title={t("highlight")} aria-label={t("highlight")} onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleMark("highlight").run()}>
          <span class="swatch"></span>
        </button>
        <button type="button" class="tool" title={t("clearFormatting")} aria-label={t("clearFormatting")} onmousedown={(event) => event.preventDefault()} onclick={clearFormatting}>
          <Icon name="clearFormat" />
        </button>
      </div>
      <p>{t("groupFormat")}</p>
    </section>
    <section class="group">
      <div class="tools">
        {#each blocks as tool (tool.title)}
          {@render toolButton(tool)}
        {/each}
        <button type="button" class="tool" title={t("decreaseIndent")} aria-label={t("decreaseIndent")} onmousedown={(event) => event.preventDefault()} onclick={() => shiftIndent(-1)}><Icon name="outdent" /></button>
        <button type="button" class="tool" title={t("increaseIndent")} aria-label={t("increaseIndent")} onmousedown={(event) => event.preventDefault()} onclick={() => shiftIndent(1)}><Icon name="indent" /></button>
      </div>
      <p>{t("groupParagraph")}</p>
    </section>
    <section class="group">
      <div class="tools">
        <button type="button" class="tool serif" title={t("blockQuote")} aria-label={t("blockQuote")} onmousedown={(event) => event.preventDefault()} onclick={() => ready()?.chain().focus().toggleBlockquote().run()}>“</button>
        <button type="button" class="tool scene" title={t("sceneBreak")} aria-label={t("sceneBreak")} onmousedown={(event) => event.preventDefault()} onclick={sceneBreak}>* *</button>
        <button type="button" class="tool" title={t("image")} aria-label={t("image")} onmousedown={(event) => event.preventDefault()} onclick={() => void askImage()}><Icon name="image" /></button>
        <button type="button" class="tool" class:active={linkOpen} title={t("link")} aria-label={t("link")} aria-pressed={linkOpen} onmousedown={(event) => event.preventDefault()} onclick={() => (linkOpen = !linkOpen)}><Icon name="link" /></button>
        {#if linkOpen}
          <form
            class="link-form"
            onsubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <input bind:value={linkDraft} aria-label={t("linkAddress")} />
            <button type="submit" class="tool text wide">{t("add")}</button>
          </form>
        {/if}
        <button type="button" class="tool serif" title={t("footnote")} aria-label={t("footnote")} onmousedown={(event) => event.preventDefault()} onclick={insertFootnote}>¹</button>
        {#if imageProblem}
          <span class="problem" role="alert">{imageProblem}</span>
        {/if}
      </div>
      <p>{t("groupInsert")}</p>
    </section>
    <section class="group">
      <div class="tools">
        <button type="button" class="tool" title={t("newNote")} aria-label={t("newNote")} onclick={onNewNote}><Icon name="newNote" /></button>
        <button type="button" class="tool" title={t("addTodo")} aria-label={t("addTodo")} onclick={onAddTodo}><Icon name="listTodo" /></button>
        <span class="picker-wrap">
          <button type="button" class="tool note-link" class:active={notePicker || onNoteLink} title={t("linkNote")} aria-label={t("linkNote")} aria-expanded={notePicker} onmousedown={(event) => event.preventDefault()} onclick={() => void openNotePicker()}>[[ ]]</button>
          {#if notePicker}
            <div class="note-picker" role="dialog" aria-label={t("linkNote")}>
              <!-- svelte-ignore a11y_autofocus -->
              <input bind:value={noteQuery} placeholder={t("findNote")} aria-label={t("findNote")} autofocus />
              <ul>
                {#each pickable as note (note.id)}
                  <li><button type="button" onmousedown={(event) => event.preventDefault()} onclick={() => linkNote(note)}>{note.title}</button></li>
                {:else}
                  <li class="empty">{noteChoices.length ? t("notFound") : t("noNotesToLink")}</li>
                {/each}
              </ul>
              {#if onNoteLink}
                <button type="button" class="unlink" onmousedown={(event) => event.preventDefault()} onclick={unlinkNote}>{t("removeNoteLink")}</button>
              {/if}
            </div>
          {/if}
        </span>
        <button type="button" class="tool" class:active={notesOpen} title={t("notesPanel")} aria-label={t("notesPanel")} aria-pressed={notesOpen} onclick={onToggleNotes}><Icon name="notes" /></button>
        <button type="button" class="tool" class:active={todosOpen} title={t("todosPanel")} aria-label={t("todosPanel")} aria-pressed={todosOpen} onclick={onToggleTodos}><Icon name="todos" /></button>
      </div>
      <p>Pensieve</p>
    </section>
    <section class="group last">
      <div class="tools">
        <button type="button" class="tool" title={`${t("find")} (Ctrl+F)`} aria-label={t("find")} onmousedown={(event) => event.preventDefault()} onclick={onFind}><Icon name="search" /></button>
        <button type="button" class="tool" title={t("replace")} aria-label={t("replace")} onmousedown={(event) => event.preventDefault()} onclick={onReplace}><Icon name="replace" /></button>
      </div>
      <p>{t("groupFind")}</p>
    </section>
    <span class="spacer"></span>
    <button type="button" class="more fewer" onclick={() => (expanded = false)}>
      {t("fewerTools")}
      <Icon name="chevronUp" />
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
    /* A narrow window wraps the groups onto a second row instead of scrolling them sideways,
       and nothing clips the note picker below its button. */
    flex-wrap: wrap;
    row-gap: 6px;
    overflow: visible;
    position: relative;
    z-index: 5;
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
    padding: 0 5px;
    border-right: 1px solid var(--pv-divider);
  }

  .group.last {
    border-right: 0;
  }

  .tools {
    display: flex;
    gap: 1px;
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
    white-space: nowrap;
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

  .picker-wrap {
    position: relative;
  }

  .tool.note-link {
    width: auto;
    padding: 0 5px;
    white-space: nowrap;
    font-family: var(--pv-font-ui);
    font-size: var(--pv-text-sm);
    letter-spacing: 1px;
    color: var(--pv-accent);
  }

  .note-picker {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    width: 15rem;
    padding: 8px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-chrome);
    box-shadow: var(--pv-shadow-bar);
  }

  .note-picker input {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 6px;
    padding: 4px 6px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
  }

  .note-picker ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 14rem;
    overflow: auto;
  }

  .note-picker li button,
  .note-picker .unlink {
    width: 100%;
    padding: 5px 6px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    background: transparent;
    color: var(--pv-text);
    text-align: left;
    font-size: var(--pv-text-md);
  }

  .note-picker li button:hover,
  .note-picker .unlink:hover {
    background: var(--pv-selected);
  }

  .note-picker .empty {
    padding: 5px 6px;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-sm);
  }

  .note-picker .unlink {
    margin-top: 4px;
    border-top: 1px solid var(--pv-line);
    border-radius: 0;
    color: var(--pv-text-subtle);
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

  .more :global(svg) {
    width: 11px;
    height: 11px;
  }

  .fewer {
    align-self: center;
    margin-bottom: 14px;
    background: var(--pv-pressed);
  }
</style>
