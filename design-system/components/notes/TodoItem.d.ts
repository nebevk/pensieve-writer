import * as React from 'react';

/**
 * Checkbox + text + optional chapter meta, on paper.
 */
export interface TodoItemProps {
  text: string;
  state?: 'open' | 'doing' | 'done';
  meta?: string;
  onToggle?: () => void;
}

export declare function TodoItem(props: TodoItemProps): JSX.Element;
