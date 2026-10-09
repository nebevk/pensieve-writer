<script lang="ts">
  import { onMount } from "svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import type { NoteTarget } from "$lib/editor/noteLinks";
  import type { DocumentJson } from "$lib/model";
  import type { Note, NoteCategory } from "$lib/storage/organize";
  import type { UiKey } from "$lib/i18n";
  import { ago, t } from "$lib/ui.svelte";
  import Modal from "./Modal.svelte";

  let {
    note,
    language = "en",
    fresh = false,
    docked = false,
    onPin,
    onUnpin,
    onEdit,
    onOpenLinked,
    onOpenInNotes,
    onClose,
  }: {
    note: Note;
    language?: "en" | "sl";
    /** A note just made: the keyboard goes to its title, ready to be named. */
    fresh?: boolean;
    /** Pinned in the panel beside the page, to write with it open. */
    docked?: boolean;
    onPin?: () => void;
    onUnpin?: () => void;
    /** A change to a note: this one, or the one whose words were last typed. */
    onEdit: (id: string, patch: Partial<Note>) => void;
    /** A [[link]] in the note, clicked. */
    onOpenLinked: (target: NoteTarget) => void;
    /** The note in Notes, with its fields, to-dos and where it appears. */
    onOpenInNotes: () => void;
    onClose: () => void;
  } = $props();

  const KINDS: { id: NoteCategory; key: UiKey }[] = [
    { id: "characters", key: "kindCharacter" },
    { id: "places", key: "kindPlace" },
    { id: "research", key: "kindResearch" },
    { id: "ideas", key: "kindNote" },
  ];

  let titleInput = $state<HTMLInputElement | undefined>(undefined);

  onMount(() => {
    if (!fresh) return;
    // After the window's own first focus, so the name is what the keyboard lands on.
    requestAnimationFrame(() => {
      titleInput?.focus();
      titleInput?.select();
    });
  });
</script>

<!-- A note opened while writing (owner, 9 October): read or changed here, over the page; Notes is a click away. -->
<Modal title={t("noteWindowTitle")} size="small" {docked} {onClose} {onPin} {onUnpin}>
  <div class="note" class:docked>
    <header>
      <select
        aria-label={t("noteKind")}
        value={note.category}
        onchange={(event) => onEdit(note.id, { category: event.currentTarget.value as NoteCategory })}
      >
        {#each KINDS as kind (kind.id)}
          <option value={kind.id}>{t(kind.key)}</option>
        {/each}
      </select>
      <span>{t("editedAgo", { ago: ago(note.updatedAt) })}</span>
    </header>
    <input
      class="title"
      bind:this={titleInput}
      aria-label={t("noteTitle")}
      value={note.title}
      oninput={(event) => onEdit(note.id, { title: event.currentTarget.value })}
    />
    <input
      class="tags"
      aria-label={t("shortDescription")}
      placeholder={t("shortDescriptionHint")}
      value={note.tags}
      oninput={(event) => onEdit(note.id, { tags: event.currentTarget.value })}
    />
    {#key note.id}
      <Editor
        docId={note.id}
        initialContent={note.contentJson}
        {language}
        focusOnOpen={!fresh && !docked}
        onChange={(json: DocumentJson, text: string, id?: string) => onEdit(id ?? note.id, { contentJson: json, plainText: text })}
        onEditor={() => {}}
        onActivity={() => {}}
        noteLinkBrackets
        onOpenNote={onOpenLinked}
      />
    {/key}
  </div>
  {#snippet foot()}
    <button type="button" onclick={onOpenInNotes}>{t("openInNotesView")}</button>
    <button type="button" class="primary" onclick={onClose}>{t("done")}</button>
  {/snippet}
</Modal>

<style>
  /* The note on paper, as in Notes. */
  .note {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 22px 36px 28px;
    background-color: var(--pv-paper);
    background-image: var(--pv-grain);
    color: var(--pv-ink);
    color-scheme: light;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1.5px solid var(--pv-ink-rule-accent);
    color: var(--pv-ink-muted);
    font-size: var(--pv-text-sm);
  }

  header select {
    border: 0;
    background: transparent;
    color: var(--pv-ink-accent);
    font-size: var(--pv-text-xs);
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .title,
  .tags {
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
  }

  .title {
    margin-top: 10px;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-2xl);
    font-weight: 400;
    color: var(--pv-ink);
  }

  .tags {
    margin: 4px 0 16px;
    color: var(--pv-ink-muted);
  }

  .tags::placeholder {
    color: var(--pv-ink-meta);
  }

  .note :global(.ProseMirror) {
    min-height: 9rem;
    font-size: 15px;
  }

  /* Pinned beside the page, in its narrow panel. */
  .note.docked {
    padding: 16px 18px 20px;
  }

  .docked .title {
    font-size: var(--pv-heading-xl);
  }
</style>
