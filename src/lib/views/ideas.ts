import type { DocumentJson } from "$lib/model";
import { documentText } from "$lib/export/wordImport";
import type { Note } from "$lib/storage/organize";
import type { IdeaText } from "$lib/storage/sqlite";

/** The Ideas tab (owner, 13 October): every idea as a card, found by its words, and the links between them. */

/** An idea as a card: one of the open project's, written beside the cards, or another project's, only read. */
export type IdeaCard = {
  id: string;
  /** The file of the project it belongs to, and the name the library shows for it. */
  path: string;
  project: string;
  title: string;
  text: string;
  aliases: string;
  createdAt: string;
  own: boolean;
};

export function ownCard(note: Note, path: string, project: string): IdeaCard {
  return { id: note.id, path, project, title: note.title, text: note.plainText, aliases: note.aliases, createdAt: note.createdAt, own: true };
}

export function otherCards(ideas: IdeaText[], path: string, project: string): IdeaCard[] {
  return ideas.map((idea) => ({ ...idea, path, project, own: false }));
}

/** The newest idea first. */
export function newestFirst<T extends { createdAt: string }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** An idea with these words in its name, its other names or its text: in any case, as Find matches. */
export function ideaMatches(idea: { title: string; aliases: string; text: string }, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [idea.title, idea.aliases, idea.text].some((value) => value.toLowerCase().includes(needle));
}

/** The names an idea's [[links]] point to, each once, in order: [[Name]], or [[Name|what the link says]]. */
export function linkNames(text: string): string[] {
  const names = [...text.matchAll(/\[\[([^\]\n|]+)(?:\|[^\]\n]*)?\]\]/g)].map((match) => match[1].trim()).filter(Boolean);
  return [...new Set(names)];
}

/** An idea's text to read on a card: each [[link]] as the words it shows, on lines with no gaps between. */
export function readable(text: string): string {
  return text
    .replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g, (_match, name: string, label?: string) => (label?.trim() || name).trim())
    .trim()
    .replace(/\n{2,}/g, "\n");
}

/** The names an idea goes by, in any case: its name and its other names. */
function namesOf(idea: { title: string; aliases: string }): string[] {
  return [idea.title, ...idea.aliases.split(",")].map((name) => name.trim().toLowerCase()).filter(Boolean);
}

export type IdeaLink = { from: string; to: string };

/** The links between ideas: from each one to every idea one of its [[links]] names, once each. */
export function ideaLinks(ideas: { id: string; title: string; aliases: string; text: string }[]): IdeaLink[] {
  const byName = new Map<string, string>();
  for (const idea of ideas) {
    for (const name of namesOf(idea)) if (!byName.has(name)) byName.set(name, idea.id);
  }
  const links: IdeaLink[] = [];
  const seen = new Set<string>();
  for (const idea of ideas) {
    for (const name of linkNames(idea.text)) {
      const to = byName.get(name.toLowerCase());
      const key = `${idea.id}>${to}`;
      if (!to || to === idea.id || seen.has(key)) continue;
      seen.add(key);
      links.push({ from: idea.id, to });
    }
  }
  return links;
}

// ---- The map ----

type Block = { type: string; attrs?: Record<string, unknown>; content?: Block[]; text?: string; marks?: unknown[] };

/** An idea's text, as the editor gives it, from its document. */
function textOf(content: Block[]): string {
  return documentText(content as Parameters<typeof documentText>[0]);
}

/**
 * An idea linked to another on the map: a [[link]] to it at the end of the idea's text, in the empty last
 * line if there is one, else on a line of its own, as she would type it.
 */
export function withLink(doc: DocumentJson, title: string): { contentJson: DocumentJson; plainText: string } {
  const content = [...((doc.content ?? []) as Block[])];
  const link: Block = { type: "text", text: `[[${title}]]` };
  const last = content[content.length - 1];
  if (last?.type === "paragraph" && !(last.content ?? []).length) content[content.length - 1] = { ...last, content: [link] };
  else content.push({ type: "paragraph", content: [link] });
  return { contentJson: { ...doc, content } as DocumentJson, plainText: textOf(content) };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * An idea's links to another taken away on the map: every [[link]] to one of its names, in any case. A line
 * left with nothing but spaces goes too; the idea keeps at least one line.
 */
export function withoutLinks(doc: DocumentJson, names: string[]): { contentJson: DocumentJson; plainText: string } {
  const wanted = names.map((name) => name.trim()).filter(Boolean);
  if (wanted.length === 0) return { contentJson: doc, plainText: textOf((doc.content ?? []) as Block[]) };
  const pattern = new RegExp(`\\s?\\[\\[(?:${wanted.map(escapeRegExp).join("|")})(?:\\|[^\\]\\n]*)?\\]\\]`, "giu");
  const strip = (block: Block): Block | null => {
    if (block.type === "text") {
      const text = (block.text ?? "").replace(pattern, "");
      return text ? { ...block, text } : null;
    }
    if (!block.content) return block;
    const before = block.content.length;
    const content = block.content.map(strip).filter((child): child is Block => child !== null);
    const emptied = before > 0 && content.every((child) => child.type === "text" && !(child.text ?? "").trim());
    return emptied && block.type === "paragraph" ? null : { ...block, content };
  };
  let content = ((doc.content ?? []) as Block[]).map(strip).filter((block): block is Block => block !== null);
  if (content.length === 0) content = [{ type: "paragraph" }];
  return { contentJson: { ...doc, content } as DocumentJson, plainText: textOf(content) };
}

export type Place = { x: number; y: number };

/** An idea's card on the map: as wide and tall as this, the lines meeting its edges. */
export const CARD = { width: 184, height: 84 };
const GAP = { x: 56, y: 44 };
const MARGIN = 32;

/**
 * Where every idea sits on the map: where she put it, and one she hasn't placed yet in rows under the rest,
 * oldest first, so a new one comes last.
 */
export function placed(ideas: { id: string; createdAt: string }[], places: Map<string, Place>, columns = 4): Map<string, Place> {
  const result = new Map<string, Place>();
  let bottom = MARGIN;
  for (const idea of ideas) {
    const place = places.get(idea.id);
    if (!place) continue;
    result.set(idea.id, place);
    bottom = Math.max(bottom, place.y + CARD.height + GAP.y);
  }
  const loose = [...ideas].filter((idea) => !places.has(idea.id)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  loose.forEach((idea, index) => {
    result.set(idea.id, {
      x: MARGIN + (index % columns) * (CARD.width + GAP.x),
      y: bottom + Math.floor(index / columns) * (CARD.height + GAP.y),
    });
  });
  return result;
}

/** Where a line from one card's middle towards another meets that card's edge. */
export function edgeOf(card: Place, towards: Place): Place {
  const middle = { x: card.x + CARD.width / 2, y: card.y + CARD.height / 2 };
  const dx = towards.x - middle.x;
  const dy = towards.y - middle.y;
  if (dx === 0 && dy === 0) return middle;
  const scale = Math.min(Math.abs(dx) ? CARD.width / 2 / Math.abs(dx) : Infinity, Math.abs(dy) ? CARD.height / 2 / Math.abs(dy) : Infinity);
  return { x: middle.x + dx * scale, y: middle.y + dy * scale };
}
