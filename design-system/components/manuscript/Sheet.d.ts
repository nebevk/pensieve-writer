import * as React from 'react';

/**
 * A manuscript page: square, grained, running head, chapter opening, next sheet underneath.
 * @startingPoint section="Manuscript" subtitle="Manuscript page on the desk" viewport="700x500"
 */
export interface SheetProps {
  project?: string;
  folio?: string;
  chapterLabel?: string;
  title?: string;
  children?: React.ReactNode;
  width?: 'narrow' | 'book' | 'wide' | number;
  height?: number;
  runningHead?: boolean;
  grain?: boolean;
  under?: boolean;
  fontFamily?: string;
  style?: React.CSSProperties;
}

export declare function Sheet(props: SheetProps): JSX.Element;
