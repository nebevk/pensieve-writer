<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";

  type WordResult = {
    word: string;
    flagged: boolean;
    expectFlagged: boolean;
    matchesExpectation: boolean;
  };

  type LanguageProbe = {
    tag: string;
    supported: boolean;
    samples: WordResult[];
    error: string | null;
  };

  let probes = $state<LanguageProbe[] | null>(null);
  let probeError = $state<string | null>(null);

  onMount(() => {
    void (async () => {
      try {
        probes = await invoke<LanguageProbe[]>("probe_spellcheck");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        probeError = message.includes("invoke")
          ? "This probe runs inside the Pensieve window."
          : message;
      }
    })();
  });
</script>

<main class="spike">
  <p><a href="/">Back to writing</a></p>
  <h1>Spell check spike</h1>
  <p>
    These boxes use the WebView spell checker. A misspelled word should show a red underline. Words
    with č, š, and ž should not be marked wrong just for those letters.
  </p>

  <section>
    <h2>English <code>en-US</code></h2>
    <div class="sheet" contenteditable="true" spellcheck="true" lang="en-US">
      This sentense has a mispelled wrod. The word spelling is fine.
    </div>
  </section>

  <section>
    <h2>Slovenian <code>sl</code></h2>
    <div class="sheet" contenteditable="true" spellcheck="true" lang="sl">
      Češnja, šola in žaba so prave besede. Besda ni prava beseda.
    </div>
  </section>

  <section>
    <h2>Slovenian <code>sl-SI</code></h2>
    <div class="sheet" contenteditable="true" spellcheck="true" lang="sl-SI">
      Češnja, šola in žaba so prave besede. Besda ni prava beseda.
    </div>
  </section>

  <section>
    <h2>Windows spell checker</h2>
    <p>WebView2 on Windows asks this same system spell checker for underlines.</p>
    {#if probes}
      <ul>
        {#each probes as probe (probe.tag)}
          <li>
            <strong>{probe.tag}</strong>
            {probe.supported ? "is installed" : "is not installed"}
            {#if probe.error}
              — {probe.error}
            {/if}
            {#if probe.samples.length}
              <ul>
                {#each probe.samples as sample (sample.word)}
                  <li>
                    “{sample.word}” {sample.flagged ? "flagged" : "accepted"}
                    {sample.matchesExpectation ? "(as expected)" : "(unexpected)"}
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    {:else if probeError}
      <p role="alert">{probeError}</p>
    {:else}
      <p>Checking installed dictionaries…</p>
    {/if}
  </section>
</main>

<style>
  .spike {
    max-width: 44rem;
    margin: 2rem auto 4rem;
    padding: 0 1.25rem;
  }

  h1 {
    font-family: var(--pv-font-manuscript);
    font-weight: 400;
  }

  .sheet {
    background: var(--pv-paper);
    color: var(--pv-ink);
    min-height: 6rem;
    padding: 1rem 1.1rem;
    font-family: var(--pv-font-manuscript);
    font-size: 1.125rem;
    line-height: 1.7;
    outline: none;
  }

  a {
    color: var(--pv-accent);
  }

  code {
    font-size: 0.95em;
  }
</style>
