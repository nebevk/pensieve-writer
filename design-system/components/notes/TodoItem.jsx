import React from 'react';
import { Checkbox } from '../forms/Checkbox.jsx';

export function TodoItem({ text, state = 'open', meta, onToggle }) {
  const done = state === 'done';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'var(--pv-font-ui)', fontSize: 'var(--pv-text-lg)', color: done ? 'var(--pv-ink-muted)' : 'var(--pv-ink)' }}>
      <span style={{ marginTop: 2 }}><Checkbox state={state} onClick={onToggle} /></span>
      <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none' }}>
        {text}
        {meta && <span style={{ display: 'block', fontSize: 'var(--pv-text-sm)', color: 'var(--pv-ink-muted)', marginTop: 1 }}>{meta}</span>}
      </span>
    </div>
  );
}
