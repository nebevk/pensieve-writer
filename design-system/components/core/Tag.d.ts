import * as React from 'react';

/**
 * Small chip printed on paper: the chapter or note a to-do belongs to.
 */
export interface TagProps {
  kind?: 'chapter' | 'note';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function Tag(props: TagProps): JSX.Element;
