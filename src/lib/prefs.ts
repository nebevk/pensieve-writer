export type ThemeName = "paper" | "sepia" | "dark" | "candlelit";
export type AmbienceName = "off" | "rain" | "fire";

export type Prefs = {
  theme: ThemeName;
  columnRem: number;
  gentle: boolean;
  backupFolder: string;
  dailyGoal: number;
  ambience: AmbienceName;
  ambienceVolume: number;
};

const KEY = "pensieve-prefs";

export const defaultPrefs = (): Prefs => ({
  theme: "paper",
  columnRem: 44,
  gentle: false,
  backupFolder: "",
  dailyGoal: 0,
  ambience: "off",
  ambienceVolume: 0.4,
});

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPrefs();
    return { ...defaultPrefs(), ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: Prefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
