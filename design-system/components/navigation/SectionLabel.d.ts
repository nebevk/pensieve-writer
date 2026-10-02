import * as React from 'react';

/**
 * Uppercase tracked eyebrow for sidebar groups (Characters, Places, By chapter).
 */
export interface SectionLabelProps {
  children: React.ReactNode;
  onPaper?: boolean;
  style?: React.CSSProperties;
}

export declare function SectionLabel(props: SectionLabelProps): JSX.Element;
