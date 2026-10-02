import * as React from 'react';

/**
 * Write / Outline / Book / Notes tabs with a 2px accent underline.
 */
export interface ViewTabsProps {
  views?: string[];
  value?: string;
  onChange?: (v: string) => void;
}

export declare function ViewTabs(props: ViewTabsProps): JSX.Element;
