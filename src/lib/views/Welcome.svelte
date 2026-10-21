<script lang="ts">
  import BrandMark from "$lib/editor/BrandMark.svelte";
  import { APP_NAME } from "$lib/edition";
  import type { UiKey } from "$lib/i18n";
  import type { ThemeName } from "$lib/prefs";
  import { t } from "$lib/ui.svelte";
  import Modal from "./Modal.svelte";

  let {
    theme,
    appearance,
    onTheme,
    onDone,
  }: {
    /** The look she has chosen, which the last step marks. */
    theme: ThemeName;
    /** The look on now, which the pictures follow. */
    appearance: Exclude<ThemeName, "sunset">;
    onTheme: (theme: ThemeName) => void;
    /** Closed, skipped or finished: it isn't shown again. */
    onDone: () => void;
  } = $props();

  // The owner's art (13 October): the scene, a page above the basin, the five marks.
  const STEPS: { title: UiKey; text: UiKey }[] = [
    { title: "welcomeHeading", text: "welcomeText" },
    { title: "welcomeWritingTitle", text: "welcomeWritingText" },
    { title: "welcomeLookTitle", text: "welcomeLookText" },
  ];
  const LOOKS: [Exclude<ThemeName, "sunset">, UiKey][] = [
    ["daylight", "themeDaylight"],
    ["dusk", "themeDusk"],
    ["candlelit", "themeCandlelit"],
    ["moonlit", "themeMoonlit"],
    ["forest", "themeForest"],
  ];

  let step = $state(0);
  const last = $derived(step === STEPS.length - 1);
  // The design calls the Sunset look "sunset"; to Pensieve, "sunset" is Day and night.
  const art = $derived(`/art/onboarding/onboarding-${step + 1}-${appearance === "dusk" ? "sunset" : appearance}.svg`);
</script>

<!-- The first time Pensieve opens (owner, 13 October): three steps, then the tips. -->
<Modal title={APP_NAME} size="small" onClose={onDone}>
  <div class="welcome">
    <img class="art" src={art} width="800" height="480" alt="" />
    <div class="words" aria-live="polite">
      <h2>{t(STEPS[step].title)}</h2>
      <p>{t(STEPS[step].text)}</p>
    </div>
    {#if last}
      <div class="looks" role="radiogroup" aria-label={t("welcomeLookTitle")}>
        {#each LOOKS as [look, name] (look)}
          <button type="button" role="radio" aria-checked={theme === look} class:on={theme === look} onclick={() => onTheme(look)}>
            <BrandMark appearance={look} size={30} />
            <span>{t(name)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  {#snippet foot()}
    <span class="dots" role="img" aria-label={t("welcomeStep", { n: step + 1 })}>
      {#each STEPS as item, index (item.title)}
        <span class:on={index === step}></span>
      {/each}
    </span>
    {#if !last}
      <button type="button" class="skip" onclick={onDone}>{t("welcomeSkip")}</button>
    {/if}
    {#if step > 0}
      <button type="button" onclick={() => (step -= 1)}>{t("tipBack")}</button>
    {/if}
    {#if last}
      <button type="button" class="primary" onclick={onDone}>{t("welcomeStart")}</button>
    {:else}
      <!-- svelte-ignore a11y_autofocus -->
      <button type="button" class="primary" autofocus onclick={() => (step += 1)}>{t("tipNext")}</button>
    {/if}
  {/snippet}
</Modal>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
  }

  /* The picture across the window, a little shorter than drawn so the words keep their room. */
  .art {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 800 / 400;
    object-fit: cover;
    background: var(--pv-desk);
  }

  .words {
    padding: 18px 28px 20px;
  }

  h2 {
    margin: 0 0 6px;
    font-family: var(--pv-font-heading);
    font-size: 22px;
    font-weight: 500;
    color: var(--pv-text);
  }

  p {
    margin: 0;
    color: var(--pv-text-muted);
    font-size: var(--pv-text-base);
    line-height: 1.5;
  }

  .looks {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    padding: 0 28px 20px;
  }

  .looks button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 4px 8px;
    border: 1px solid var(--pv-line);
    border-radius: var(--pv-radius-sm);
    background: var(--pv-field);
    color: var(--pv-text);
    font-size: var(--pv-text-sm);
  }

  .looks button:hover {
    background: var(--pv-selected);
  }

  .looks button.on {
    border-color: var(--pv-accent-solid);
    box-shadow: 0 0 0 1px var(--pv-accent-solid);
  }

  /* Where she is in the three steps, at the foot's left. */
  .dots {
    display: flex;
    gap: 6px;
    margin-right: auto;
  }

  .dots span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--pv-line-strong);
  }

  .dots span.on {
    background: var(--pv-accent-solid);
  }

  :global(.window footer button.skip) {
    border-color: transparent;
    background: transparent;
    color: var(--pv-text-muted);
  }
</style>
