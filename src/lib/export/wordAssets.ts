import type { DocumentJson, Writing } from "$lib/model";
import type { ManuscriptFont, Prefs } from "$lib/prefs";
// Types only: the writer and its docx library load on the first export, not at startup.
import type { FontFace, WordFont, WordImage, WordLook } from "./word";
import { t } from "$lib/ui.svelte";
import { WORD_FONTS } from "./wordFonts";
import { fontName } from "$lib/prefs";

/** Browser-side preparation for Word files: the manuscript font's static styles and measured pictures. */

const FAMILIES = WORD_FONTS;

const FACES: [FontFace, string][] = [
  ["regular", "Regular"],
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["boldItalic", "BoldItalic"],
];

export function wordLook(prefs: Pick<Prefs, "manuscriptFont" | "manuscriptPt" | "pageWidth" | "paper" | "paperSize" | "runningHead">): WordLook {
  return {
    font: FAMILIES[prefs.manuscriptFont].name,
    sizePt: prefs.manuscriptPt,
    pageWidth: prefs.pageWidth,
    paper: prefs.paper === "pages" ? prefs.paperSize : undefined,
    runningHead: prefs.runningHead,
  };
}

const fontCache = new Map<ManuscriptFont, Promise<WordFont[]>>();

async function fontsFor(font: ManuscriptFont): Promise<WordFont[]> {
  const family = FAMILIES[font];
  if (!family.file) return [];
  let fonts = fontCache.get(font);
  if (!fonts) {
    fonts = Promise.all(
      FACES.map(async ([face, suffix]) => {
        const response = await fetch(`/fonts/word/${family.file}-${suffix}.ttf`);
        if (!response.ok) throw new Error(t("errFontMissing", { font: family.name }));
        return { family: family.name, face, data: new Uint8Array(await response.arrayBuffer()) };
      }),
    );
    fontCache.set(font, fonts);
  }
  try {
    return await fonts;
  } catch {
    // Without the packed font, Word substitutes a similar serif; the text is still all there.
    fontCache.delete(font);
    return [];
  }
}

/** The manuscript's fonts some words of a document are set in (TOOL-6). */
function fontsUsed(doc: DocumentJson, found: Set<ManuscriptFont>) {
  const walk = (node: { marks?: { type?: string; attrs?: { name?: unknown } }[]; content?: unknown[] }) => {
    for (const mark of node.marks ?? []) if (mark.type === "font") found.add(fontName(mark.attrs?.name));
    for (const child of node.content ?? []) walk(child as typeof node);
  };
  walk(doc as unknown as Parameters<typeof walk>[0]);
}

function pictureSources(doc: DocumentJson, found: Set<string>) {
  const walk = (node: { type?: string; attrs?: { src?: unknown }; content?: unknown[] }) => {
    if (node.type === "image" && typeof node.attrs?.src === "string") found.add(node.attrs.src);
    for (const child of node.content ?? []) walk(child as typeof node);
  };
  walk(doc as Parameters<typeof walk>[0]);
}

const WORD_TYPES: Record<string, WordImage["type"]> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

/** A picture measured and in a format Word reads; anything else is redrawn as PNG. */
async function wordImage(src: string): Promise<WordImage | null> {
  try {
    const blob = await (await fetch(src)).blob();
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    let type = WORD_TYPES[blob.type];
    let data = new Uint8Array(await blob.arrayBuffer());
    if (!type) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) return null;
      data = new Uint8Array(await png.arrayBuffer());
      type = "png";
    }
    bitmap.close();
    return { type, data, width, height };
  } catch {
    return null;
  }
}

/** The book as a Word file, laid out like the page in Pensieve. */
export async function wordFileFor(
  project: Pick<Writing, "title" | "split" | "language" | "chapters">,
  prefs: Pick<Prefs, "manuscriptFont" | "manuscriptPt" | "pageWidth" | "paper" | "paperSize" | "runningHead">,
): Promise<Uint8Array> {
  const { wordFile } = await import("./word");
  const sources = new Set<string>();
  // The manuscript's font, and any other of its fonts some words are in (TOOL-6), packed into the file.
  const used = new Set<ManuscriptFont>([prefs.manuscriptFont]);
  for (const chapter of project.chapters) {
    pictureSources(chapter.contentJson, sources);
    fontsUsed(chapter.contentJson, used);
  }
  const images = new Map<string, WordImage>();
  for (const src of sources) {
    const image = await wordImage(src);
    if (image) images.set(src, image);
  }
  const fonts = (await Promise.all([...used].map(fontsFor))).flat();
  return wordFile(project, wordLook(prefs), { fonts, images });
}
