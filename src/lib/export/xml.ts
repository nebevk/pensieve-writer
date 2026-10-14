/**
 * A small XML reader for OpenDocument files, which the app and its tests both run (the tests have no
 * DOMParser). It reads what a machine writes: elements, attributes, text, entities and CDATA.
 */
export type XmlElement = { name: string; attrs: Record<string, string>; children: XmlNode[] };
export type XmlNode = XmlElement | string;

// Names by their namespace, so a file that writes its prefixes differently still reads as text:p, fo:… and so on.
const PREFIXES: Record<string, string> = {
  "urn:oasis:names:tc:opendocument:xmlns:office:1.0": "office",
  "urn:oasis:names:tc:opendocument:xmlns:text:1.0": "text",
  "urn:oasis:names:tc:opendocument:xmlns:style:1.0": "style",
  "urn:oasis:names:tc:opendocument:xmlns:table:1.0": "table",
  "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0": "draw",
  "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0": "fo",
  "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0": "svg",
  "urn:oasis:names:tc:opendocument:xmlns:meta:1.0": "meta",
  "http://www.w3.org/1999/xlink": "xlink",
  "http://purl.org/dc/elements/1.1/": "dc",
};

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] !== "#") return ENTITIES[entity] ?? whole;
    const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** The document as a tree under a root named "#document"; throws on markup that doesn't close. */
export function parseXml(source: string): XmlElement {
  const root: XmlElement = { name: "#document", attrs: {}, children: [] };
  const stack: { element: XmlElement; raw: string; scope: Map<string, string> }[] = [{ element: root, raw: "", scope: new Map() }];
  const named = (qualified: string, scope: Map<string, string>, attribute: boolean) => {
    const colon = qualified.indexOf(":");
    // An attribute without a prefix has no namespace; an element's is the default one.
    if (colon < 0) {
      const space = attribute ? undefined : scope.get("");
      return space && PREFIXES[space] ? `${PREFIXES[space]}:${qualified}` : qualified;
    }
    const prefix = qualified.slice(0, colon);
    const space = scope.get(prefix);
    return space && PREFIXES[space] ? `${PREFIXES[space]}:${qualified.slice(colon + 1)}` : qualified;
  };
  for (const match of source.matchAll(TOKEN)) {
    const top = stack[stack.length - 1];
    const [, cdata, closing, opening, attributes, selfClosing, text] = match;
    if (text !== undefined) {
      top.element.children.push(decode(text));
    } else if (cdata !== undefined) {
      top.element.children.push(cdata);
    } else if (closing !== undefined) {
      if (stack.length < 2 || top.raw !== closing) throw new Error("This XML doesn't close as it opens.");
      stack.pop();
    } else if (opening !== undefined) {
      const pairs: [string, string][] = [...(attributes ?? "").matchAll(ATTRIBUTE)].map((pair) => [pair[1], decode(pair[2] ?? pair[3] ?? "")]);
      // A new scope only where the element declares namespaces; most share their parent's.
      let scope = top.scope;
      for (const [name, value] of pairs) {
        if (name === "xmlns" || name.startsWith("xmlns:")) {
          if (scope === top.scope) scope = new Map(top.scope);
          scope.set(name === "xmlns" ? "" : name.slice(6), value);
        }
      }
      const attrs: Record<string, string> = {};
      for (const [name, value] of pairs) if (name !== "xmlns" && !name.startsWith("xmlns:")) attrs[named(name, scope, true)] = value;
      const element: XmlElement = { name: named(opening, scope, false), attrs, children: [] };
      top.element.children.push(element);
      if (!selfClosing) stack.push({ element, raw: opening, scope });
    }
  }
  if (stack.length > 1) throw new Error("This XML doesn't close as it opens.");
  return root;
}

/** An element's child elements, without its text. */
export function elementsOf(element: XmlElement): XmlElement[] {
  return element.children.filter((child): child is XmlElement => typeof child !== "string");
}

/** The first element of that name anywhere under `element`, or null. */
export function findElement(element: XmlElement, name: string): XmlElement | null {
  for (const child of elementsOf(element)) {
    if (child.name === name) return child;
    const found = findElement(child, name);
    if (found) return found;
  }
  return null;
}

/** All the text under an element. */
export function textOf(element: XmlElement): string {
  return element.children.map((child) => (typeof child === "string" ? child : textOf(child))).join("");
}
