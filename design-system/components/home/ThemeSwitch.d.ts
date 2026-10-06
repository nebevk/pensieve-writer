import * as React from 'react';

/**
 * Three-icon theme switch for the Home header.
 */
export interface ThemeSwitchProps {
  value?: 'daylight' | 'candlelit' | 'moonlit';
  onChange?: (v: string) => void;
}

export declare function ThemeSwitch(props: ThemeSwitchProps): JSX.Element;
