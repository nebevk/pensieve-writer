/**
 * Paragraph and character styles the importer recognises when a Pensieve file comes back.
 * Kept apart from the writer so reading a Word file doesn't load the docx library.
 */
export const WORD_STYLES = {
  /** The book's title in files written since 6 October, which follow the page: a Heading 1 begins a part. */
  title: "PensieveBookTitle",
  /** The book's title in older files, where every chapter's title was a Heading 1. */
  oldTitle: "PensieveTitle",
  /** The title of a one-page article, whose headings keep their levels below it. */
  articleTitle: "PensieveArticleTitle",
  chapterLabel: "PensieveChapterLabel",
  dropCap: "PensieveDropCap",
  quote: "Quote",
  highlight: "PensieveHighlight",
  accent: "PensieveAccent",
} as const;
