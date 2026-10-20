import {
  dateLocale,
  fileSize,
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

/** "18.4 MB", "18,4 MB". */
export const size = (bytes: number) => fileSize(ui.language, bytes);

export const ago = (iso: string) => relativeTime(ui.language, iso);

/** "Just now", "5 min ago", "Yesterday": ago() starting a line or a table's cell. */
export const agoCapital = (iso: string) => {
  const text = ago(iso);
  return text.charAt(0).toLocaleUpperCase(locale()) + text.slice(1);
};

export const locale = () => dateLocale(ui.language);

const SNAPSHOT_KINDS: Record<string, UiKey> = {
  daily: "snapshotDaily",
  manual: "snapshotKept",
  "before-restore": "snapshotBeforeRestore",
};

/** "Hourly", "Daily", "Kept" or "Before restore". */
export const snapshotName = (kind: string) => t(SNAPSHOT_KINDS[kind] ?? "snapshotHourly");
