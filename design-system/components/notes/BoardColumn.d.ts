import * as React from 'react';

/**
 * To do / Doing / Done column heading + slips.
 */
export interface BoardColumnProps {
  title: string;
  status?: 'todo' | 'doing' | 'done';
  count?: number;
  children?: React.ReactNode;
}

export declare function BoardColumn(props: BoardColumnProps): JSX.Element;
