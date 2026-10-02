import * as React from 'react';

/**
 * Labelled range with value readout.
 */
export interface SliderProps {
  label: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange?: (v: number) => void;
}

export declare function Slider(props: SliderProps): JSX.Element;
