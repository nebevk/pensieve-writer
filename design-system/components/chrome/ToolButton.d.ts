import * as React from 'react';

/**
 * 28×26 toolbar button holding an icon or a glyph.
 */
export interface ToolButtonProps {
  icon?: string;
  children?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  wide?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export declare function ToolButton(props: ToolButtonProps): JSX.Element;
