import * as React from 'react';

/**
 * A labelled cluster in the expanded toolbar.
 */
export interface ToolGroupProps {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}

export declare function ToolGroup(props: ToolGroupProps): JSX.Element;
