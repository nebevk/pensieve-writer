import React from 'react';
import { Caret } from './Caret.jsx';

// Manuscript paragraph. First paragraph of a chapter takes the drop cap and no indent.
export function Paragraph({ children, dropCap = false, indent, caret = false }) {
  const text = typeof children === 'string' ? children : null;
  const ind = indent != null ? indent : !dropCap;
  return (
    <p style={{ fontSize: 'var(--pv-manuscript-size)', lineHeight: 'var(--pv-manuscript-leading)', margin: 0, textIndent: ind ? 'var(--pv-manuscript-indent)' : 0, textWrap: 'pretty' }}>
      {dropCap && text
        ? <><span style={{ float: 'left', fontSize: 'var(--pv-dropcap)', lineHeight: 0.9, margin: '6px 8px 0 0', color: 'var(--pv-ink-accent)' }}>{text[0]}</span>{text.slice(1)}</>
        : children}
      {caret && <Caret />}
    </p>
  );
}
