import * as React from 'react';

/**
 * The current book's chapters as a row of status bars.
 */
export interface ChapterStripProps {
  book?: string;
  chapters: { title?: string; status: 'final' | 'revising' | 'draft' | 'empty'; words?: string }[];
  activeIndex?: number;
  onSelect?: (i: number) => void;
}

export declare function ChapterStrip(props: ChapterStripProps): JSX.Element;
