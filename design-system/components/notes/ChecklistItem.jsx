import React from 'react';

// To-do row on chrome (Write side panel, Home). For to-dos printed on paper use TodoItem.
export function ChecklistItem({ text, state = 'open', meta, onToggle, truncate = false, padding = '7px 8px' }) {
  const done = state === 'done', doing = state === 'doing';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding, borderRadius: 'var(--pv-radius-xs)', fontSize: 'var(--pv-text-base)', lineHeight: 1.35, color: done ? 'var(--pv-text-faint)' : 'var(--pv-text)' }}>
      <button type="button" onClick={onToggle} aria-label={state} className="pv-reset pv-f" style={{ width: 15, height: 15, marginTop: 1, borderRadius: 'var(--pv-radius-xs)', flex: 'none', boxSizing: 'border-box', display: 'grid', placeItems: 'center', color: 'var(--pv-chrome)',
        border: done ? 'none' : '1.5px solid ' + (doing ? 'var(--pv-accent)' : 'var(--pv-text-faint)'),
        background: done ? 'var(--pv-success)' : doing ? 'linear-gradient(135deg, var(--pv-accent) 50%, transparent 50%)' : 'transparent' }}>
        {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>}
      </button>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', textDecoration: done ? 'line-through' : 'none', ...(truncate ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }}>{text}</span>
        {meta && <span style={{ display: 'block', fontSize: 'var(--pv-text-sm)', color: 'var(--pv-text-faint)', marginTop: 2 }}>{meta}</span>}
      </span>
    </div>
  );
}
