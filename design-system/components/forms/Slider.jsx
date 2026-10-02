import React from 'react';

export function Slider({ label, value = 17, min = 13, max = 24, step = 1, unit = 'px', onChange }) {
  const fill = ((value - min) / (max - min)) * 100 + '%';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--pv-text-md)' }}>
        <span style={{ fontWeight: 600, color: 'var(--pv-text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--pv-text-subtle)' }}>{value} {unit}</span>
      </div>
      <input type="range" className="pv-range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange && onChange(Number(e.target.value))} style={{ '--pv-fill': fill }} />
    </div>
  );
}
