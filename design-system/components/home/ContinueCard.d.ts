import * as React from 'react';

/**
 * "Continue writing" sheet showing the last two lines.
 */
export interface ContinueCardProps {
  project: string;
  location?: string;
  previous?: string;
  current: string;
  meta?: string;
  onContinue?: () => void;
  onZen?: () => void;
  height?: number;
  label?: string;
}

export declare function ContinueCard(props: ContinueCardProps): JSX.Element;
