<script lang="ts">
  import { onMount } from "svelte";
  import Editor from "$lib/editor/Editor.svelte";
  import Icon from "$lib/editor/Icon.svelte";
  import type { NoteTarget } from "$lib/editor/noteLinks";
  import type { DocumentJson } from "$lib/model";
  import type { Note, NoteCategory } from "$lib/storage/organize";
  import type { UiKey } from "$lib/i18n";
  import { ago, t } from "$lib/ui.svelte";

  let {
    note,
    language = "en",
    fresh = false,
    index = -1,
    total = 0,
    onEdit,
    onOpenLinked,
    onBack,
    onPrevious,
    onNext,
    onOpenInNotes,
    onClose,
  }: {
    note: Note;
    language?: "en" | "sl";
    /** A note just made: the keyboard goes to its title, ready to be named. */
    fresh?: boolean;
    /** Where the note is in the panel's list (-1 when it isn't), and how long the list is. */
    index?: number;
    total?: number;
    /** A change to a note: this one, or the one whose words were last typed. */
    onEdit: (id: string, patch: Partial<Note>) => void;
    /** A [[link]] in the note, clicked. */
    onOpenLinked: (target: NoteTarget) => void;
    /** Back to the panel's list of notes. */
    onBack: () => void;
    /** The list's note before or after this one; none at either end. */
    onPrevious?: () => void;
    onNext?: () => void;
    /** The note in Notes, with its fields, to-dos and where it appears. */
    onOpenInNotes: () => void;
    /** Folds the panel away. */
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
    // A new note is named first; any other opens without taking the keyboard from the page.
    if (fresh) {
      titleInput?.focus();
      titleInput?.select();
    }
  });
</script>

<!-- One note beside the page (owner, 12 October): read and written here while the page stays free. -->
<aside class="pane" aria-label={note.title}>
  <header>
    <button type="button" class="back" title={t("backToNotes")} onclick={onBack}>
      <Icon name="arrowLeft" />{t("notes")}
    </button>
    {#if index >= 0 && total > 1}
      <button type="button" class="icon" title={t("previousNote")} aria-label={t("previousNote")} disabled={!onPrevious} onclick={() => onPrevious?.()}>
        <Icon name="chevronLeft" />
      </button>
      <span class="count">{index + 1} / {total}</span>
      <button type="button" class="icon" title={t("nextNote")} aria-label={t("nextNote")} disabled={!onNext} onclick={() => onNext?.()}>
        <Icon name="chevronRight" />
      </button>
    {/if}
    <button type="button" class="icon close" title={t("hidePanel")} aria-label={t("hidePanel")} onclick={onClose}>
      <Icon name="panelRightClose" />
    </button>
  </header>
  <div class="note">
    <div class="meta">
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
    </div>
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
    <Editor
      docId={note.id}
      initialContent={note.contentJson}
      {language}
      focusOnOpen={false}
      onChange={(json: DocumentJson, text: string, id?: string) => onEdit(id ?? note.id, { contentJson: json, plainText: text })}
      onEditor={() => {}}
      onActivity={() => {}}
      noteLinkBrackets
      onOpenNote={onOpenLinked}
    />
  </div>
  <footer>
    <button type="button" class="open" onclick={onOpenInNotes}>{t("openInNotesView")}</button>
  </footer>
</aside>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--pv-chrome);
    border-left: 1px solid var(--pv-line);
  }

  header {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
    padding: 12px 10px 10px 12px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: auto;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 4px 8px 4px 4px;
    background: transparent;
    color: var(--pv-text);
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-sm);
  }

  .icon {
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 4px;
    background: transparent;
    color: var(--pv-text-subtle);
  }

  .icon:disabled {
    opacity: 0.35;
  }

  .back:hover,
  .icon:hover:not(:disabled) {
    background: var(--pv-selected);
  }

  .back:active,
  .icon:active:not(:disabled) {
    background: var(--pv-pressed);
  }

  .back :global(svg),
  .icon :global(svg) {
    width: 15px;
    height: 15px;
  }

  .count {
    min-width: 3.2em;
    text-align: center;
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
    font-variant-numeric: tabular-nums;
  }

  .close {
    margin-left: 4px;
  }

  /* The note on paper, as in Notes. */
  .note {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0 10px;
    padding: 16px 18px 20px;
    background-color: var(--pv-paper);
    background-image: var(--pv-grain);
    box-shadow: var(--pv-shadow-card);
    color: var(--pv-ink);
    color-scheme: light;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1.5px solid var(--pv-ink-rule-accent);
    color: var(--pv-ink-muted);
    font-size: var(--pv-text-sm);
  }

  .meta select {
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
    font-size: var(--pv-heading-xl);
    font-weight: 400;
    color: var(--pv-ink);
  }

  .tags {
    margin: 4px 0 14px;
    color: var(--pv-ink-muted);
  }

  .tags::placeholder {
    color: var(--pv-ink-meta);
  }

  .note :global(.ProseMirror) {
    min-height: 9rem;
    font-size: 15px;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    flex: none;
    padding: 10px 10px 12px;
  }

  .open {
    height: 30px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    padding: 0 12px;
    background: var(--pv-field);
    color: var(--pv-text);
  }

  .open:hover {
    background: var(--pv-selected);
  }

  .open:active {
    background: var(--pv-pressed);
  }
</style>
