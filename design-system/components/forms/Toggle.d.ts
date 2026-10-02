import * as React from 'react';

/**
 * 32×18 switch, sage when on.
 */
export interface ToggleProps {
  checked?: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
}

export declare function Toggle(props: ToggleProps): JSX.Element;
