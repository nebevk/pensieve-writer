import type { DocumentJson, Project } from "$lib/model";
import type { ManuscriptFont, Prefs } from "$lib/prefs";
// Types only: the writer and its docx library load on the first export, not at startup.
import type { FontFace, WordFont, WordImage, WordLook } from "./word";

/** Browser-side preparation for Word files: the manuscript font's static styles and measured pictures. */

const FAMILIES: Record<ManuscriptFont, { name: string; file?: string }> = {
  literata: { name: "Literata", file: "Literata" },
  garamond: { name: "EB Garamond", file: "EBGaramond" },
  // Every Windows computer has Courier New, so nothing needs packing.
  typewriter: { name: "Courier New" },
};

const FACES: [FontFace, string][] = [
  ["regular", "Regular"],
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["boldItalic", "BoldItalic"],
];

export function wordLook(prefs: Pick<Prefs, "manuscriptFont" | "manuscriptSize" | "pageWidth" | "runningHead">): WordLook {
  return {
    font: FAMILIES[prefs.manuscriptFont].name,
    sizePx: prefs.manuscriptSize,
    pageWidth: prefs.pageWidth,
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
        if (!response.ok) throw new Error(`The ${family.name} font file is missing`);
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
  project: Pick<Project, "title" | "kind" | "language" | "chapters">,
  prefs: Pick<Prefs, "manuscriptFont" | "manuscriptSize" | "pageWidth" | "runningHead">,
): Promise<Uint8Array> {
  const { wordFile } = await import("./word");
  const sources = new Set<string>();
  for (const chapter of project.chapters) pictureSources(chapter.contentJson, sources);
  const images = new Map<string, WordImage>();
  for (const src of sources) {
    const image = await wordImage(src);
    if (image) images.set(src, image);
  }
  return wordFile(project, wordLook(prefs), { fonts: await fontsFor(prefs.manuscriptFont), images });
}
