import * as React from 'react';

/**
 * Formatting toolbar: the quiet row by default, the grouped "All tools" row when expanded.
 * @startingPoint section="Chrome" subtitle="Quiet or full formatting toolbar" viewport="1280x60"
 */
export interface ToolbarProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
  active?: string[];
  onTool?: (id: string) => void;
  paragraphStyle?: string;
  font?: string;
  size?: number;
  panels?: { todos?: boolean; notes?: boolean; todosCount?: number; notesCount?: number };
  onPanel?: (p: 'todos' | 'notes') => void;
}

export declare function Toolbar(props: ToolbarProps): JSX.Element;
