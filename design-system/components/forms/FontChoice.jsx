import React from 'react';

export function FontChoice({ family = 'var(--pv-font-manuscript)', name, selected, onClick, sampleSize = 20 }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="pv-reset pv-f" style={{
      width: 120, padding: '10px 12px', borderRadius: 'var(--pv-radius-sm)', background: 'var(--pv-field)', boxSizing: 'border-box',
      border: selected ? '1.5px solid var(--pv-accent)' : '1px solid var(--pv-line-strong)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: family, fontSize: sampleSize, lineHeight: 1.3 }}>Aa</span>
      <span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-text-subtle)' }}>{name}</span>
    </button>
  );
}
