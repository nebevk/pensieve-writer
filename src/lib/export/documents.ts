import { invoke } from "@tauri-apps/api/core";
import { lastName, parentFolder } from "$lib/chapters/library";
import { shrinkImage } from "$lib/editor/imageSize";
import { byFileName, documentKind, documentName, type DocumentSource } from "$lib/export/importWriting";
import { readWordFile, type WordImport } from "$lib/export/wordImport";
import { chooseDocumentFiles } from "$lib/storage/backup";
import { locale } from "$lib/ui.svelte";

/**
 * Documents coming into Pensieve (SV-8): Word, OpenDocument, text and Markdown files, picked, dropped on the
 * window or chosen in the library, each read into chapters only when it is needed, its pictures made small (IMP-28).
 */

type Node = { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };

/** Every picture in a document made small enough for the page. */
async function shrinkPictures(node: Node) {
  if (node.type === "image" && typeof node.attrs?.src === "string") node.attrs.src = await shrinkImage(node.attrs.src);
  for (const child of node.content ?? []) await shrinkPictures(child as Node);
}

/** A document's bytes (`file` names it: Word, OpenDocument, text or Markdown) read into chapters, its pictures made small. */
export async function readDocumentData(data: ArrayBuffer, file: string): Promise<WordImport> {
  const name = documentName(file);
  const kind = documentKind(file);
  // OpenDocument, text and Markdown are read by code loaded when it is needed, as Word's reader is.
  const result =
    kind === "word"
      ? await readWordFile(data, name)
      : kind === "opendocument"
        ? await (await import("$lib/export/odtImport")).readOdtFile(data, name)
        : (await import("$lib/export/textImport")).readTextFile(data, name, kind === "markdown");
  for (const chapter of result.chapters) await shrinkPictures(chapter.contentJson);
  return result;
}

/** A document on the disk, to bring in. */
export function documentAt(path: string): DocumentSource {
  return { name: lastName(path), folder: lastName(parentFolder(path)), read: async () => readDocumentData(await invoke<ArrayBuffer>("read_document_file", { path }), path) };
}

/** Word, OpenDocument, text or Markdown files she picks, one or several, in the order Explorer shows them. */
export async function chooseDocuments(several: boolean, near = ""): Promise<DocumentSource[]> {
  return byFileName(await chooseDocumentFiles(several, near), locale()).map(documentAt);
}

/** Files dropped on Pensieve that can come in, in the order Explorer shows them; any other kind is left out. */
export function droppedDocuments(files: File[]): DocumentSource[] {
  const names = byFileName(
    files.filter((file) => documentKind(file.name)).map((file) => file.name),
    locale(),
  );
  return names.map((name): DocumentSource => {
    const file = files.find((item) => item.name === name) as File;
    return { name, read: async () => readDocumentData(await file.arrayBuffer(), name) };
  });
}
