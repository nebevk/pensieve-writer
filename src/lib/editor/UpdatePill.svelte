<script lang="ts" module>
  /** A newer Pensieve waiting on GitHub Releases, as the window bars show it. */
  export type UpdateOffer = {
    version: string;
    /** How much is downloaded, 0 to 100, while it installs; null before. */
    progress: number | null;
    /** Why the last try didn't install, or "". */
    failed: string;
  };
</script>

<script lang="ts">
  import { t } from "$lib/ui.svelte";
  import Icon from "./Icon.svelte";

  let { offer, onUpdate }: { offer: UpdateOffer; onUpdate: () => void } = $props();
</script>

<!-- Shown only when there is something newer: one click saves everything, installs it and opens Pensieve again. -->
<button
  type="button"
  class="update"
  class:failed={!!offer.failed}
  disabled={offer.progress !== null}
  title={offer.failed || t("updateHint", { version: offer.version })}
  onclick={onUpdate}
>
  <Icon name="download" />
  {#if offer.progress !== null}
    {t("updateInstalling", { n: offer.progress })}
  {:else if offer.failed}
    {t("updateFailed")}
  {:else}
    {t("updateReady", { version: offer.version })}
  {/if}
</button>

<style>
  .update {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: none;
    height: 22px;
    padding: 0 9px;
    border: 1px solid color-mix(in oklch, var(--pv-accent) 45%, transparent);
    border-radius: 999px;
    background: color-mix(in oklch, var(--pv-accent) 10%, transparent);
    color: var(--pv-accent);
    font-size: var(--pv-text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .update:hover:not(:disabled) {
    background: color-mix(in oklch, var(--pv-accent) 18%, transparent);
  }

  .update:disabled {
    cursor: progress;
  }

  .update.failed {
    border-color: color-mix(in oklch, var(--pv-danger) 45%, transparent);
    background: transparent;
    color: var(--pv-danger);
  }

  .update :global(svg) {
    width: 13px;
    height: 13px;
  }
</style>
