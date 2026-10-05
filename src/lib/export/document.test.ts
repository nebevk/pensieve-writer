import { describe, expect, it } from "vitest";
import type { DocumentJson } from "$lib/model";
import { blocksToHtml, blocksToMarkdown, blocksToPlain, documentToBlocks } from "./document";

const picture = "data:image/png;base64,iVBORw0KGgo=";
const text = (value: string, marks: object[] = []) => (marks.length ? { type: "text", text: value, marks } : { type: "text", text: value });
const para = (...content: object[]) => ({ type: "paragraph", content });

const chapter: DocumentJson = {
  type: "doc",
  content: [
    para(text("Dear Ana,"), { type: "hardBreak" }, text("the house is yours.")),
    { type: "image", attrs: { src: picture, alt: "The lantern house" } },
    { type: "blockquote", content: [para(text("First line of the letter.")), para(text("Second paragraph."))] },
    {
      type: "orderedList",
      content: [
        { type: "listItem", content: [para(text("Keys")), { type: "bulletList", content: [{ type: "listItem", content: [para(text("brass"))] }] }] },
        { type: "listItem", content: [para(text("Lamp"))] },
      ],
    },
    para(text("A "), text("link", [{ type: "link", attrs: { href: "https://example.com" } }]), text(" and "), text("bad", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
    para(text("x"), text("2", [{ type: "superscript" }]), text(" marked", [{ type: "highlight" }]), text(" struck", [{ type: "strike" }])),
    { type: "horizontalRule" },
  ],
};

describe("Book view and text exports", () => {
  const blocks = documentToBlocks(chapter);

  it("keeps pictures, line breaks, quotes, nested lists and links in HTML", () => {
    const html = blocksToHtml(blocks);
    expect(html).toContain("<p>Dear Ana,<br />the house is yours.</p>");
    expect(html).toContain(`<img src="${picture}" alt="The lantern house" />`);
    expect(html).toContain("<blockquote><p>First line of the letter.</p><p>Second paragraph.</p></blockquote>");
    expect(html).toContain("<ol><li>Keys<ul><li>brass</li></ul></li><li>Lamp</li></ol>");
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("x<sup>2</sup><mark> marked</mark><s> struck</s>");
    expect(html).toContain("<hr />");
  });

  it("writes the same things as Markdown", () => {
    const markdown = blocksToMarkdown(blocks);
    expect(markdown).toContain("Dear Ana,\\\nthe house is yours.");
    expect(markdown).toContain(`![The lantern house](${picture})`);
    expect(markdown).toContain("> First line of the letter.\n>\n> Second paragraph.");
    expect(markdown).toContain("1. Keys\n   - brass\n1. Lamp");
    expect(markdown).toContain("[link](https://example.com)");
    expect(markdown).not.toContain("javascript:");
    // Markers hug the words, or Markdown ignores them.
    expect(markdown).toContain(" ~~struck~~");
    expect(markdown).toContain("---");
  });

  it("marks pictures and numbers lists in plain text", () => {
    const plain = blocksToPlain(blocks);
    expect(plain).toContain("Dear Ana,\nthe house is yours.");
    expect(plain).toContain("[Picture: The lantern house]");
    expect(plain).toContain("1. Keys\n  - brass\n2. Lamp");
    expect(plain).toContain("* * *");
  });

  it("leaves out pictures that aren't stored in the book or on the web", () => {
    const html = blocksToHtml(documentToBlocks({ type: "doc", content: [{ type: "image", attrs: { src: "file:///C:/secret.png" } }] }));
    expect(html).toBe("");
  });
});
