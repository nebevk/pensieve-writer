import type { UiLanguage } from "./i18n";

/**
 * A few words of encouragement after Home's greeting (owner, 13 October), in place of the chapter waiting:
 * one chosen each time Home opens, from those for any hour and those for the time of day it is. Said
 * without "ti" or "vi" and without a past tense, so they read right in Slovenian whoever reads them.
 */
export type Encouragement = Record<UiLanguage, string>;

const ANY: Encouragement[] = [
  { en: "Every word counts.", sl: "Vsaka beseda šteje." },
  { en: "One page at a time.", sl: "Ena stran naenkrat." },
  { en: "Good stories grow slowly.", sl: "Dobre zgodbe rastejo počasi." },
  { en: "A first draft is for courage, not for perfection.", sl: "Prva različica je za pogum, ne za popolnost." },
  { en: "Even a few words are progress.", sl: "Tudi nekaj besed je napredek." },
  { en: "Anything written can be mended.", sl: "Vse, kar je napisano, se da popraviti." },
  { en: "The first sentence is the hardest. Then it flows.", sl: "Najtežji je prvi stavek. Potem steče." },
  { en: "Small steps write a big book.", sl: "Majhni koraki napišejo veliko knjigo." },
  { en: "A good sentence is worth the wait.", sl: "Dober stavek je vreden čakanja." },
  { en: "The story already knows where it is going. Just follow it.", sl: "Zgodba že ve, kam gre. Treba ji je le slediti." },
  { en: "A blank page is only a beginning.", sl: "Prazna stran je samo začetek." },
  { en: "A lovely thought deserves to be written down.", sl: "Lepa misel je vredna zapisa." },
  { en: "A little each day, and the book grows.", sl: "Vsak dan malo in knjiga raste." },
  { en: "Words come while writing.", sl: "Besede pridejo med pisanjem." },
];

const MORNING: Encouragement[] = [
  { en: "A morning is like a new page.", sl: "Jutro je kot nova stran." },
  { en: "Fresh mind, fresh words.", sl: "Sveža glava, sveže besede." },
];

const AFTERNOON: Encouragement[] = [{ en: "The afternoon is a good time for a few new lines.", sl: "Popoldne je pravi čas za nekaj novih vrstic." }];

const EVENING: Encouragement[] = [
  { en: "The evening is quiet. A good time for a story.", sl: "Večer je tih. Pravi čas za zgodbo." },
  { en: "A few more lines before the day ends.", sl: "Še nekaj vrstic pred koncem dneva." },
];

const LATE: Encouragement[] = [
  { en: "One more page, then rest.", sl: "Še ena stran, potem pa počitek." },
  { en: "The night is quiet, and the story is listening.", sl: "Noč je tiha in zgodba posluša." },
];

/** The lines for an hour of the day: those for any hour, and the hour's own, at the hours the greeting changes. */
export function encouragementsAt(hour: number): Encouragement[] {
  const own = hour >= 23 || hour < 5 ? LATE : hour < 12 ? MORNING : hour < 18 ? AFTERNOON : EVENING;
  return [...ANY, ...own];
}

/** One for the hour, chosen by `random` (0 to 1), in both languages, so a change of language keeps the same line. */
export function encouragementFor(hour: number, random = Math.random()): Encouragement {
  const lines = encouragementsAt(hour);
  return lines[Math.min(lines.length - 1, Math.floor(random * lines.length))];
}
