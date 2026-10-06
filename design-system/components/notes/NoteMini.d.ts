import * as React from 'react';

/**
 * Compact paper note: one-line row (Write panel) or small card (Home).
 */
export interface NoteMiniProps {
  kind: string;
  title: string;
  meta?: string;
  variant?: 'row' | 'card';
  onClick?: () => void;
}

export declare function NoteMini(props: NoteMiniProps): JSX.Element;
