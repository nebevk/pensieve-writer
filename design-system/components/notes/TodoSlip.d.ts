import * as React from 'react';

/**
 * A paper slip on the to-do board.
 */
export interface TodoSlipProps {
  text: string;
  done?: boolean;
  tags?: { label: string; kind?: 'chapter' | 'note' }[];
  onClick?: () => void;
}

export declare function TodoSlip(props: TodoSlipProps): JSX.Element;
