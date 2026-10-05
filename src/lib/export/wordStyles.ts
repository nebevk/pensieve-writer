/**
 * Paragraph and character styles the importer recognises when a Pensieve file comes back.
 * Kept apart from the writer so reading a Word file doesn't load the docx library.
 */
export const WORD_STYLES = {
  title: "PensieveTitle",
  chapterLabel: "PensieveChapterLabel",
  dropCap: "PensieveDropCap",
  quote: "Quote",
  highlight: "PensieveHighlight",
  accent: "PensieveAccent",
} as const;
