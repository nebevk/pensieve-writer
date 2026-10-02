import * as React from 'react';

/**
 * Lucide glyph at Pensieve's 1.75 stroke.
 */
export interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}

export declare function Icon(props: IconProps): JSX.Element;
