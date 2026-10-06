import * as React from 'react';

/**
 * To-do row on chrome (Write panel, Home). Use TodoItem on paper.
 */
export interface ChecklistItemProps {
  text: string;
  state?: 'open' | 'doing' | 'done';
  meta?: string;
  onToggle?: () => void;
  truncate?: boolean;
  padding?: string;
}

export declare function ChecklistItem(props: ChecklistItemProps): JSX.Element;
