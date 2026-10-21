import type { UiLanguage } from "./i18n";

/**
 * Which app this build is (IMP-29): Pensieve, Eva's own, or Hushed Tales, the same app for the owner's friends, with a
 * name of its own, quotes about writing on Home instead of Bible verses, and a greeting without a name. It is chosen
 * when the app is built (VITE_EDITION=hushed); everything else is the same code.
 */
export type Edition = "pensieve" | "hushed";

export const EDITION: Edition = import.meta.env.VITE_EDITION === "hushed" ? "hushed" : "pensieve";

const NAMES: Record<Edition, string> = { pensieve: "Pensieve", hushed: "Hushed Tales" };

/** The app's name, as the window, the texts and Word's styles give it. */
export const APP_NAME = NAMES[EDITION];

/**
 * One of the interface's texts, written for Pensieve, in this edition's name. English takes the name's possessive as
 * it ends; Slovenian, where Pensieve takes an ending ("zunaj Pensieva"), names the app in a phrase that keeps the name
 * as it is ("zunaj aplikacije Hushed Tales").
 */
export function named(text: string, language: UiLanguage, edition: Edition = EDITION): string {
  if (edition === "pensieve" || !text.includes("Pensiev")) return text;
  const name = NAMES[edition];
  if (language === "sl") return text.replaceAll("Pensieva", `aplikacije ${name}`).replaceAll("Pensieve", name);
  return text.replaceAll("Pensieve's", name.endsWith("s") ? `${name}'` : `${name}'s`).replaceAll("Pensieve", name);
}
