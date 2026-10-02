import React from 'react';

// Soft circles from Organic. Only on Home and Settings, never behind the manuscript.
export function DecorCircles({ variant = 'settings' }) {
  const c = (s) => <span aria-hidden="true" style={{ position: 'absolute', borderRadius: '50%', pointerEvents: 'none', ...s }} />;
  if (variant === 'home') return (
    <>
      {c({ right: -140, top: -160, width: 420, height: 420, background: 'var(--pv-decor-1)', opacity: 0.55 })}
      {c({ right: 300, top: 120, width: 56, height: 56, background: 'var(--pv-decor-2)', opacity: 0.8 })}
    </>
  );
  return (
    <>
      {c({ left: -60, bottom: -80, width: 220, height: 220, background: 'var(--pv-decor-2)', opacity: 0.5 })}
      {c({ left: 120, bottom: 70, width: 44, height: 44, background: 'var(--pv-decor-1)', opacity: 0.6 })}
    </>
  );
}
