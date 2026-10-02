import React from 'react';

export function SectionLabel({ children, onPaper = false, style }) {
  return <div style={{ padding: '12px 10px 4px', fontFamily: 'var(--pv-font-ui)', fontSize: 'var(--pv-text-xs)', letterSpacing: 'var(--pv-track-eyebrow)', textTransform: 'uppercase',
    fontWeight: 600, color: onPaper ? 'var(--pv-ink-muted)' : 'var(--pv-text-faint)', ...style }}>{children}</div>;
}
