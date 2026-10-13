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
