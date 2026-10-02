import * as React from 'react';

/**
 * One chapter row: number, title, status, word count.
 */
export interface ChapterItemProps {
  n: number;
  title?: string;
  status?: 'final' | 'revising' | 'draft' | 'empty';
  words?: string | number;
  active?: boolean;
  onClick?: () => void;
}

export declare function ChapterItem(props: ChapterItemProps): JSX.Element;
