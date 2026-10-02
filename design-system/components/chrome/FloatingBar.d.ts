import * as React from 'react';

/**
 * Status pill floating over the desk: ambience, words, daily goal, Zen.
 */
export interface FloatingBarProps {
  ambience?: { icon: string; label: string };
  words?: number;
  today?: number;
  goal?: number;
  onAmbience?: () => void;
  onZen?: () => void;
  zenLabel?: string;
  style?: React.CSSProperties;
}

export declare function FloatingBar(props: FloatingBarProps): JSX.Element;
