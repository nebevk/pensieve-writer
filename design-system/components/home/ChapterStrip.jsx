import React from 'react';

// The current book's chapters as status bars (Home).
export function ChapterStrip({ book, chapters = [], activeIndex, onSelect }) {
  const counts = ['final', 'revising', 'draft', 'empty'].map((s) => [s, chapters.filter((c) => c.status === s).length]).filter(([, n]) => n);
  const bar = (s) => s === 'final' ? { background: 'var(--pv-status-final)' } : s === 'revising' ? { background: 'var(--pv-accent)' }
    : s === 'draft' ? { border: '1.5px solid var(--pv-text-faint)', boxSizing: 'border-box' } : { border: '1.5px dashed var(--pv-empty)', boxSizing: 'border-box' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {book && <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'var(--pv-text-md)' }}><span style={{ fontWeight: 600 }}>{book}</span><span style={{ color: 'var(--pv-text-faint)' }}>{counts.map(([s, n]) => n + ' ' + s).join(' · ')}</span></div>}
      <div style={{ display: 'flex', gap: 6 }}>
        {chapters.map((c, i) => (
          <button key={i} type="button" onClick={() => onSelect && onSelect(i)} className="pv-reset pv-f" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ height: 6, borderRadius: 1, ...bar(c.status) }} />
            <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: i === activeIndex ? 600 : 400, fontStyle: c.title ? 'normal' : 'italic', color: c.title ? 'var(--pv-text)' : 'var(--pv-text-faint)' }}>
              <span style={{ color: 'var(--pv-text-faint)', fontWeight: 400 }}>{i + 1}</span> {c.title || 'Untitled'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--pv-text-faint)', marginTop: -4 }}>{c.words}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
