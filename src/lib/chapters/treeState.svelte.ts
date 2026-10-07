/**
 * What is folded or unfolded in the library's tree, by row, kept while Pensieve runs: leaving Write for
 * a note and coming back finds the tree as it was left.
 */
export const treeState = $state<{ open: Record<string, boolean> }>({ open: {} });

/** Whether a row is unfolded: as she left it, or as it starts. */
export function isOpen(key: string, fallback: boolean): boolean {
  return treeState.open[key] ?? fallback;
}

export function setOpen(key: string, value: boolean): void {
  treeState.open[key] = value;
}

/**
 * The requests to name something new that the tree has answered, by the time each was made. The tree is
 * made again whenever Write or the Library tab opens, and must not answer an old request a second time.
 */
export const answered = { header: 0, home: 0 };
