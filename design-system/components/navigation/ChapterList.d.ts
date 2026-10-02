import * as React from 'react';

/**
 * The 232px chapter sidebar with heading, add button and status legend.
 */
export interface ChapterListProps {
  title?: string;
  chapters: { title?: string; status?: string; words?: string | number }[];
  activeIndex?: number;
  onSelect?: (i: number) => void;
  onAdd?: (() => void) | null;
  legend?: boolean;
  width?: number | string;
}

export declare function ChapterList(props: ChapterListProps): JSX.Element;
