import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { UiKey } from "$lib/i18n";
import { t } from "$lib/ui.svelte";

export type ExportKind = "docx" | "md" | "txt";

const FILTERS: Record<ExportKind, { name: UiKey; extensions: string[] }> = {
  docx: { name: "dialogWordFilter", extensions: ["docx"] },
  md: { name: "dialogMarkdownFilter", extensions: ["md"] },
  txt: { name: "dialogPlainFilter", extensions: ["txt"] },
};

/** The "Save as" dialog, starting with a suggested file name. */
export async function chooseSavePath(suggested: string, kind: ExportKind): Promise<string | null> {
  const filter = FILTERS[kind];
  const path = await save({
    title: t("dialogSaveAs"),
    defaultPath: suggested,
    filters: [{ name: t(filter.name), extensions: filter.extensions }],
  });
  return typeof path === "string" ? path : null;
}

export type WrittenFile = { path: string; stamp: string };

/** Raised when a Word copy was changed outside Pensieve since Pensieve last wrote it. */
export const CHANGED_ELSEWHERE = "CHANGED_ELSEWHERE";
/** Raised when a file with that name exists and Pensieve didn't write it. */
export const ALREADY_EXISTS = "EXISTS";
/** Pass as `expect` to write only if no file exists yet. */
export const MUST_BE_NEW = "absent";

function hex(text: string): string {
  return Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Writes bytes to a file by temp file and rename. With `expect` (a stamp from an earlier write,
 * or MUST_BE_NEW), the file is only replaced if nobody else changed it meanwhile.
 */
export function writeFileTo(path: string, bytes: Uint8Array, expect = ""): Promise<WrittenFile> {
  return invoke<WrittenFile>("write_document", bytes, { headers: { "x-path": hex(path), "x-expect": expect } });
}

/** A file path in a folder, with Windows separators. */
export function inFolder(folder: string, name: string): string {
  const separator = folder.includes("/") && !folder.includes("\\") ? "/" : "\\";
  return `${folder.replace(/[\\/]+$/, "")}${separator}${name}`;
}
