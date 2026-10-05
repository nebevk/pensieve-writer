declare module "mammoth" {
  /** One element of mammoth's document model: a paragraph, run, text, link, picture, table and so on. */
  export type MammothElement = {
    type: string;
    children?: MammothElement[];
    value?: string;
    styleId?: string | null;
    styleName?: string | null;
    numbering?: { level: string | number; isOrdered: boolean } | null;
    alignment?: string | null;
    indent?: { start: string | null; end: string | null; firstLine: string | null; hanging: string | null };
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    isStrikethrough?: boolean;
    verticalAlignment?: string;
    highlight?: string | null;
    href?: string;
    anchor?: string;
    breakType?: string;
    noteType?: string;
    noteId?: string;
    contentType?: string;
    altText?: string;
    readAsBase64String?: () => Promise<string>;
  };

  export type MammothDocument = MammothElement & {
    notes: { resolve(reference: MammothElement): { body: MammothElement[] } | null };
  };

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer } | { buffer: Uint8Array },
    options?: {
      /** Called with the document read from the file before it becomes HTML. */
      transformDocument?: (document: MammothDocument) => MammothDocument;
      styleMap?: string[];
    },
  ): Promise<{ value: string; messages: { message: string }[] }>;
}
