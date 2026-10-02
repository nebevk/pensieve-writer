import React from 'react';

// The "P" square. Not a logo file; set in Young Serif.
export function BrandMark({ size = 18, withName = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.46) }}>
      <span style={{ width: size, height: size, borderRadius: 'var(--pv-radius-xs)', background: 'var(--pv-mark-bg)', color: 'var(--pv-mark-fg)',
        display: 'grid', placeItems: 'center', fontFamily: 'var(--pv-font-heading)', fontSize: Math.round(size * 0.66), lineHeight: 1, flex: 'none' }}>P</span>
      {withName && <span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: Math.round(size * 0.73), color: 'var(--pv-text)' }}>Pensieve</span>}
    </span>
  );
}
