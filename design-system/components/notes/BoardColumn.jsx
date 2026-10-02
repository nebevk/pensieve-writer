import React from 'react';
import { StatusDot } from '../navigation/StatusDot.jsx';

const DOT = { todo: 'draft', doing: 'revising', done: 'final' };

export function BoardColumn({ title, status = 'todo', count, children }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px' }}>
        <StatusDot status={DOT[status]} size={8} />
        <span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 'var(--pv-heading-md)' }}>{title}</span>
        {count != null && <span style={{ fontSize: 12, color: 'var(--pv-text-faint)' }}>{count}</span>}
      </div>
      {children}
    </div>
  );
}
