import * as React from 'react';

/**
 * Right-column context list: "Appears in" counts or "Linked notes" links.
 */
export interface AsideListProps {
  title: string;
  items: { label: string; value?: string; link?: boolean }[];
  onItem?: (item: any) => void;
}

export declare function AsideList(props: AsideListProps): JSX.Element;
