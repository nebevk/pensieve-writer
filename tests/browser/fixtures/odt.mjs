// Makes OpenDocument text files (.odt) for the unit tests and the browser checks, as LibreOffice writes them:
// a zip whose first file is the mimetype, stored, and the rest deflated, with content.xml and styles.xml.
// (LibreOffice isn't on the computers these run on, so the files are made here.)
import { deflateRawSync } from "node:zlib";

/** The namespaces LibreOffice declares, by their usual prefixes. */
export const NAMESPACES = {
  office: "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
  style: "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
  text: "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
  table: "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
  draw: "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
  fo: "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
  xlink: "http://www.w3.org/1999/xlink",
  dc: "http://purl.org/dc/elements/1.1/",
  svg: "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
};

const declarations = () =>
  Object.entries(NAMESPACES)
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join(" ");

/**
 * content.xml around a body of text:p, text:h and the like, with the automatic styles LibreOffice makes.
 * @param {string} body
 * @param {string} [automaticStyles]
 */
export function contentXml(body, automaticStyles = "") {
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${declarations()} office:version="1.3"><office:automatic-styles>${automaticStyles}</office:automatic-styles><office:body><office:text><text:sequence-decls><text:sequence-decl text:display-outline-level="0" text:name="Figure"/></text:sequence-decls>${body}</office:text></office:body></office:document-content>`;
}

/**
 * styles.xml with LibreOffice's own paragraph styles (Title, the headings, Quotations) and any given.
 * @param {string} [more]
 */
export function stylesXml(more = "") {
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${declarations()} office:version="1.3"><office:styles><style:style style:name="Standard" style:family="paragraph" style:class="text"/><style:style style:name="Heading" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="14pt"/></style:style><style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Heading" style:default-outline-level="1"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Heading" style:default-outline-level="2"/><style:style style:name="Title" style:family="paragraph" style:parent-style-name="Heading"><style:paragraph-properties fo:text-align="center"/></style:style><style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1cm"/></style:style><style:style style:name="Text_20_body" style:display-name="Text body" style:family="paragraph" style:parent-style-name="Standard"/>${more}</office:styles></office:document-styles>`;
}

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** @param {Uint8Array} bytes */
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * A zip of these files, in this order; `stored` names those kept as they are, the rest are deflated.
 * @param {[string, Uint8Array][]} files
 * @param {Set<string>} [stored]
 * @returns {Uint8Array}
 */
export function makeZip(files, stored = new Set()) {
  /** @type {Uint8Array[]} */
  const parts = [];
  /** @type {Uint8Array[]} */
  const directory = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const [name, data] of files) {
    const nameBytes = encoder.encode(name);
    const keep = stored.has(name);
    const packed = keep ? data : new Uint8Array(deflateRawSync(data));
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, keep ? 0 : 8, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, packed.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, packed);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, keep ? 0 : 8, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, packed.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    directory.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...directory, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * An .odt: its content and styles, and any pictures by their path inside it ("Pictures/1.png").
 * @param {{ content: string; styles?: string; pictures?: Record<string, Uint8Array>; mimetype?: string }} parts
 * @returns {Uint8Array}
 */
export function makeOdt({ content, styles = stylesXml(), pictures = {}, mimetype = "application/vnd.oasis.opendocument.text" }) {
  const encoder = new TextEncoder();
  const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${mimetype}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
  return makeZip(
    [
      ["mimetype", encoder.encode(mimetype)],
      ["content.xml", encoder.encode(content)],
      ["styles.xml", encoder.encode(styles)],
      ...Object.entries(pictures),
      ["META-INF/manifest.xml", encoder.encode(manifest)],
    ],
    new Set(["mimetype"]),
  );
}

/** A 1 × 1 PNG, for a picture in a document. */
export const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);
