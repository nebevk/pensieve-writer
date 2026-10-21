<script lang="ts">
  import "../app.css";
  import { APP_NAME } from "$lib/edition";

  let { children } = $props();
</script>

<svelte:head>
  <title>{APP_NAME}</title>
</svelte:head>

{@render children()}
