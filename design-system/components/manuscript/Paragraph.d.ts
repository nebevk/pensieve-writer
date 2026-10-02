import * as React from 'react';

/**
 * Manuscript paragraph with optional drop cap and caret.
 */
export interface ParagraphProps {
  children: React.ReactNode;
  dropCap?: boolean;
  indent?: boolean;
  caret?: boolean;
}

export declare function Paragraph(props: ParagraphProps): JSX.Element;
