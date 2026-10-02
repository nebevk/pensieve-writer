import React from 'react';
import { ChapterItem } from './ChapterItem.jsx';
import { StatusDot } from './StatusDot.jsx';

export function ChapterList({ title = 'Chapters', chapters = [], activeIndex = 0, onSelect, onAdd, legend = true, width }) {
  return (
    <nav style={{ width: width || 'var(--pv-sidebar-w)', flex: 'none', borderRight: '1px solid var(--pv-line)', padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: 1, boxSizing: 'border-box', background: 'var(--pv-chrome)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 10px' }}>
        <span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 'var(--pv-heading-sm)' }}>{title}</span>
        {onAdd !== null && <button type="button" className="pv-reset pv-i" onClick={onAdd} title="New chapter" style={{ fontSize: 19, lineHeight: 1, color: 'var(--pv-accent)', padding: '0 4px', borderRadius: 'var(--pv-radius-xs)' }}>+</button>}
      </div>
      {chapters.map((c, i) => <ChapterItem key={i} n={i + 1} {...c} active={i === activeIndex} onClick={() => onSelect && onSelect(i)} />)}
      <div style={{ flex: 1 }} />
      {legend && (
        <div style={{ display: 'flex', gap: 12, padding: '0 8px', fontSize: 11, color: 'var(--pv-text-subtle)' }}>
          {[['final', 'Final'], ['revising', 'Revising'], ['draft', 'Draft']].map(([s, l]) => <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><StatusDot status={s} />{l}</span>)}
        </div>
      )}
    </nav>
  );
}
