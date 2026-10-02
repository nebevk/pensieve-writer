import * as React from 'react';

/**
 * Manuscript font tile in Settings.
 */
export interface FontChoiceProps {
  family?: string;
  name: string;
  selected?: boolean;
  onClick?: () => void;
  sampleSize?: number;
}

export declare function FontChoice(props: FontChoiceProps): JSX.Element;
