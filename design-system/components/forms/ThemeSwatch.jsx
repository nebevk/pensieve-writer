import React from 'react';

function Mini({ theme, half }) {
  return (
    <div data-theme={theme} style={{ position: 'absolute', inset: 0, background: 'var(--pv-desk)', overflow: 'hidden', clipPath: half === 'l' ? 'inset(0 50% 0 0)' : half === 'r' ? 'inset(0 0 0 50%)' : undefined }}>
      {theme === 'daylight'
        ? <span style={{ position: 'absolute', right: -20, top: -20, width: 60, height: 60, borderRadius: '50%', background: 'var(--pv-decor-1)' }} />
        : <span style={{ position: 'absolute', left: '50%', top: 30, width: 160, height: 120, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(closest-side, var(--pv-glow), transparent)' }} />}
      <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 70, height: 72, background: 'var(--pv-paper)', boxShadow: '0 2px 6px rgba(0,0,0,.15)', padding: 10, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ height: 2, background: 'var(--pv-ink-rule)' }} /><span style={{ height: 2, background: 'var(--pv-ink-rule)' }} /><span style={{ height: 2, width: '70%', background: 'var(--pv-ink-rule)' }} />
      </div>
    </div>
  );
}

// theme: daylight | candlelit | moonlit | sunset (follows sunset: daylight → candlelit)
export function ThemeSwatch({ theme = 'daylight', label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className="pv-reset pv-f" style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 'var(--pv-text-md)', textAlign: 'left' }}>
      <span style={{ display: 'block', position: 'relative', width: 150, height: 90, borderRadius: 'var(--pv-radius-sm)', overflow: 'hidden',
        outline: selected ? '2px solid var(--pv-accent)' : 'none', outlineOffset: 2 }}>
        {theme === 'sunset' ? <><Mini theme="daylight" half="l" /><Mini theme="candlelit" half="r" /></> : <Mini theme={theme} />}
      </span>
      <span style={{ fontWeight: selected ? 600 : 400 }}>{label}</span>
    </button>
  );
}
