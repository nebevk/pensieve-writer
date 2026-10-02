import * as React from 'react';

/**
 * Outlined language code in the title bar and Home header.
 */
export interface LangBadgeProps {
  code?: string;
  size?: 'sm' | 'lg';
  onClick?: () => void;
}

export declare function LangBadge(props: LangBadgeProps): JSX.Element;
