import * as React from 'react';

/**
 * Dropdown trigger in the toolbar (paragraph style, font, size).
 */
export interface StyleSelectProps {
  value: string;
  manuscript?: boolean;
  compact?: boolean;
  raised?: boolean;
  onClick?: () => void;
}

export declare function StyleSelect(props: StyleSelectProps): JSX.Element;
