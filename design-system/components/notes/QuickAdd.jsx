import React from 'react';

// "Add a to-do…" strip on paper. Enter submits.
export function QuickAdd({ placeholder = 'Add a to-do…', hint = 'Enter to add', onAdd, style }) {
  const [v, setV] = React.useState('');
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 14px', background: 'var(--pv-paper)', boxShadow: 'var(--pv-shadow-field)',
      fontFamily: 'var(--pv-font-ui)', fontSize: 'var(--pv-text-base)', color: 'var(--pv-ink-muted)', maxWidth: 560, boxSizing: 'border-box', ...style }}>
      <span style={{ fontSize: 17, color: 'var(--pv-ink-accent)', lineHeight: 1 }}>+</span>
      <input className="pv-input pv-input-ink" placeholder={placeholder} value={v} style={{ color: 'var(--pv-ink)' }}
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onAdd && onAdd(v.trim()); setV(''); } }} />
      <span style={{ fontSize: 'var(--pv-text-sm)' }}>{hint}</span>
    </label>
  );
}
