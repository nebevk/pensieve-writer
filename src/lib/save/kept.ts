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

/** The folder one kind of copy is in, for the file picker that brings one back. */
export function keptCopiesFolder(kind: KeptKind): Promise<string> {
  return invoke<string>("kept_copies_folder", { kind });
}

/**
 * A title made fit for a file's name, as kept.rs takes it: no control characters, nothing Windows refuses, no
 * runs of dots, no dots or spaces at either end, and at most `bytes` long in UTF-8, cut between letters.
 */
function fitName(title: string, bytes: number): string {
  const clean = title
    .replace(/\p{Cc}/gu, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  const encoder = new TextEncoder();
  let fit = "";
  let size = 0;
  for (const letter of clean) {
    size += encoder.encode(letter).length;
    if (size > bytes) break;
    fit += letter;
  }
  return fit.replace(/[.\s]+$/, "");
}

/** When, as a file's name takes it: 2026-10-15 14-32-05. */
function stampOf(when: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())} ${two(when.getHours())}-${two(when.getMinutes())}-${two(when.getSeconds())}`;
}

/** How a project's rescue copies end: its id, so they are found when it opens. */
export function rescueTail(projectId: string): string {
  return ` ${projectId.replace(/[^a-zA-Z0-9-]/g, "") || "project"}.json`;
}

/**
 * A rescue copy: the writing's title and when Pensieve started, so a copy left from another time is never written
 * over, then the project's id.
 */
export function rescueName(projectId: string, title: string, started: Date): string {
  return `${fitName(title, 100) || t("untitled")} ${stampOf(started)}${rescueTail(projectId)}`;
}

/** A writing deleted for good: its title and when, so the file picker shows which is which. */
export function deletedName(title: string, when: Date): string {
  return `${fitName(title, 120) || t("untitled")} ${stampOf(when)}.json`;
}
