import React from 'react';

// Chips printed on paper: the chapter a to-do belongs to, or the note it came from.
export function Tag({ kind = 'chapter', children, style }) {
  const note = kind === 'note';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 'var(--pv-radius-xs)',
      fontFamily: 'var(--pv-font-ui)', fontSize: 11, lineHeight: 1.35, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box',
      background: note ? 'var(--pv-ink-tint)' : 'var(--pv-ink-chip)',
      color: note ? 'var(--pv-ink-tint-text)' : 'var(--pv-ink-chip-text)', ...style
    }}>{children}</span>
  );
}
