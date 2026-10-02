import * as React from 'react';

/**
 * A project as a title page with progress and stats underneath.
 */
export interface ProjectCardProps {
  kind: string;
  title: string;
  tone?: 'accent' | 'success' | 'neutral';
  progress?: number;
  stats?: string;
  when?: string;
  stacked?: boolean;
  onClick?: () => void;
}

export declare function ProjectCard(props: ProjectCardProps): JSX.Element;
