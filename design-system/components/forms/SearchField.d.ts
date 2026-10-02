import * as React from 'react';

/**
 * 30px search input with a leading icon.
 */
export interface SearchFieldProps {
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  style?: React.CSSProperties;
}

export declare function SearchField(props: SearchFieldProps): JSX.Element;
