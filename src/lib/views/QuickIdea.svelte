<script lang="ts">
  import Modal from "./Modal.svelte";
  import { t } from "$lib/ui.svelte";

  let {
    project,
    onSave,
    onClose,
  }: {
    /** The open project, whose Ideas the idea joins. */
    project: string;
    /** Keeps the idea; false when it couldn't be kept, and the window stays with what she wrote. */
    onSave: (text: string) => Promise<boolean>;
    onClose: () => void;
  } = $props();

  const formId = $props.id();
  let text = $state("");
  let busy = $state(false);

  async function save() {
    if (!text.trim() || busy) return;
    busy = true;
    const kept = await onSave(text);
    busy = false;
    if (kept) onClose();
  }
</script>

<!-- A quick idea from anywhere (owner, 12 October): Enter keeps it, Shift+Enter starts another line. -->
<Modal
  title={t("quickIdea")}
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
      void save();
    }}
  >
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      bind:value={text}
      rows="4"
      placeholder={t("ideaPlaceholder")}
      aria-label={t("quickIdea")}
      autofocus
      onkeydown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          void save();
        }
      }}
    ></textarea>
    <p class="hint">{t("ideaGoesTo", { project })}</p>
  </form>
  {#snippet foot()}
    <button type="button" disabled={busy} onclick={onClose}>{t("cancel")}</button>
    <button type="submit" form={formId} class="primary" disabled={!text.trim() || busy}>{t("save")}</button>
  {/snippet}
</Modal>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px 20px 16px;
  }

  textarea {
    resize: vertical;
    min-height: 96px;
    border: 1px solid var(--pv-line-strong);
    border-radius: var(--pv-radius-xs);
    background: var(--pv-field);
    color: var(--pv-text);
    padding: 10px 12px;
    font-family: var(--pv-font-manuscript);
    font-size: 16px;
    line-height: 1.5;
  }

  textarea:focus {
    outline: none;
    border-color: var(--pv-accent);
  }

  .hint {
    margin: 0;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
  }
</style>
