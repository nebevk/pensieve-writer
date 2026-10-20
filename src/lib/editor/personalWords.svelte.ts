import { invoke } from "@tauri-apps/api/core";
import type { WritingLanguage } from "$lib/model";
import { errorMessage } from "$lib/save/autosave";
import { forgetPersonalWord, listPersonalWords, rememberPersonalWord } from "$lib/storage/sqlite";

export type PersonalWord = { language: WritingLanguage; word: string };

/** What her words need from the page around them (+page.svelte), IMP-28. */
export type PersonalWordsHost = {
  /** Runs one change after the ones before it, so a word goes into the project open then. */
  oneAtATime: <T>(work: () => Promise<T>) => Promise<T>;
  /** Said in Settings, under its rows. */
  say: (message: string) => void;
};

/**
 * Her own words for the spell checker (Settings → Language): kept in the open project, so they go with it, and
 * taught to Windows' spell checker, which marks them no more.
 */
export class PersonalWords {
  list = $state.raw<PersonalWord[]>([]);
  #host: PersonalWordsHost;

  constructor(host: PersonalWordsHost) {
    this.#host = host;
  }

  /** Reads the open project's words, and teaches each to Windows' spell checker again, which may not have them. */
  async refresh() {
    try {
      this.list = await listPersonalWords();
      for (const entry of this.list) {
        try {
          await invoke("add_personal_word", { language: entry.language, word: entry.word });
        } catch {
          // The word stays in Pensieve even if Windows cannot store it.
        }
      }
    } catch {
      // The manuscript is already open.
    }
  }

  async add(language: WritingLanguage, word: string) {
    const cleaned = word.trim();
    if (!cleaned) return;
    try {
      // After any change under way, so the word goes into the open project's file.
      await this.#host.oneAtATime(async () => {
        await invoke("add_personal_word", { language, word: cleaned });
        await rememberPersonalWord(language, cleaned);
        this.list = await listPersonalWords();
      });
    } catch (error) {
      this.#host.say(errorMessage(error));
    }
  }

  async remove(language: WritingLanguage, word: string) {
    try {
      await this.#host.oneAtATime(async () => {
        await forgetPersonalWord(language, word);
        this.list = await listPersonalWords();
      });
      try {
        await invoke("remove_personal_word", { language, word });
      } catch {
        // Pensieve has forgotten the word; only Windows' copy is left, and it does no harm.
      }
    } catch (error) {
      this.#host.say(errorMessage(error));
    }
  }
}
