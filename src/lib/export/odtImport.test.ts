import { describe, expect, it } from "vitest";
import { t } from "$lib/ui.svelte";
import { contentXml, makeOdt, makeZip, PNG, stylesXml } from "../../../tests/browser/fixtures/odt.mjs";
import { readOdtFile } from "./odtImport";
import { parseXml, textOf } from "./xml";
import { unzip } from "./zip";

type Node = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] };

const buffer = (bytes: Uint8Array) => bytes.slice().buffer as ArrayBuffer;
const odt = (body: string, automatic = "", pictures: Record<string, Uint8Array> = {}) => buffer(makeOdt({ content: contentXml(body, automatic), pictures }));
const nodes = (chapter: { contentJson: { content?: unknown[] } }) => (chapter.contentJson.content ?? []) as Node[];
const texts = (node: Node): string => node.text ?? (node.content ?? []).map(texts).join("");

const AUTOMATIC = `
<style:style style:name="P1" style:family="paragraph" style:parent-style-name="Heading_20_1"/>
<style:style style:name="P2" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center"/></style:style>
<style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="T2" style:family="text"><style:text-properties fo:font-style="italic" style:text-underline-style="solid"/></style:style>
<style:style style:name="T3" style:family="text"><style:text-properties fo:background-color="#ffff00"/></style:style>
<text:list-style style:name="L1"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/><text:list-level-style-bullet text:level="2" text:bullet-char="◦"/></text:list-style>
<text:list-style style:name="L2"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style>`;

const NOVEL = `
<text:p text:style-name="Title">Reka</text:p>
<text:table-of-content text:name="Kazalo"><text:index-body><text:p>Prvo poglavje</text:p><text:p>Drugo poglavje</text:p></text:index-body></text:table-of-content>
<text:h text:style-name="P1" text:outline-level="1">Prvo poglavje</text:h>
<text:p text:style-name="Text_20_body">Voda je <text:span text:style-name="T1">mrzla</text:span>, <text:span text:style-name="T2">čaša</text:span> in <text:span text:style-name="T3">šola</text:span>.<text:note text:id="ftn1" text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p text:style-name="Footnote">Opomba o žabi.</text:p></text:note-body></text:note></text:p>
<text:p text:style-name="P2">Na sredini<text:line-break/>dve vrstici</text:p>
<text:list text:style-name="L1"><text:list-item><text:p>Prva</text:p><text:list><text:list-item><text:p>Spodaj</text:p></text:list-item></text:list></text:list-item><text:list-item><text:p>Druga</text:p></text:list-item></text:list>
<text:list text:style-name="L2"><text:list-item><text:p>Ena</text:p></text:list-item><text:list-item><text:p>Dve</text:p></text:list-item></text:list>
<text:h text:outline-level="1">Drugo poglavje</text:h>
<text:p text:style-name="Quotations">Citat iz knjige.</text:p>
<text:p>Dva<text:s text:c="3"/>presledka<text:tab/>in <text:a xlink:href="https://example.com">povezava</text:a>.</text:p>
<text:p>Komentar <office:annotation office:name="__Annotation__1"><dc:creator>Eva</dc:creator><text:p>Preveri to.</text:p></office:annotation>na besedah<office:annotation-end office:name="__Annotation__1"/> tukaj.</text:p>
<text:p><draw:frame draw:name="Slika1"><draw:image xlink:href="Pictures/1.png"/><svg:title>Reka ob jutru</svg:title></draw:frame></text:p>
<table:table><table:table-row><table:table-cell><text:p>A</text:p></table:table-cell><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row></table:table>`;

describe("OpenDocument files (.odt)", () => {
  it("reads a LibreOffice novel: its title, its chapters at the headings, and what is in them", async () => {
    const result = await readOdtFile(odt(NOVEL, AUTOMATIC, { "Pictures/1.png": PNG }), "rokopis");
    expect(result.title).toBe("Reka");
    expect(result.fromPensieve).toBe(false);
    // The table of contents repeats the chapters' titles; it stays out.
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Prvo poglavje", "Drugo poglavje"]);

    const [first, second] = result.chapters.map(nodes);
    const words = first[0].content ?? [];
    expect(words.find((node) => node.text === "mrzla")?.marks).toEqual([{ type: "bold" }]);
    expect(words.find((node) => node.text === "čaša")?.marks?.map((mark) => mark.type)).toEqual(["italic", "underline"]);
    expect(words.find((node) => node.text === "šola")?.marks).toEqual([{ type: "highlight", attrs: { color: "yellow" } }]);
    expect(words.at(-1)).toEqual({ type: "footnote", attrs: { text: "Opomba o žabi." } });
    expect(first[1]).toMatchObject({ type: "paragraph", attrs: { textAlign: "center" } });
    expect(first[1].content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);
    // A bulleted list with a list inside it, then a numbered one.
    expect(first[2].type).toBe("bulletList");
    expect(first[2].content?.[0].content?.map((node) => node.type)).toEqual(["paragraph", "bulletList"]);
    expect(first[2].content?.map(texts)).toEqual(["PrvaSpodaj", "Druga"]);
    expect(first[3]).toMatchObject({ type: "orderedList" });
    expect(first[3].content?.map(texts)).toEqual(["Ena", "Dve"]);

    expect(second[0]).toMatchObject({ type: "blockquote" });
    expect(texts(second[0])).toBe("Citat iz knjige.");
    expect(texts(second[1])).toBe("Dva   presledka\tin povezava.");
    expect(second[1].content?.find((node) => node.text === "povezava")?.marks).toEqual([{ type: "link", attrs: { href: "https://example.com" } }]);
    // A comment on a stretch of words marks its last word, as one from Word does.
    const commented = second[2].content?.find((node) => node.marks?.some((mark) => mark.type === "comment"));
    expect(commented?.text).toBe("besedah");
    expect(commented?.marks?.[0].attrs?.text).toBe("Preveri to.");
    expect(second[3]).toMatchObject({ type: "image", attrs: { alt: "Reka ob jutru" } });
    expect(String(second[3].attrs?.src)).toMatch(/^data:image\/png;base64,iVBOR/);
    expect(texts(second[4])).toBe("A\tB");
  });

  it("finds chapters in a manuscript formatted by hand, its lines bold and centred", async () => {
    const automatic = `<style:style style:name="P9" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-weight="bold"/></style:style>`;
    const body = `<text:p text:style-name="P9">1. poglavje</text:p><text:p>Prvi odstavek.</text:p><text:p text:style-name="P9">2. poglavje</text:p><text:p>Drugi odstavek.</text:p>`;
    const result = await readOdtFile(odt(body, automatic), "rokopis");
    expect(result.chapters.map((chapter) => [chapter.title, chapter.plainText])).toEqual([
      ["1. poglavje", "Prvi odstavek."],
      ["2. poglavje", "Drugi odstavek."],
    ]);
  });

  it("reads a file that names its namespaces with other prefixes", async () => {
    const content = `<?xml version="1.0"?><o:document-content xmlns:o="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:t="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><o:body><o:text><t:h t:outline-level="1">Ena</t:h><t:p>Besedilo &amp; še kaj.</t:p><t:h t:outline-level="1">Dve</t:h><t:p>Konec.</t:p></o:text></o:body></o:document-content>`;
    const result = await readOdtFile(buffer(makeOdt({ content })), "x");
    expect(result.chapters.map((chapter) => [chapter.title, chapter.plainText])).toEqual([
      ["Ena", "Besedilo & še kaj."],
      ["Dve", "Konec."],
    ]);
  });

  it("is one page when it has no headings, and says so of an empty, broken or other kind of file", async () => {
    const page = await readOdtFile(odt("<text:p>Samo odstavek.</text:p>"), "Članek");
    expect(page.chapters).toHaveLength(1);
    expect(page.chapters[0].plainText).toBe("Samo odstavek.");
    await expect(readOdtFile(new ArrayBuffer(0))).rejects.toThrow(t("errOdtEmpty"));
    await expect(readOdtFile(odt("<text:p/>"))).rejects.toThrow(t("errOdtEmpty"));
    await expect(readOdtFile(buffer(new TextEncoder().encode("not a zip at all")))).rejects.toThrow(t("errOdtUnreadable"));
    const sheet = makeOdt({ content: contentXml("<text:p>x</text:p>"), mimetype: "application/vnd.oasis.opendocument.spreadsheet" });
    await expect(readOdtFile(buffer(sheet))).rejects.toThrow(t("errOdtUnreadable"));
  });
});

describe("Zip files", () => {
  it("reads stored and deflated files", async () => {
    const encoder = new TextEncoder();
    const zip = makeZip([["a.txt", encoder.encode("čaša")], ["b/c.xml", encoder.encode("<x>šola</x>".repeat(50))]], new Set(["a.txt"]));
    const files = unzip(buffer(zip));
    expect([...files.keys()]).toEqual(["a.txt", "b/c.xml"]);
    expect(new TextDecoder().decode(await files.get("a.txt")?.())).toBe("čaša");
    expect(new TextDecoder().decode(await files.get("b/c.xml")?.())).toBe("<x>šola</x>".repeat(50));
  });
});

describe("XML", () => {
  it("reads elements, attributes, entities and CDATA, and names by namespace", () => {
    const root = parseXml(`<?xml version="1.0"?><!-- a note --><a:x xmlns:a="urn:oasis:names:tc:opendocument:xmlns:text:1.0" a:k='v &quot;1&quot;'><a:y/>č &lt;&amp;&gt; &#x17E;<![CDATA[<b>]]></a:x>`);
    const x = root.children[0] as ReturnType<typeof parseXml>;
    expect(x.name).toBe("text:x");
    expect(x.attrs).toEqual({ "text:k": 'v "1"' });
    expect(textOf(x)).toBe("č <&> ž<b>");
    expect(() => parseXml("<a><b></a>")).toThrow();
  });
});
