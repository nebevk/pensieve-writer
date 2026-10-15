<script lang="ts">
  import Modal from "./Modal.svelte";
  import { t } from "$lib/ui.svelte";

  let {
    title,
    date,
    beside = false,
    onBringBack,
    onLater,
  }: {
    /** The writing the rescue copy holds. */
    title: string;
    /** When the copy was made, as she reads dates. */
    date: string;
    /** The writing has changed since: the copy comes back beside it, as a writing of its own. */
    beside?: boolean;
    /** Puts the copy's words back into the project. */
    onBringBack: () => Promise<void>;
    /** Asked again the next time Pensieve starts. */
    onLater: () => void;
  } = $props();

  let busy = $state(false);

  async function bringBack() {
    busy = true;
    await onBringBack();
    busy = false;
  }
</script>

<!-- A rescue copy from a time saving failed (ARCH-1), offered back when its project opens. -->
<Modal
  title={t("rescueTitle")}
  size="small"
  onClose={() => {
    if (!busy) onLater();
  }}
>
  <div class="body">
    {#if beside}
      <p>{t("rescueOfferBeside", { title, date })}</p>
    {:else}
      <p>{t("rescueOffer", { title, date })}</p>
      <p class="hint">{t("rescueHint")}</p>
    {/if}
  </div>
  {#snippet foot()}
    <button type="button" disabled={busy} onclick={onLater}>{t("notNow")}</button>
    <button type="button" class="primary" disabled={busy} onclick={bringBack}>{t("bringThemBack")}</button>
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
</style>
