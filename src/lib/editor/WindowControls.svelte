<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { t } from "$lib/ui.svelte";

  // The app draws its own window bar (WIN-1), so it needs the buttons Windows would show.
  // Close goes through the window's close request, so the book is saved and backed up first.
  const inWindow = isTauri();
  let maximized = $state(false);

  onMount(() => {
    if (!inWindow) return;
    const win = getCurrentWindow();
    let stop: (() => void) | undefined;
    let disposed = false;
    let timer = 0;
    const check = () => {
      void win
        .isMaximized()
        .then((value) => (maximized = value))
        .catch(() => undefined);
    };
    check();
    // Resizing sends a stream of events; ask once it settles.
    void win
      .onResized(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(check, 120);
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      stop?.();
    };
  });

  function run(action: (win: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
    void action(getCurrentWindow()).catch(() => undefined);
  }
</script>

{#if inWindow}
  <div class="controls">
    <button type="button" title={t("minimise")} aria-label={t("minimise")} onclick={() => run((win) => win.minimize())}>
      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5.5h10" /></svg>
    </button>
    <button
      type="button"
      title={maximized ? t("restoreWindow") : t("maximise")}
      aria-label={maximized ? t("restoreWindow") : t("maximise")}
      onclick={() => run((win) => win.toggleMaximize())}
    >
      {#if maximized}
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M.5 2.5h7v7h-7z M2.5 2.5V.5h7v7h-2" /></svg>
      {:else}
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M.5 .5h9v9h-9z" /></svg>
      {/if}
    </button>
    <button type="button" class="close" title={t("close")} aria-label={t("close")} onclick={() => run((win) => win.close())}>
      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M.5 .5l9 9M9.5 .5l-9 9" /></svg>
    </button>
  </div>
{/if}

<style>
  .controls {
    display: flex;
    align-self: flex-start;
    height: var(--pv-titlebar-h);
    flex: none;
  }

  button {
    display: grid;
    place-items: center;
    width: 46px;
    height: 100%;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    color: var(--pv-text-muted);
  }

  button:hover {
    background: var(--pv-selected);
    color: var(--pv-text);
  }

  button:active {
    background: var(--pv-pressed);
  }

  /* Windows' own close colour, so it reads as the window's close button in every theme. */
  .close:hover {
    background: #c42b1c;
    color: #fff;
  }

  .close:active {
    background: #b0281a;
    color: #fff;
  }

  button:focus-visible {
    outline-offset: -2px;
  }

  svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  .close svg {
    shape-rendering: geometricPrecision;
  }
</style>
