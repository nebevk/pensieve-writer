import * as React from 'react';

/**
 * Action button: primary (accent fill), secondary (outlined field), ghost (accent text).
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  icon?: string;
  iconRight?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): JSX.Element;
