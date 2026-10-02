import * as React from 'react';

/**
 * Big Young Serif number with label (Home).
 */
export interface StatProps {
  value: React.ReactNode;
  of?: React.ReactNode;
  label: string;
}

export declare function Stat(props: StatProps): JSX.Element;
