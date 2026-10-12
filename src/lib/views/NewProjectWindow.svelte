<script module lang="ts">
  /** How a new project starts: empty, or from a file, or from a folder of files. */
  export type ProjectStart =
    | { kind: "empty" }
    | { kind: "file"; path: string }
    | { kind: "folder"; path: string; files: string[]; each: "writing" | "chapter" };

  export type ProjectRequest = { name: string; parent: string; start: ProjectStart };
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import { lastName } from "$lib/chapters/library";
  import { documentName } from "$lib/export/importWriting";
  import { plural, t } from "$lib/ui.svelte";

  let {
    places,
    parent,
    onChooseFile,
    onChooseFolder,
    onCreate,
    onClose,
  }: {
    /** Where the project can go: the library's top first, then its folders. */
    places: { path: string; label: string }[];
    /** The folder it was asked for in. */
    parent: string;
    onChooseFile: () => Promise<string | null>;
    /** A folder, with its Word, text and Markdown files in order. */
    onChooseFolder: () => Promise<{ path: string; files: string[] } | null>;
    /** Makes the project and opens it; returns what is wrong, or null. */
    onCreate: (request: ProjectRequest, progress: (done: number, total: number) => void) => Promise<string | null>;
    onClose: () => void;
  } = $props();

  const formId = $props.id();
  const placeOf = (path: string) => places.find((place) => place.path.toLowerCase() === path.toLowerCase())?.path;
  let name = $state("");
  // Once she types a name, a file or folder chosen after it doesn't change it.
  let typed = false;
  // Where it was asked for, once: she may choose another folder.
  let where = $state(untrack(() => placeOf(parent) ?? places[0]?.path ?? ""));
  let start = $state<"empty" | "file" | "folder">("empty");
  let file = $state("");
  let folder = $state<{ path: string; files: string[] } | null>(null);
  let each = $state<"writing" | "chapter">("writing");
  let busy = $state(false);
  let progress = $state<{ done: number; total: number } | null>(null);
  let problem = $state("");

  const ready = $derived(
    !busy && name.trim() !== "" && (start === "empty" || (start === "file" ? file !== "" : !!folder && folder.files.length > 0)),
  );

  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

  async function chooseFile() {
    problem = "";
    try {
      const path = await onChooseFile();
      if (!path) return;
      file = path;
      start = "file";
      if (!typed) name = documentName(path);
    } catch (error) {
      problem = message(error);
    }
  }

  async function chooseFolder() {
    problem = "";
    try {
      const found = await onChooseFolder();
      if (!found) return;
      folder = found;
      start = "folder";
      if (!typed) name = lastName(found.path);
    } catch (error) {
      problem = message(error);
    }
  }

  async function create() {
    if (!ready) return;
    busy = true;
    problem = "";
    const begin: ProjectStart =
      start === "file"
        ? { kind: "file", path: file }
        : start === "folder" && folder
          ? { kind: "folder", path: folder.path, files: folder.files, each }
          : { kind: "empty" };
    const result = await onCreate({ name: name.trim(), parent: where, start: begin }, (done, total) => (progress = { done, total }));
    busy = false;
    progress = null;
    problem = result ?? "";
  }
</script>

<!-- New project: a name, where it goes, and what it starts with (owner, 12 October). -->
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
      <label class="choice"><input type="radio" name="start" value="empty" bind:group={start} />{t("startEmpty")}</label>
      <label class="choice"><input type="radio" name="start" value="file" bind:group={start} />{t("startFile")}</label>
      {#if start === "file"}
        <div class="more">
          <p class="hint">{t("startFileHint")}</p>
          <div class="pick">
            <button type="button" onclick={() => void chooseFile()}>{t("chooseFile")}</button>
            {#if file}<span class="chosen" title={file}>{lastName(file)}</span>{/if}
          </div>
        </div>
      {/if}
      <label class="choice"><input type="radio" name="start" value="folder" bind:group={start} />{t("startFolder")}</label>
      {#if start === "folder"}
        <div class="more">
          <p class="hint">{t("startFolderHint")}</p>
          <div class="pick">
            <button type="button" onclick={() => void chooseFolder()}>{t("chooseFolderOfFiles")}</button>
            {#if folder}<span class="chosen" title={folder.path}>{lastName(folder.path)} · {plural("fileCount", folder.files.length)}</span>{/if}
          </div>
          {#if folder && folder.files.length === 0}
            <p class="problem">{t("noDocumentsInFolder")}</p>
          {:else}
            <label class="choice"><input type="radio" name="each" value="writing" bind:group={each} />{t("eachWriting")}</label>
            <label class="choice"><input type="radio" name="each" value="chapter" bind:group={each} />{t("eachChapter")}</label>
          {/if}
        </div>
      {/if}
    </fieldset>
    {#if problem}
      <p class="problem" role="alert">{problem}</p>
    {/if}
  </form>
  {#snippet foot()}
    {#if progress}
      <p class="say">{t("readingFiles", { done: progress.done, total: progress.total })}</p>
    {/if}
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
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
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

  /* What the chosen start asks for, under it. */
  .more {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 0 4px 21px;
  }

  .hint {
    margin: 0;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
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

  .problem {
    margin: 0;
    color: var(--pv-danger);
    font-size: var(--pv-text-md);
  }
</style>
