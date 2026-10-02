import React from 'react';
import { StatusDot } from './StatusDot.jsx';

export function ChapterItem({ n, title, status = 'draft', words, active, onClick }) {
  const untitled = !title;
  return (
    <button type="button" onClick={onClick} className="pv-reset pv-i" aria-current={active ? 'true' : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', fontSize: 'var(--pv-text-base)', borderRadius: 'var(--pv-radius-xs)', width: '100%', boxSizing: 'border-box',
      background: active ? 'var(--pv-selected)' : undefined, fontWeight: active ? 600 : 400, color: untitled ? 'var(--pv-text-faint)' : 'var(--pv-text)' }}>
      <span style={{ width: 14, fontSize: 11, color: 'var(--pv-text-faint)', fontWeight: 400 }}>{n}</span>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: untitled ? 'italic' : 'normal' }}>{title || 'Untitled'}</span>
      <StatusDot status={status} />
      <span style={{ color: 'var(--pv-text-faint)', fontSize: 'var(--pv-text-sm)', width: 28, textAlign: 'right', fontWeight: 400 }}>{words}</span>
    </button>
  );
}
