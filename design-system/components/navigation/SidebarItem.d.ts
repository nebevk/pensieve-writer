import * as React from 'react';

/**
 * Sidebar row: title with optional subtitle or count. Notes list, to-do filters, settings sections.
 */
export interface SidebarItemProps {
  title: string;
  subtitle?: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export declare function SidebarItem(props: SidebarItemProps): JSX.Element;
