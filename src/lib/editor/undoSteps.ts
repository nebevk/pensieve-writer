import { Extension } from "@tiptap/core";
import { closeHistory, isHistoryTransaction } from "@tiptap/pm/history";
import type { Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";

type Typing = "space" | "letters" | "paragraph" | "apart" | "other";

/** What a transaction did, as far as undo steps go. */
function typingOf(transaction: Transaction): Typing | null {
  if (!transaction.docChanged) return null;
  if (isHistoryTransaction(transaction)) return "other";
  const event = transaction.getMeta("uiEvent");
  if (event === "paste" || event === "drop" || event === "cut") return "apart";
  const step = transaction.steps.length === 1 ? transaction.steps[0] : null;
  if (!(step instanceof ReplaceStep) || step.from !== step.to) return "other";
  const { content, openStart } = step.slice;
  // Enter splits the paragraph: the slice opens into the block it makes.
  if (openStart > 0) return "paragraph";
  const text = content.textBetween(0, content.size);
  if (!text) return "other";
  return /^\s+$/.test(text) ? "space" : "letters";
}

/**
 * Undo goes back a word at a time, as in Word (owner, 8 October): a word and the space after it are one
 * step, a new paragraph starts one, and a paste is one of its own. The editor's history on its own
 * ends a step only after half a second without typing, so steady typing was all one step, and one
 * Ctrl+Z took everything typed.
 */
export const UndoSteps = Extension.create<object, { wordEnded: boolean }>({
  name: "undoSteps",

  addStorage() {
    // A space or a paste came last: the next letters begin a new step.
    return { wordEnded: false };
  },

  dispatchTransaction({ transaction, next }) {
    const typing = typingOf(transaction);
    if (typing === null) {
      next(transaction);
      return;
    }
    const begins = typing === "paragraph" || typing === "apart" || (typing === "letters" && this.storage.wordEnded);
    this.storage.wordEnded = typing === "space" || typing === "apart";
    next(begins ? closeHistory(transaction) : transaction);
  },
});
