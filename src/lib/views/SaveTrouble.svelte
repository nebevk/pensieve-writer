<script lang="ts">
  import Modal from "./Modal.svelte";
  import { t } from "$lib/ui.svelte";

  let {
    kept,
    message,
    onClose,
    onStay,
    onCopy,
    onSaveWord,
  }: {
    /** Whether a rescue copy holds what couldn't be saved. */
    kept: boolean;
    /** Why saving failed. */
    message: string;
    /** Closes Pensieve. */
    onClose: () => void;
    /** Keeps it open, to put right what stopped the save and try again. */
    onStay: () => void;
    /** Copies the text; true once it is on the clipboard. */
    onCopy: () => Promise<boolean>;
    /** Saves it as a Word file where she chooses; where it went, or "" when it didn't. */
    onSaveWord: () => Promise<string>;
  } = $props();

  // Without a rescue copy, Pensieve closes only once her words are out of it another way.
  let out = $state("");
  let busy = $state(false);

  async function copy() {
    busy = true;
    if (await onCopy()) out = t("textCopied");
    busy = false;
  }

  async function saveWord() {
    busy = true;
    const path = await onSaveWord();
    if (path) out = t("savedTo", { path });
    busy = false;
  }
</script>

<!-- Closing while saving fails (ARCH-1): asked once, and Pensieve closes once her words are safe. -->
<Modal title={t("saveTroubleTitle")} size="small" onClose={onStay}>
  <div class="body" role="alert">
    <p>{kept ? t("saveTroubleKept") : t("saveTroubleNotKept")}</p>
    <p class="hint">{t("saveTroubleWhy", { message })}</p>
    {#if out}
      <p class="out" role="status">{out}</p>
    {/if}
  </div>
  {#snippet foot()}
    {#if !kept}
      <button type="button" disabled={busy} onclick={copy}>{t("copyTheText")}</button>
      <button type="button" disabled={busy} onclick={saveWord}>{t("saveAsWordFile")}</button>
    {/if}
    <button type="button" disabled={busy} onclick={onStay}>{t("keepOpen")}</button>
    {#if kept || out}
      <button type="button" class="primary" disabled={busy} onclick={onClose}>{t("closePensieve")}</button>
    {/if}
  {/snippet}
</Modal>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px 20px 16px;
  }

  p {
    margin: 0;
    color: var(--pv-text);
    font-size: var(--pv-text-base);
    line-height: 1.5;
  }

  .hint {
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
  }

  .out {
    color: var(--pv-text-muted);
    font-size: var(--pv-text-md);
    overflow-wrap: anywhere;
  }
</style>
