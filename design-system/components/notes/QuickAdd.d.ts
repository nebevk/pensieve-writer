import * as React from 'react';

/**
 * "Add a to-do…" strip on paper; Enter submits.
 */
export interface QuickAddProps {
  placeholder?: string;
  hint?: string;
  onAdd?: (text: string) => void;
  style?: React.CSSProperties;
}

export declare function QuickAdd(props: QuickAddProps): JSX.Element;
