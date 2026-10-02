import * as React from 'react';

/**
 * The surface behind pages, notes and slips. Adds the lamp glow in dark themes.
 */
export interface DeskProps {
  children?: React.ReactNode;
  align?: 'center' | 'flex-start';
  padding?: string;
  style?: React.CSSProperties;
}

export declare function Desk(props: DeskProps): JSX.Element;
