import * as React from 'react';

/**
 * Sage "Saved" tick or a muted "Saving…" state.
 */
export interface SavedIndicatorProps {
  state?: 'saved' | 'saving';
  label?: string;
  size?: 'sm' | 'lg';
}

export declare function SavedIndicator(props: SavedIndicatorProps): JSX.Element;
