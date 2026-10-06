import * as React from 'react';

/**
 * Compact project row: mini title page, language, progress.
 */
export interface ProjectRowProps {
  kind: string;
  title: string;
  lang?: string;
  status?: string;
  progress?: number;
  tone?: 'accent' | 'success';
  stacked?: boolean;
  onClick?: () => void;
}

export declare function ProjectRow(props: ProjectRowProps): JSX.Element;
