import React from 'react';

// To-do box printed on paper. open → doing (half-filled) → done (sage, ticked).
export function Checkbox({ state = 'open', onClick, size = 15 }) {
  const done = state === 'done', doing = state === 'doing';
  return (
    <button type="button" onClick={onClick} aria-label={state} className="pv-reset pv-f" style={{
      width: size, height: size, borderRadius: 'var(--pv-radius-xs)', flex: 'none', boxSizing: 'border-box', display: 'grid', placeItems: 'center', color: '#fff',
      border: done ? 'none' : '1.5px solid ' + (doing ? 'var(--pv-ink-accent)' : 'var(--pv-ink-muted)'),
      background: done ? 'var(--pv-ink-success)' : doing ? 'linear-gradient(135deg, var(--pv-ink-accent) 50%, transparent 50%)' : 'transparent' }}>
      {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>}
    </button>
  );
}
