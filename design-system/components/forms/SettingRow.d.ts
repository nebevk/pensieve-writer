import * as React from 'react';

/**
 * Label + control row with hairline separator, for Settings lists.
 */
export interface SettingRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}

export declare function SettingRow(props: SettingRowProps): JSX.Element;
