export type ThemeName = "daylight" | "candlelit" | "moonlit" | "sunset";
export type AmbienceName = "off" | "rain" | "fire" | "cafe" | "piano";
export type ManuscriptFont = "literata" | "garamond" | "typewriter";
export type PageWidth = "narrow" | "book" | "wide";

export type KnownProject = {
  path: string;
  title: string;
};

export type Prefs = {
  theme: ThemeName;
  columnRem: number;
  gentle: boolean;
  backupFolder: string;
  projectPath: string;
  dailyGoal: number;
  ambience: AmbienceName;
  ambienceVolume: number;
  manuscriptFont: ManuscriptFont;
  manuscriptSize: number;
  pageWidth: PageWidth;
  grain: boolean;
  runningHead: boolean;
  typewriter: boolean;
  writingDay: string;
  dayStartWords: number;
  uiLanguage: "en" | "sl";
  knownProjects: KnownProject[];
  lastBackupAt: string;
  lastBackupError: string;
};

const KEY = "pensieve-prefs";

function normalizeTheme(value: string | undefined): ThemeName {
  if (value === "candlelit" || value === "moonlit" || value === "sunset" || value === "daylight") return value;
  if (value === "dark") return "moonlit";
  return "daylight";
}

export function resolvedTheme(theme: ThemeName, now = new Date()): Exclude<ThemeName, "sunset"> {
  if (theme !== "sunset") return theme;
  const hour = now.getHours();
  return hour >= 19 || hour < 7 ? "candlelit" : "daylight";
}

export function manuscriptFamily(font: ManuscriptFont): string {
  if (font === "garamond") return 'var(--pv-font-garamond)';
  if (font === "typewriter") return 'var(--pv-font-typewriter)';
  return 'var(--pv-font-manuscript)';
}

export function pageWidthValue(width: PageWidth): string {
  if (width === "narrow") return "var(--pv-sheet-narrow)";
  if (width === "wide") return "var(--pv-sheet-wide)";
  return "var(--pv-sheet-book)";
}

export const defaultPrefs = (): Prefs => ({
  theme: "daylight",
  columnRem: 44,
  gentle: false,
  backupFolder: "",
  projectPath: "",
  dailyGoal: 0,
  ambience: "off",
  ambienceVolume: 0.4,
  manuscriptFont: "literata",
  manuscriptSize: 17,
  pageWidth: "book",
  grain: true,
  runningHead: true,
  typewriter: false,
  writingDay: "",
  dayStartWords: 0,
  uiLanguage: "en",
  knownProjects: [],
  lastBackupAt: "",
  lastBackupError: "",
});

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPrefs();
    const stored = JSON.parse(raw) as Partial<Prefs> & {
      theme?: string;
      streak?: number;
      lastWriteDay?: string;
    };
    const { streak: _streak, lastWriteDay: _lastWriteDay, ...rest } = stored;
    return { ...defaultPrefs(), ...rest, theme: normalizeTheme(stored.theme), uiLanguage: stored.uiLanguage === "sl" ? "sl" : "en" };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: Prefs): void {
  const contents = JSON.stringify(prefs);
  localStorage.setItem(KEY, contents);
  fileWrite = fileWrite.then(() => writePrefsFile(contents)).catch(() => undefined);
}

let fileWrite: Promise<void> = Promise.resolve();

export function flushPrefs(): Promise<void> {
  return fileWrite;
}

export async function loadPrefsFile(): Promise<Prefs | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  const raw = await invoke<string>("read_prefs");
  if (!raw.trim()) return null;
  const stored = JSON.parse(raw) as Partial<Prefs> & {
    theme?: string;
    streak?: number;
    lastWriteDay?: string;
  };
  const { streak: _streak, lastWriteDay: _lastWriteDay, ...rest } = stored;
  return {
    ...defaultPrefs(),
    ...rest,
    theme: normalizeTheme(stored.theme),
    uiLanguage: stored.uiLanguage === "sl" ? "sl" : "en",
  };
}

async function writePrefsFile(contents: string): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_prefs", { contents });
}
