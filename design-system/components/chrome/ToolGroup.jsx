import React from 'react';

// A labelled group in the expanded "All tools" row.
export function ToolGroup({ label, children, last = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 8px', borderRight: last ? 'none' : '1px solid var(--pv-divider)' }}>
      <div style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }}>{children}</div>
      <div style={{ fontSize: 'var(--pv-text-2xs)', color: 'var(--pv-text-faint)', textAlign: 'center', paddingBottom: 5 }}>{label}</div>
    </div>
  );
}
