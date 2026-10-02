import React from 'react';

// The surface behind the page. Dark themes add a lamp glow behind the sheet. No decoration here.
export function Desk({ children, align = 'center', padding = '30px 0 0', style }) {
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--pv-desk)', display: 'flex', justifyContent: align, alignItems: 'flex-start', padding, boxSizing: 'border-box', minWidth: 0, ...style }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: 180, width: 900, height: 700, transform: 'translateX(-50%)', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(closest-side, var(--pv-glow), color-mix(in srgb, var(--pv-glow) 36%, transparent) 55%, transparent)' }} />
      {children}
    </div>
  );
}
