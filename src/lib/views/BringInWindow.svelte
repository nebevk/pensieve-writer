<script lang="ts">
  import { untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import FoundInDocuments from "./FoundInDocuments.svelte";
  import { DocumentsRead } from "$lib/export/documentsRead.svelte";
  import { documentName, draftsFrom, type DocumentSource, type WritingDraft } from "$lib/export/importWriting";
  import type { WordImport } from "$lib/export/wordImport";
  import { plural, t } from "$lib/ui.svelte";

  let {
    mode,
    sources,
    project,
    writing = "",
    onePage = false,
    onAdd,
    onReplace,
    onClose,
  }: {
    /** New writings in the open project, or the open writing's chapters replaced by a document's. */
    mode: "add" | "replace";
    /** The documents chosen or dropped; Bring back from Word has one. */
    sources: DocumentSource[];
    /** The open project's name. */
    project: string;
    /** Bring back from Word: the writing it changes, and whether it is one page. */
    writing?: string;
    onePage?: boolean;
    onAdd: (drafts: WritingDraft[]) => Promise<void>;
    /** The document read, and its name. */
    onReplace: (read: WordImport, name: string) => Promise<void>;
    onClose: () => void;
  } = $props();

  const reader = new DocumentsRead();
  untrack(() => void reader.start(mode === "replace" ? sources.slice(0, 1) : sources));
  // Several documents: each its own writing, or one book with a chapter for each.
  let asBook = $state(false);
  let busy = $state(false);

  const bookTitle = $derived(sources[0] ? (sources[0].folder ?? documentName(sources[0].name)) : "");
  const drafts = $derived(draftsFrom(reader.read, asBook, bookTitle, t("untitled")));
  // A document with no text never replaces a writing: it would be left with nothing.
  const ready = $derived(!busy && !reader.reading && reader.read.length > 0 && (mode === "add" || reader.read[0].result.chapters.length > 0));
  const chosen = $derived(sources.length === 1 ? sources[0].name : `${bookTitle} · ${plural("fileCount", sources.length)}`);

  async function go() {
    if (!ready) return;
    busy = true;
    if (mode === "add") await onAdd(drafts);
    else await onReplace(reader.read[0].result, reader.read[0].name);
    busy = false;
  }
</script>

<!-- New writing from Word, and Bring back from Word (owner, 14 October): what the documents hold, then the change. -->
<Modal
  title={mode === "add" ? t("newWritingFromWordTitle") : t("bringBackTitle")}
  size="small"
  onClose={() => {
    if (!busy) onClose();
  }}
>
  <div class="body">
    <p class="chosen" title={sources.map((source) => source.name).join(", ")}>{chosen}</p>
    {#if mode === "replace"}
      <p class="note">{t(onePage ? "bringBackPage" : "bringBackChapters", { title: writing })}</p>
    {/if}
    {#if mode === "add" && reader.read.length > 1}
      <div class="each">
        <label class="choice"><input type="radio" name="each" value={false} bind:group={asBook} disabled={busy} />{t("eachWriting")}</label>
        <label class="choice"><input type="radio" name="each" value={true} bind:group={asBook} disabled={busy} />{t("eachChapter")}</label>
      </div>
    {/if}
    <FoundInDocuments {reader} {drafts} />
  </div>
  {#snippet foot()}
    <button type="button" disabled={busy} onclick={onClose}>{t("cancel")}</button>
    <button type="button" class="primary" disabled={!ready} onclick={() => void go()}>
      {mode === "add" ? t("addToProject", { project }) : t("replace")}
    </button>
  {/snippet}
</Modal>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    overflow: auto;
    padding: 18px 20px 20px;
  }

  p {
    margin: 0;
  }

  .chosen {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--pv-text);
    font-weight: 600;
  }

  .note {
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
    line-height: 1.45;
  }

  .each {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--pv-text);
    font-size: var(--pv-text-base);
  }

  .choice input {
    margin: 0;
    accent-color: var(--pv-accent-solid);
  }
</style>
