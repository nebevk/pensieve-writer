import * as React from 'react';

/**
 * To-do box printed on paper: open, doing (half-filled accent), done (sage tick).
 */
export interface CheckboxProps {
  state?: 'open' | 'doing' | 'done';
  onClick?: () => void;
  size?: number;
}

export declare function Checkbox(props: CheckboxProps): JSX.Element;
