import * as React from 'react';

/**
 * Home column heading with count and link.
 */
export interface HomeSectionProps {
  title: string;
  count?: number;
  link?: string;
  onLink?: () => void;
  children?: React.ReactNode;
}

export declare function HomeSection(props: HomeSectionProps): JSX.Element;
