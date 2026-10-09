<script lang="ts">
  import type { SnapshotInfo } from "$lib/model";
  import { locale, snapshotName, t } from "$lib/ui.svelte";
  import Modal from "./Modal.svelte";

  let {
    snapshots,
    chosen = "",
    preview = null,
    family,
    onPick,
    onRestoreChapter,
    onRestoreBook,
    onClose,
  }: {
    /** The book's snapshots, newest first. */
    snapshots: SnapshotInfo[];
    /** The snapshot being looked at, or "" before she picks one. */
    chosen?: string;
    /** The open chapter as it was in the chosen snapshot, "missing" when the snapshot hasn't it, null while it is read. */
    preview?: { title: string; text: string } | "missing" | null;
    /** The manuscript's font, so the older text reads as the page does. */
    family: string;
    onPick: (id: string) => void;
    onRestoreChapter: () => void;
    onRestoreBook: () => void;
    onClose: () => void;
  } = $props();

  // Restoring the whole book asks once more before it happens.
  let bookAsked = $state(false);

  const when = (snap: SnapshotInfo) =>
    new Date(snap.createdAt).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });
  const picked = $derived(snapshots.find((snap) => snap.id === chosen) ?? null);
</script>

<!-- Earlier versions (SV-3, SV-4) in a window like Settings (owner, 9 October): the snapshots down the side,
     the open chapter as it was in the one picked, and the restores at the foot. -->
<Modal title={t("earlierVersions")} {onClose}>
  <div class="history">
    <div class="snaps">
      {#each snapshots as snap (snap.id)}
        <button
          type="button"
          aria-pressed={snap.id === chosen}
          onclick={() => {
            bookAsked = false;
            onPick(snap.id);
          }}
        >
          <span class="date">{when(snap)}</span>
          <span class="kind">{snapshotName(snap.kind)}</span>
        </button>
      {:else}
        <p class="none">{t("noSnapshots")}</p>
      {/each}
    </div>
    <div class="then">
      {#if !picked}
        <p class="hint">{t("earlierVersionsHint")}</p>
      {:else if preview === "missing"}
        <p class="hint">{t("snapshotLacksChapter")}</p>
      {:else if preview}
        <p class="as-was">{t("asItWas", { when: when(picked) })}</p>
        <h2>{preview.title}</h2>
        <div class="text" style:font-family={family}>{preview.text}</div>
      {/if}
    </div>
  </div>
  {#snippet foot()}
    {#if bookAsked}
      <p class="say">{t("restoreBookConfirm")}</p>
      <button type="button" onclick={() => (bookAsked = false)}>{t("cancel")}</button>
      <button type="button" class="primary" onclick={onRestoreBook}>{t("restoreBook")}</button>
    {:else}
      <button type="button" disabled={!picked} onclick={() => (bookAsked = true)}>{t("restoreBook")}</button>
      <button type="button" class="primary" disabled={!picked || !preview || preview === "missing"} onclick={onRestoreChapter}>
        {t("restoreChapter")}
      </button>
    {/if}
  {/snippet}
</Modal>

<style>
  .history {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .snaps {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: none;
    width: 250px;
    overflow: auto;
    padding: 12px 10px;
    border-right: 1px solid var(--pv-line);
  }

  .snaps button {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: none;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 7px 10px;
    background: transparent;
    color: var(--pv-text);
    text-align: left;
    font-size: var(--pv-text-base);
  }

  .snaps button:hover {
    background: var(--pv-selected);
  }

  .snaps button:active {
    background: var(--pv-pressed);
  }

  /* The snapshot being looked at, so it's clear which one a restore takes. */
  .snaps button[aria-pressed="true"] {
    background: var(--pv-selected);
    font-weight: 600;
  }

  .kind {
    font-size: var(--pv-text-sm);
    font-weight: 400;
    color: var(--pv-text-faint);
  }

  .none {
    margin: 4px 10px;
    color: var(--pv-text-muted);
  }

  .then {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 22px 36px 28px;
  }

  .hint {
    max-width: 30rem;
    margin: 40px auto 0;
    text-align: center;
    color: var(--pv-text-subtle);
    font-size: var(--pv-text-md);
    line-height: 1.5;
  }

  .as-was {
    margin: 0 0 4px;
    font-size: var(--pv-text-sm);
    color: var(--pv-text-faint);
  }

  h2 {
    margin: 0 0 14px;
    font-family: var(--pv-font-heading);
    font-size: var(--pv-heading-xl);
    font-weight: 400;
  }

  .text {
    white-space: pre-wrap;
    font-size: 1.05rem;
    line-height: 1.6;
    color: var(--pv-text);
  }
</style>
