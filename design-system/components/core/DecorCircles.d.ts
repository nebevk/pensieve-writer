import * as React from 'react';

/**
 * Soft Organic circles for Home and Settings only. Parent must be position:relative; overflow:hidden.
 */
export interface DecorCirclesProps {
  variant?: 'settings' | 'home';
}

export declare function DecorCircles(props: DecorCirclesProps): JSX.Element;
