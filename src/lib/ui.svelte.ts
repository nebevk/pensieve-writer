import {
  dateLocale,
  formatNumber,
  pluralize,
  relativeTime,
  translate,
  type PluralKey,
  type UiKey,
  type UiLanguage,
} from "./i18n";

/** The interface language. The main page keeps it in step with Settings; everything shown reads it. */
export const ui = $state<{ language: UiLanguage }>({ language: "en" });

export const t = (key: UiKey, values?: Record<string, string | number>) => translate(ui.language, key, values);

/** A counted phrase in the interface language: "3 words", "3 besede". */
export const plural = (key: PluralKey, count: number) => pluralize(ui.language, key, count);

export const num = (value: number) => formatNumber(ui.language, value);

export const ago = (iso: string) => relativeTime(ui.language, iso);

export const locale = () => dateLocale(ui.language);

const SNAPSHOT_KINDS: Record<string, UiKey> = {
  daily: "snapshotDaily",
  manual: "snapshotKept",
  "before-restore": "snapshotBeforeRestore",
};

/** "Hourly", "Daily", "Kept" or "Before restore". */
export const snapshotName = (kind: string) => t(SNAPSHOT_KINDS[kind] ?? "snapshotHourly");
