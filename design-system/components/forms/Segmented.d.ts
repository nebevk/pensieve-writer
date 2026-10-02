import * as React from 'react';

/**
 * Segmented choice with a solid ink selection.
 */
export interface SegmentedProps {
  options: (string | { value: string; label: string; count?: number })[];
  value: string;
  onChange?: (v: string) => void;
  block?: boolean;
}

export declare function Segmented(props: SegmentedProps): JSX.Element;
