<script lang="ts">
  import type { ThemeName } from "$lib/prefs";

  let {
    appearance,
    size = 24,
    animated = false,
  }: {
    appearance: Exclude<ThemeName, "sunset">;
    size?: number;
    /** What rises from the basin moves: on Home only, so the page she types on stays still. */
    animated?: boolean;
  } = $props();

  // The design calls the Sunset look "sunset"; to Pensieve, "sunset" is Day and night.
  const name = $derived(appearance === "dusk" ? "sunset" : appearance);
</script>

<!-- The Basin mark (owner's design, 12 October): the basin stays, what rises from it follows the theme. -->
{#if animated}
  <picture>
    <!-- With Windows' animations off, it stands still. -->
    <source srcset="/brand/pensieve-mark-{name}.svg" media="(prefers-reduced-motion: reduce)" />
    <img src="/brand/pensieve-mark-anim-{name}.svg" width={size} height={size} alt="" />
  </picture>
{:else}
  <img src="/brand/pensieve-mark-{name}.svg" width={size} height={size} alt="" />
{/if}

<style>
  picture,
  img {
    display: block;
    flex: none;
  }
</style>
