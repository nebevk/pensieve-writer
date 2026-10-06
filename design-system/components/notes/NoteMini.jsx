import React from 'react';

// Compact note on paper. row = one line (Write panel); card = kind + title (Home).
export function NoteMini({ kind, title, meta, variant = 'row', onClick }) {
  const base = { backgroundColor: 'var(--pv-paper)', backgroundImage: 'var(--pv-grain)', boxShadow: 'var(--pv-shadow-slip)', color: 'var(--pv-ink)', fontFamily: 'var(--pv-font-ui)', textAlign: 'left', boxSizing: 'border-box', width: '100%' };
  const k = <span style={{ fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--pv-ink-accent)', fontWeight: 600 }}>{kind}</span>;
  if (variant === 'card') return (
    <button type="button" onClick={onClick} className="pv-reset pv-lift" style={{ ...base, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 14px' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>{k}<span style={{ fontSize: 11, color: 'var(--pv-ink-muted)' }}>{meta}</span></span>
      <span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 15 }}>{title}</span>
    </button>
  );
  return (
    <button type="button" onClick={onClick} className="pv-reset pv-lift" style={{ ...base, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
      <span style={{ width: 62, flex: 'none' }}>{k}</span>
      <span style={{ flex: 1, fontSize: 'var(--pv-text-base)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      <span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-ink-muted)' }}>{meta}</span>
    </button>
  );
}
