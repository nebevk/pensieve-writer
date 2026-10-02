import React from 'react';

export function Stat({ value, of, label }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 28 }}>{value}{of != null && <span style={{ fontSize: 16, color: 'var(--pv-text-faint)' }}> / {of}</span>}</div>
      <div style={{ fontSize: 'var(--pv-text-md)', color: 'var(--pv-text-subtle)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
