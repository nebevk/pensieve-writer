import React from 'react';
import { Tag } from '../core/Tag.jsx';

// A paper slip on the to-do board.
export function TodoSlip({ text, done = false, tags = [], onClick }) {
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} className={onClick ? 'pv-lift' : undefined} style={{
      backgroundColor: 'var(--pv-paper)', backgroundImage: 'var(--pv-grain)', boxShadow: 'var(--pv-shadow-slip)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--pv-font-ui)', color: 'var(--pv-ink)' }}>
      <div style={{ fontSize: 'var(--pv-text-lg)', lineHeight: 1.4, color: done ? 'var(--pv-ink-muted)' : undefined, textDecoration: done ? 'line-through' : 'none' }}>{text}</div>
      {tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{tags.map((t, i) => <Tag key={i} kind={t.kind}>{t.label}</Tag>)}</div>}
    </div>
  );
}
