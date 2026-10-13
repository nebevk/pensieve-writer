/**
 * Word's HTML, as it comes when she pastes from Word (IMP-18), made into what the page holds. Word writes each
 * list item as a paragraph with its bullet or number typed in front, footnotes as numbered links with their
 * text at the end, an empty line as a paragraph of a no-break space, and a language on almost every run;
 * here they become lists, Pensieve's footnotes, empty lines, and a language only where it differs from the
 * document's. Headings, bold, italics and paragraphs pass as they are. HTML from anywhere else is untouched.
 */
export function cleanWordHtml(html: string): string {
  if (!/urn:schemas-microsoft-com:office|class=["']?Mso|mso-list|mso-footnote/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  notes(body);
  lists(body);
  languages(body);
  // Word's own elements (o:p) go, what is in them stays.
  for (const element of [...body.querySelectorAll("o\\:p")]) element.replaceWith(...element.childNodes);
  // An empty line in Word is a paragraph of a no-break space: here an empty paragraph.
  for (const paragraph of body.querySelectorAll("p")) {
    if (!paragraph.querySelector("img, sup[data-footnote]") && !(paragraph.textContent ?? "").replace(/[\s ]/g, "")) paragraph.replaceChildren();
  }
  return body.innerHTML;
}

/** Footnotes and endnotes: each numbered link becomes a footnote holding its note's text; the notes at the end go. */
function notes(body: HTMLElement) {
  const texts = new Map<string, string>();
  for (const note of body.querySelectorAll<HTMLElement>("div[id]")) {
    if (!/^(ftn|edn)\d+$/.test(note.id)) continue;
    const copy = note.cloneNode(true) as HTMLElement;
    // The note's own number, a link back to where it is referenced.
    for (const back of copy.querySelectorAll("a[href]")) if (/^#_(ftn|edn)ref\d+$/.test(back.getAttribute("href") ?? "")) back.remove();
    texts.set(note.id, (copy.textContent ?? "").replace(/\s+/g, " ").trim());
  }
  for (const reference of [...body.querySelectorAll<HTMLAnchorElement>("a[href]")]) {
    const target = /^#_((?:ftn|edn)\d+)$/.exec(reference.getAttribute("href") ?? "")?.[1];
    const text = target ? texts.get(target) : undefined;
    if (text === undefined) continue;
    const footnote = body.ownerDocument.createElement("sup");
    footnote.setAttribute("data-footnote", text);
    reference.replaceWith(footnote);
  }
  for (const list of body.querySelectorAll("div[style*='footnote-list'], div[style*='endnote-list']")) list.remove();
}

const LIST = /mso-list:\s*(l\d+)\s+level(\d+)/i;

/** Word's list paragraphs, next to each other in one list of Word's, become one list, nested by their levels. */
function lists(body: HTMLElement) {
  const doc = body.ownerDocument;
  const items = [...body.querySelectorAll<HTMLElement>("p")].filter((paragraph) => LIST.test(paragraph.getAttribute("style") ?? ""));
  const done = new Set<HTMLElement>();
  for (const first of items) {
    if (done.has(first)) continue;
    const id = LIST.exec(first.getAttribute("style") ?? "")?.[1];
    // The run of items that follow each other in the same list.
    const run: HTMLElement[] = [];
    for (let item: Element | null = first; item instanceof HTMLElement && item.tagName === "P"; item = item.nextElementSibling) {
      const match = LIST.exec(item.getAttribute("style") ?? "");
      if (!match || match[1] !== id) break;
      run.push(item);
      done.add(item);
    }
    const stack: { level: number; list: HTMLElement }[] = [];
    for (const item of run) {
      const level = Number(LIST.exec(item.getAttribute("style") ?? "")?.[2] ?? 1);
      // The bullet or number Word typed in front of the item, and the spaces after it.
      const marker = item.querySelector("span[style*='mso-list:Ignore'], span[style*='mso-list: Ignore']");
      const ordered = /^\s*([0-9]+|[a-z]|[ivxlc]+)[.)]/i.test(marker?.textContent ?? "");
      marker?.remove();
      while (stack.length > 0 && stack[stack.length - 1].level > level) stack.pop();
      if (stack.length === 0 || stack[stack.length - 1].level < level) {
        const list = doc.createElement(ordered ? "ol" : "ul");
        const holder = stack.length > 0 ? stack[stack.length - 1].list.lastElementChild : null;
        if (holder) holder.append(list);
        else item.before(list);
        stack.push({ level, list });
      }
      const entry = doc.createElement("li");
      const paragraph = doc.createElement("p");
      paragraph.append(...item.childNodes);
      entry.append(paragraph);
      stack[stack.length - 1].list.append(entry);
      item.remove();
    }
  }
}

/** A language of its own only where it differs from the document's, as Pensieve's "sl" or "en"; Word marks almost every run. */
function languages(body: HTMLElement) {
  const own = language(body.getAttribute("lang"));
  for (const element of body.querySelectorAll<HTMLElement>("[lang]")) {
    const lang = language(element.getAttribute("lang"));
    if (!lang || lang === own) element.removeAttribute("lang");
    else element.setAttribute("lang", lang);
  }
}

function language(value: string | null): "sl" | "en" | null {
  const code = (value ?? "").toLowerCase();
  return code.startsWith("sl") ? "sl" : code.startsWith("en") ? "en" : null;
}
