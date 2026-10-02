import * as React from 'react';

/**
 * Theme preview tile; renders the real theme tokens in miniature.
 */
export interface ThemeSwatchProps {
  theme?: 'daylight' | 'candlelit' | 'moonlit' | 'sunset';
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export declare function ThemeSwatch(props: ThemeSwatchProps): JSX.Element;
