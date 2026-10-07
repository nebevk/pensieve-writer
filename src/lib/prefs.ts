import type { ProjectSummary } from "$lib/chapters/progress";

export type ThemeName = "daylight" | "candlelit" | "moonlit" | "sunset";
export type AmbienceName = "off" | "rain" | "fire" | "cafe" | "piano";
export type ManuscriptFont = "literata" | "garamond" | "typewriter";
export type PageWidth = "narrow" | "book" | "wide";
/** What the list beside the page shows: the open writing's chapters, or the library of projects. */
export type SidebarView = "chapters" | "library";

export type KnownProject = {
  /** The project's file. */
  path: string;
  /** The project's name. */
  title: string;
  /** What Home and the library show while another project is open; saved when it was last open. */
  summary?: ProjectSummary;
};

/** Where she was last: the project's file, and the writing and chapter open in it. */
export type LastOpened = { path: string; writingId: string; chapterId: string };

export type Prefs = {
  theme: ThemeName;
  columnRem: number;
  gentle: boolean;
  backupFolder: string;
  /** The open project's file. */
  projectPath: string;
  /** Where projects live, each in its own folder; empty means Documents\Pensieve, or the home folder's when Documents is synced. */
  libraryFolder: string;
  /** What Home's Continue writing opens. */
  lastOpened: LastOpened;
  /** The example projects and the long test book, by name, where they were last written. */
  samples: Record<string, string>;
  ambience: AmbienceName;
  ambienceVolume: number;
  manuscriptFont: ManuscriptFont;
  /** The writing's text size in points, as Word counts it: 12 pt is 16 px on screen. */
  manuscriptPt: number;
  pageWidth: PageWidth;
  grain: boolean;
  runningHead: boolean;
  typewriter: boolean;
  /** The list beside the page in Write: the chapter's to-dos, the notes it mentions, the word goals, or none. */
  panel: "" | "todos" | "notes" | "goals";
  sidebarView: SidebarView;
  /** Words to write each day; 0 means no goal. */
  dailyGoal: number;
  writingDay: string;
  dayStartWords: number;
  uiLanguage: "en" | "sl";
  knownProjects: KnownProject[];
  lastBackupAt: string;
  lastBackupError: string;
  /** Fingerprint of the book in the newest automatic backup, to skip identical copies. */
  lastBackupSignature: string;
  /** Folder where Pensieve keeps an up-to-date Word copy of the open book; empty means none. */
  wordCopyFolder: string;
  /** Per Word copy path: the stamp Pensieve last wrote and the book's fingerprint at that time. */
  wordCopies: Record<string, { stamp: string; signature: string }>;
  wordCopyAt: string;
  wordCopyError: string;
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

/**
 * How wide the page is in Write. It grows with the room beside the chapter list and the panel (the
 * stage is a size container), wider than the design's fixed sheets, within limits that keep a line
 * readable on a big screen.
 */
export function pageWidthValue(width: PageWidth): string {
  if (width === "narrow") return "clamp(600px, 50cqi, 760px)";
  if (width === "wide") return "clamp(860px, 72cqi, 1160px)";
  return "clamp(760px, 60cqi, 960px)";
}

export const defaultPrefs = (): Prefs => ({
  theme: "daylight",
  columnRem: 44,
  gentle: false,
  backupFolder: "",
  projectPath: "",
  libraryFolder: "",
  lastOpened: { path: "", writingId: "", chapterId: "" },
  samples: {},
  ambience: "off",
  ambienceVolume: 0.4,
  manuscriptFont: "literata",
  manuscriptPt: 12,
  pageWidth: "book",
  grain: true,
  runningHead: true,
  typewriter: false,
  panel: "",
  sidebarView: "chapters",
  dailyGoal: 500,
  writingDay: "",
  dayStartWords: 0,
  uiLanguage: "sl",
  knownProjects: [],
  lastBackupAt: "",
  lastBackupError: "",
  lastBackupSignature: "",
  wordCopyFolder: "",
  wordCopies: {},
  wordCopyAt: "",
  wordCopyError: "",
});

/** Saved settings made whole: missing ones get their defaults, and ones the app has dropped go. */
function fromStored(raw: string): Prefs {
  const stored = JSON.parse(raw) as Partial<Prefs> & {
    theme?: string;
    streak?: number;
    lastWriteDay?: string;
    manuscriptSize?: number;
    panelTodos?: boolean;
    panelNotes?: boolean;
  };
  // The streak went first. On 6 October the panel's two switches became one choice, and the text size
  // went from pixels to points, as Word counts them; the old default of 17 px becomes the new 12 pt.
  const { streak: _streak, lastWriteDay: _lastWriteDay, manuscriptSize, panelTodos, panelNotes, ...rest } = stored;
  const panel =
    rest.panel !== undefined && ["", "todos", "notes", "goals"].includes(rest.panel)
      ? rest.panel
      : panelNotes
        ? "notes"
        : panelTodos
          ? "todos"
          : "";
  const fromPixels = typeof manuscriptSize === "number" && manuscriptSize !== 17 ? Math.round(manuscriptSize * 1.5) / 2 : 12;
  return {
    ...defaultPrefs(),
    ...rest,
    theme: normalizeTheme(stored.theme),
    uiLanguage: stored.uiLanguage === "en" ? "en" : "sl",
    panel,
    sidebarView: rest.sidebarView === "library" ? "library" : "chapters",
    manuscriptPt: typeof rest.manuscriptPt === "number" ? rest.manuscriptPt : fromPixels,
    libraryFolder: typeof rest.libraryFolder === "string" ? rest.libraryFolder : "",
    lastOpened: lastOpenedFrom(rest.lastOpened),
    samples: stringsFrom(rest.samples),
    knownProjects: Array.isArray(rest.knownProjects) ? rest.knownProjects.flatMap(knownFrom) : [],
  };
}

function lastOpenedFrom(value: unknown): LastOpened {
  const saved = (value ?? {}) as Partial<Record<keyof LastOpened, unknown>>;
  const text = (field: unknown) => (typeof field === "string" ? field : "");
  return { path: text(saved.path), writingId: text(saved.writingId), chapterId: text(saved.chapterId) };
}

function stringsFrom(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/**
 * A remembered project as this version reads it. Before projects held several writings, each file was
 * one book and its summary had a kind and no writings: its words and date stay, the rest goes.
 */
function knownFrom(value: unknown): KnownProject[] {
  const saved = (value ?? {}) as { path?: unknown; title?: unknown; summary?: Partial<ProjectSummary> & { kind?: unknown } };
  if (typeof saved.path !== "string" || !saved.path) return [];
  const summary = saved.summary;
  return [
    {
      path: saved.path,
      title: typeof saved.title === "string" ? saved.title : "",
      summary:
        summary && typeof summary === "object"
          ? {
              words: Number(summary.words) || 0,
              editedAt: typeof summary.editedAt === "string" ? summary.editedAt : "",
              writings: Array.isArray(summary.writings) ? summary.writings : [],
            }
          : undefined,
    },
  ];
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? fromStored(raw) : defaultPrefs();
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
  return fromStored(raw);
}

async function writePrefsFile(contents: string): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_prefs", { contents });
}
