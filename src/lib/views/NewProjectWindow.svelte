<script module lang="ts">
  import type { WritingDraft } from "$lib/export/importWriting";

  /** A new project: its name, the folder it goes in, and its writings (none for a blank page). */
  export type ProjectRequest = { name: string; parent: string; drafts: WritingDraft[]; failed: string[] };
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import FoundInDocuments from "./FoundInDocuments.svelte";
  import { DocumentsRead } from "$lib/export/documentsRead.svelte";
  import { documentName, draftsFrom, type DocumentSource } from "$lib/export/importWriting";
  import { plural, t } from "$lib/ui.svelte";

  let {
    places,
    parent,
    dropped = [],
    onChooseDocuments,
    onCreate,
    onClose,
  }: {
    /** Where the project can go: the library's top first, then its folders. */
    places: { path: string; label: string }[];
    /** The folder it was asked for in. */
    parent: string;
    /** Documents dropped on Home, which opened the window: it starts from them. */
    dropped?: DocumentSource[];
    /** Word, text or Markdown files she picks, one or several. */
    onChooseDocuments: () => Promise<DocumentSource[]>;
    /** Makes the project and opens it; returns what is wrong, or null. */
    onCreate: (request: ProjectRequest) => Promise<string | null>;
    onClose: () => void;
  } = $props();

  const formId = $props.id();
  const placeOf = (path: string) => places.find((place) => place.path.toLowerCase() === path.toLowerCase())?.path;
  let name = $state("");
  // Once she types a name, documents chosen after it don't change it.
  let typed = false;
  // Where it was asked for, once: she may choose another folder.
  let where = $state(untrack(() => placeOf(parent) ?? places[0]?.path ?? ""));
  let start = $state<"empty" | "word">("empty");
  const reader = new DocumentsRead();
  // Several documents: each its own writing, or one book with a chapter for each.
  let asBook = $state(false);
  let busy = $state(false);
  let problem = $state("");

  const drafts = $derived(start === "word" ? draftsFrom(reader.read, asBook, name.trim() || t("untitled"), t("untitled")) : []);
  const ready = $derived(!busy && name.trim() !== "" && (start === "empty" || (!reader.reading && reader.read.length > 0)));
  const chosen = $derived(
    reader.sources.length === 1 ? reader.sources[0].name : reader.sources.length > 1 ? `${reader.sources[0].folder ?? reader.sources[0].name} · ${plural("fileCount", reader.sources.length)}` : "",
  );

  /** Documents chosen or dropped: read at once, and the project named after them, unless she named it. */
  function take(sources: DocumentSource[]) {
    if (sources.length === 0) return;
    start = "word";
    problem = "";
    if (!typed) name = sources.length > 1 && sources[0].folder ? sources[0].folder : documentName(sources[0].name);
    void reader.start(sources);
  }

  untrack(() => take(dropped));

  async function choose() {
    problem = "";
    try {
      take(await onChooseDocuments());
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
  }

  async function create() {
    if (!ready) return;
    busy = true;
    problem = "";
    const result = await onCreate({ name: name.trim(), parent: where, drafts, failed: reader.failed.map((item) => item.name) });
    busy = false;
    problem = result ?? "";
  }
</script>

<!-- New project (owner, 12 October; two starts, 14 October): a name, where it goes, a blank page or Word. -->
<Modal
  title={t("newProjectTitle")}
  size="small"
  onClose={() => {
    if (!busy) onClose();
  }}
>
  <form
    id={formId}
    class="body"
    onsubmit={(event) => {
      event.preventDefault();
      void create();
    }}
  >
    <p class="intro">{t("newProjectIntro")}</p>
    <label class="field">
      {t("newProjectName")}
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={name} oninput={() => (typed = true)} disabled={busy} autofocus />
    </label>
    {#if places.length > 1}
      <label class="field">
        {t("newProjectWhere")}
        <select bind:value={where} disabled={busy}>
          {#each places as place (place.path)}
            <option value={place.path}>{place.label}</option>
          {/each}
        </select>
      </label>
    {/if}
    <fieldset disabled={busy}>
      <legend>{t("newProjectStart")}</legend>
      <div class="starts">
        <label class="start" class:on={start === "empty"}>
          <input type="radio" name="start" value="empty" bind:group={start} />
          <span class="what"><b>{t("startEmpty")}</b>{t("startEmptyNote")}</span>
        </label>
        <label class="start" class:on={start === "word"}>
          <input type="radio" name="start" value="word" bind:group={start} />
          <span class="what"><b>{t("startWord")}</b>{t("startWordNote")}</span>
        </label>
      </div>
      {#if start === "word"}
        <div class="from">
          <div class="pick">
            <button type="button" onclick={() => void choose()}>{t("chooseDocuments")}</button>
            {#if chosen}<span class="chosen" title={reader.sources.map((source) => source.name).join(", ")}>{chosen}</span>{/if}
          </div>
          {#if reader.read.length > 1}
            <div class="each">
              <label class="choice"><input type="radio" name="each" value={false} bind:group={asBook} />{t("eachWriting")}</label>
              <label class="choice"><input type="radio" name="each" value={true} bind:group={asBook} />{t("eachChapter")}</label>
            </div>
          {/if}
          {#if reader.sources.length > 0}
            <FoundInDocuments {reader} {drafts} />
          {/if}
        </div>
      {/if}
    </fieldset>
    {#if problem}
      <p class="problem" role="alert">{problem}</p>
    {/if}
  </form>
  {#snippet foot()}
    <button type="button" disabled={busy} onclick={onClose}>{t("cancel")}</button>
    <button type="submit" form={formId} class="primary" disabled={!ready}>{busy ? t("creatingProject") : t("createProject")}</button>
  {/snippet}
</Modal>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
    overflow: auto;
    padding: 18px 20px 20px;
  }

  .intro {
    margin: 0;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
  }

  .field,
  legend {
    font-size: var(--pv-text-md);
    font-weight: 600;
    color: var(--pv-text-muted);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field input,
  .field select {
    height: 32px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    padding: 0 8px;
    font-size: var(--pv-text-base);
    font-weight: 400;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
  }

  /* The two starts side by side, each saying what it makes. */
  .starts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .start {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
    line-height: 1.4;
    cursor: pointer;
    transition: border-color var(--pv-dur-fast) ease, background-color var(--pv-dur-fast) ease;
  }

  .start:hover {
    background: var(--pv-selected);
  }

  .start.on {
    border-color: var(--pv-accent);
    box-shadow: inset 0 0 0 1px var(--pv-accent);
  }

  .start:focus-within {
    outline: 2px solid var(--pv-accent);
    outline-offset: 2px;
  }

  .what {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .what b {
    color: var(--pv-text);
    font-size: var(--pv-text-base);
    font-weight: 600;
  }

  .start input,
  .choice input {
    margin: 2px 0 0;
    accent-color: var(--pv-accent-solid);
  }

  /* What From Word asks for, under the two starts. */
  .from {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .pick button {
    flex: none;
    height: 30px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
    color: var(--pv-text);
    padding: 0 12px;
  }

  .pick button:hover:not(:disabled) {
    background: var(--pv-selected);
  }

  .pick button:active:not(:disabled) {
    background: var(--pv-pressed);
  }

  .chosen {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--pv-text);
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
  }

  .problem {
    margin: 0;
    color: var(--pv-danger);
    font-size: var(--pv-text-md);
  }
</style>
