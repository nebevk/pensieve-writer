import React from 'react';

export function Toggle({ checked = false, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange && onChange(!checked)} className="pv-reset pv-f"
      style={{ width: 32, height: 18, borderRadius: 'var(--pv-radius-pill)', position: 'relative', flex: 'none',
        background: checked ? 'var(--pv-success-solid)' : 'var(--pv-line-strong)', transition: 'background-color var(--pv-dur) ease' }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left var(--pv-dur) var(--pv-ease)' }} />
    </button>
  );
}
