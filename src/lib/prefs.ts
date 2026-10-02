export type ThemeName = "daylight" | "candlelit" | "moonlit" | "sunset";
export type AmbienceName = "off" | "rain" | "fire";
export type ManuscriptFont = "literata" | "garamond" | "typewriter";
export type PageWidth = "narrow" | "book" | "wide";

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
  streak: number;
  lastWriteDay: string;
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
  streak: 0,
  lastWriteDay: "",
});

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPrefs();
    const stored = JSON.parse(raw) as Partial<Prefs> & { theme?: string };
    return { ...defaultPrefs(), ...stored, theme: normalizeTheme(stored.theme) };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: Prefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
