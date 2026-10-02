import * as React from 'react';

/**
 * A note as an index card: kind, title, fields, free text, its own to-dos.
 * @startingPoint section="Notes" subtitle="Index-card note" viewport="700x560"
 */
export interface NoteCardProps {
  kind?: string;
  edited?: string;
  title: string;
  fields?: [string, string][];
  children?: React.ReactNode;
  todos?: { text: string; state?: 'open' | 'doing' | 'done'; meta?: string }[];
  onTodoToggle?: (i: number) => void;
  width?: number | string;
}

export declare function NoteCard(props: NoteCardProps): JSX.Element;
