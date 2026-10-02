import React from 'react';

export function SettingRow({ label, hint, children, last = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 0', fontSize: 'var(--pv-text-base)', borderBottom: last ? 'none' : '1px solid var(--pv-line)' }}>
      <span>{label}{hint && <span style={{ color: 'var(--pv-text-faint)', fontSize: 12 }}> · {hint}</span>}</span>
      {children}
    </div>
  );
}
