import * as React from 'react';

/**
 * Chapter status dot.
 */
export interface StatusDotProps {
  status?: 'final' | 'revising' | 'draft' | 'empty';
  size?: number;
}

export declare function StatusDot(props: StatusDotProps): JSX.Element;
