<script lang="ts">
  let { name }: { name: string } = $props();
</script>

<svg viewBox="0 0 16 16" aria-hidden="true">
  {#if name === "bold"}
    <path
      d="M4 2.2h4.6a2.6 2.6 0 0 1 0 5.2H4zm0 5.2h5.2a2.7 2.7 0 0 1 0 5.4H4z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
  {:else if name === "italic"}
    <path d="M10 2.5H6.5M9.5 13.5H6M9.2 2.5 6.8 13.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  {:else if name === "underline"}
    <path d="M4.5 2.5v5.2a3.5 3.5 0 0 0 7 0V2.5M3.5 13.5h9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  {:else if name === "strike"}
    <path d="M3 8h10M6.2 8c0-2.2 1.2-3.4 2.6-3.4 1.6 0 2.4 1 2.4 2.1M5.2 11.2c.5 1.2 1.6 2 2.8 2 1.8 0 3-1.2 3-2.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  {:else if name === "paragraph"}
    <path d="M8 3v10M8 3h2.2a3 3 0 0 1 0 6H8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  {:else if name === "h1"}
    <path d="M3 3.5v9M3 8h6M9 3.5v9M12.2 6.2V12M12.2 6.2 11 7.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === "h2"}
    <path d="M2.5 3.5v9M2.5 8h5.2M7.7 3.5v9M10 7.2c.3-1.4 1.2-2 2.2-2 1.2 0 2 .7 2 1.7 0 2.4-4.2 2.6-4.2 4.6h4.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
  {:else if name === "h3"}
    <path d="M2.2 3.5v9M2.2 8h4.8M7 3.5v9M10 6.2c.4-1 1.2-1.6 2.2-1.6 1.3 0 2.1.8 2.1 1.8S13.4 8.2 12 8.2c1.5 0 2.4.7 2.4 1.9s-.9 1.9-2.3 1.9c-1.1 0-1.9-.6-2.2-1.5" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" />
  {:else if name === "quote"}
    <path d="M3 7.5c0-2 1-3.2 2.6-3.5v1.6c-.7.3-1.1.8-1.1 1.5H6V11H3zm6.2 0c0-2 1-3.2 2.6-3.5v1.6c-.7.3-1.1.8-1.1 1.5h1.5V11H9.2z" fill="currentColor" />
  {:else if name === "bullets"}
    <path d="M3 4h.1M3 8h.1M3 12h.1M6 4h7M6 8h7M6 12h7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  {:else if name === "numbers"}
    <path d="M6 4h7M6 8h7M6 12h7M2.4 5.2V3.2l.8-.4M2.2 9.4h1.6M2.2 7.6c.8 0 1.6.3 1.6.9s-.8.9-1.6.9M2.2 11.2c.9 0 1.7.3 1.7.9s-.8 1-1.7 1" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
  {:else if name === "align-left"}
    <path d="M2.5 3.5h11M2.5 6.5h7M2.5 9.5h11M2.5 12.5h7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
  {:else if name === "align-center"}
    <path d="M2.5 3.5h11M4.5 6.5h7M2.5 9.5h11M4.5 12.5h7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
  {:else if name === "align-right"}
    <path d="M2.5 3.5h11M6.5 6.5h7M2.5 9.5h11M6.5 12.5h7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
  {:else if name === "align-justify"}
    <path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
  {:else if name === "undo"}
    <path d="M4 8.2A4.2 4.2 0 1 0 8.2 4H6.4M6.4 2.4V4.6H8.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === "redo"}
    <path d="M12 8.2A4.2 4.2 0 1 1 7.8 4H9.6M9.6 2.4V4.6H7.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === "clear"}
    <path d="M3.2 5.2h9.6M6.2 5.2l.5 8.2h2.6l.5-8.2M6.6 5.2l.4-1.6h1.9l.4 1.6" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === "find"}
    <circle cx="7" cy="7" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4" />
    <path d="M9.6 9.6 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  {:else if name === "chapters"}
    <path d="M3 3.5h10M3 8h10M3 12.5h7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  {:else if name === "notes"}
    <path d="M4 2.5h5.5L12.5 5.5V13.5H4zM9.5 2.5V5.5H12.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
  {:else if name === "todos"}
    <path d="M3.2 4.2 4.4 5.4 6.4 3.2M3.2 8.7 4.4 9.9 6.4 7.7M3.2 13.2 4.4 14.4 6.4 12.2M8 4.2h5M8 8.7h5M8 13.2h5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === "zen"}
    <rect x="2.5" y="3" width="11" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" />
    <path d="M6.5 3v10M9.5 3v10" fill="none" stroke="currentColor" stroke-width="1.2" />
  {:else if name === "dashboard"}
    <path d="M2.4 7.4 8 2.6l5.6 4.8V13.6H2.4z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    <path d="M6.4 13.6V9.2h3.2v4.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
  {:else if name === "outline"}
    <rect x="2" y="2.4" width="4.6" height="3" rx="0.45" fill="none" stroke="currentColor" stroke-width="1.2" />
    <rect x="9.4" y="2.4" width="4.6" height="3" rx="0.45" fill="none" stroke="currentColor" stroke-width="1.2" />
    <rect x="5.7" y="10.4" width="4.6" height="3" rx="0.45" fill="none" stroke="currentColor" stroke-width="1.2" />
    <path d="M4.3 5.4v2.1h7.4V5.4M8 7.5v2.9" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round" />
  {:else if name === "book"}
    <path
      d="M8 3.1C6.5 2.5 4.8 2.2 3 2.6v9.4c1.8-.4 3.5-.1 5 .5 1.5-.6 3.2-.9 5-.5V2.6c-1.8-.4-3.5-.1-5 .5z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linejoin="round"
    />
    <path d="M8 3.1v9.4" fill="none" stroke="currentColor" stroke-width="1.15" />
  {:else if name === "settings"}
    <circle cx="8" cy="8" r="1.7" fill="none" stroke="currentColor" stroke-width="1.3" />
    <path
      d="M8 2.1v1.7M8 12.2v1.7M2.1 8h1.7M12.2 8h1.7M3.9 3.9l1.2 1.2M10.9 10.9l1.2 1.2M12.1 3.9l-1.2 1.2M5.1 10.9 3.9 12.1"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linecap="round"
    />
  {:else if name === "english"}
    <text x="1.2" y="12" fill="currentColor" font-size="10" font-family="Georgia, serif">En</text>
  {:else if name === "slovenian"}
    <text x="1.4" y="12" fill="currentColor" font-size="11" font-family="Georgia, serif">Čš</text>
    <path d="M4 2.4h5.6L12.2 5v8.6H4z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
    <path d="M9.6 2.4V5h2.6M6 8h4M6 10.4h2.6" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" />
  {:else if name === "sepia"}
    <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" stroke-width="1.3" />
    <path d="M8 2.4v1.5M8 12.1v1.5M2.4 8h1.5M12.1 8h1.5M4 4l1 1M11 11l1 1M12 4l-1 1M5 11l-1 1" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
  {:else if name === "dark"}
    <path d="M9.6 2.6a4.7 4.7 0 1 0 3.2 8.2 3.7 3.7 0 0 1-3.2-8.2z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
  {:else if name === "candle"}
    <path d="M6.7 7.2h2.6V13H6.7z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
    <path d="M8 7.1c.3-1.3 1.5-1.8 1.5-3.1 0-.7-.8-.9-1-.2-.3-.9-1.5-1.1-1.7-.2.1 1.3 1 1.8 1.2 3.5z" fill="currentColor" />
    <path d="M5.2 13.4h5.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
  {/if}
</svg>

<style>
  svg {
    width: 1.15rem;
    height: 1.15rem;
    display: block;
  }
</style>
