import { invoke } from "@tauri-apps/api/core";
import { t } from "$lib/ui.svelte";

/** The copies Pensieve keeps in its own folder (kept.rs): a project's rescue copy, and a writing deleted for good. */
export type KeptKind = "rescue" | "deleted";

/** A kept copy, as kept.rs lists it. */
export type KeptCopy = { name: string; path: string; bytes: number; modified: number };

export function writeKeptCopy(kind: KeptKind, name: string, contents: string): Promise<string> {
  return invoke<string>("write_kept_copy", { kind, name, contents });
}

/** The copies of one kind, newest first. */
export function listKeptCopies(kind: KeptKind): Promise<KeptCopy[]> {
  return invoke<KeptCopy[]>("list_kept_copies", { kind });
}

export function removeKeptCopy(kind: KeptKind, name: string): Promise<void> {
  return invoke<void>("remove_kept_copy", { kind, name });
}

/** The folder the kept copies are in, for the file picker that brings one back. */
export function keptCopiesFolder(): Promise<string> {
  return invoke<string>("kept_copies_folder");
}

/** A project's rescue copy: one for each project, written over each time. */
export function rescueName(projectId: string): string {
  return `${projectId.replace(/[^a-zA-Z0-9-]/g, "") || "project"}.json`;
}

/** A writing deleted for good: its title and when, so the file picker shows which is which. */
export function deletedName(title: string, when: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  const stamp = `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())} ${two(when.getHours())}-${two(when.getMinutes())}-${two(when.getSeconds())}`;
  // What Windows refuses in a name goes, control characters and runs of dots too, and dots and spaces at either end.
  const fit = [...title]
    .filter((letter) => letter.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return `${fit || t("untitled")} ${stamp}.json`;
}
