import React from 'react';

// final = sage fill, revising = accent fill, draft = outline, empty = faint outline
export function StatusDot({ status = 'draft', size = 6 }) {
  const fill = { final: 'var(--pv-status-final)', revising: 'var(--pv-accent)' }[status];
  const ring = { draft: 'var(--pv-text-faint)', empty: 'var(--pv-empty)' }[status];
  return <span aria-label={status} style={{ width: size, height: size, borderRadius: '50%', flex: 'none', boxSizing: 'border-box',
    background: fill || 'transparent', border: ring ? '1.5px solid ' + ring : 'none' }} />;
}
