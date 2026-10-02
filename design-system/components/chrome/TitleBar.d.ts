import * as React from 'react';

/**
 * The single 34px window bar: mark, project, view tabs, save state, language, settings.
 * @startingPoint section="Chrome" subtitle="34px window bar with view tabs" viewport="1280x34"
 */
export interface TitleBarProps {
  project?: string;
  view?: string;
  views?: string[];
  onViewChange?: (v: string) => void;
  saveState?: 'saved' | 'saving';
  lang?: string;
  onLang?: () => void;
  onSettings?: () => void;
  onHome?: () => void;
  title?: string;
}

export declare function TitleBar(props: TitleBarProps): JSX.Element;
