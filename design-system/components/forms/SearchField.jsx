import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function SearchField({ placeholder = 'Search', value, onChange, style }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', border: '1px solid var(--pv-line-strong)', borderRadius: 'var(--pv-radius-xs)',
      background: 'var(--pv-field)', fontSize: 'var(--pv-text-md)', color: 'var(--pv-text-faint)', boxSizing: 'border-box', ...style }}>
      <Icon name="search" size={13} strokeWidth={2} />
      <input className="pv-input" placeholder={placeholder} value={value} onChange={(e) => onChange && onChange(e.target.value)} style={{ color: 'var(--pv-text)' }} />
    </label>
  );
}
