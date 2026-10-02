import * as React from 'react';

/**
 * A [[link]] to another note, inside text on paper.
 */
export interface NoteLinkProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export declare function NoteLink(props: NoteLinkProps): JSX.Element;
