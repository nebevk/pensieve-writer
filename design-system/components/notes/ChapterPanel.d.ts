import * as React from 'react';

/**
 * 300px panel beside the page in Write: the open chapter's to-dos and the notes mentioned in it. First note is expanded.
 * @startingPoint section="Notes" subtitle="Write side panel: chapter to-dos and notes" viewport="300x700"
 */
export interface ChapterPanelProps {
  chapterLabel: string;
  title: string;
  todos?: { text: string; state?: 'open' | 'doing' | 'done'; meta?: string }[];
  notes?: { kind: string; title: string; meta?: string; fields?: [string, string][]; body?: (string | { link: string })[] }[];
  showTodos?: boolean;
  showNotes?: boolean;
  onTodoToggle?: (i: number) => void;
  onAddTodo?: (text: string) => void;
  onOpenNotes?: () => void;
  onClose?: () => void;
  onNote?: (title: string) => void;
}

export declare function ChapterPanel(props: ChapterPanelProps): JSX.Element;
