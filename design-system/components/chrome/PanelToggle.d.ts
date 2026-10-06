import * as React from 'react';

/**
 * Toolbar toggle that opens a Write side panel.
 */
export interface PanelToggleProps {
  icon: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export declare function PanelToggle(props: PanelToggleProps): JSX.Element;
