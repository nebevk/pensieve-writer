# Spell check spike (Phase 0)

**Date:** 1 October 2026
**Machine:** Windows 10 (build 19045). The WebView2 runtime is installed. Windows languages with spell checking turned on: `en-US`, `en-GB`, `en-SI`, and `sl`.

## Question

Does the spell checker inside WebView2 support English and Slovenian?

## Method

WebView2 on Windows does not ship its own dictionaries. Editable text asks the Windows Spell Checking API (`ISpellCheckerFactory`) for underlines. That API was probed directly, which is the check WebView2 itself performs.

| Language | Word | Result |
| --- | --- | --- |
| `en-US` | mispelled | flagged |
| `en-US` | spelling | accepted |
| `sl` | besda | flagged |
| `sl` | beseda | accepted |
| `sl` | češnja | accepted |
| `sl` | šola | accepted |
| `sl` | žaba | accepted |
| `sl-SI` | besda | flagged |
| `sl-SI` | beseda | accepted |
| `sl-SI` | češnja | accepted |

The same samples are available in the app from `/spellcheck` (`probe_spellcheck`), next to three editable boxes (`lang="en-US"`, `lang="sl"`, and `lang="sl-SI"`) for a visual underline check.

## Result

The Windows spell checker that WebView2 uses supports **English and Slovenian** on this machine. Both `sl` and `sl-SI` work. Real Slovenian words that use č, š, and ž are accepted, and the misspelling `besda` is flagged.

## Not confirmed in the WebView yet

Red underlines were not looked at inside the Pensieve window. The desktop app has not been compiled on this machine: Visual Studio 2022 is installed without the C++ desktop workload, which Rust needs in order to link the app. A browser preview of `/spellcheck` is a different engine, so it was not used as this result.

After `npm run tauri dev`, open **Spell check test** in the chapter sidebar. Misspelled words should be underlined. `češnja`, `šola`, and `žaba` should not.

## Recommendation for later phases

Use the WebView spell checker with `lang="en"` or `lang="sl"` on the editor. A machine without the Slovenian language pack will not underline Slovenian. That case can fall back to bundled Hunspell dictionaries (English and Slovenian) when a chapter's language has no Windows dictionary.
