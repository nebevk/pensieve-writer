import React from 'react';

const P = {
  daylight: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  candlelit: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  moonlit: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
};

// Quick theme switch for the Home header.
export function ThemeSwitch({ value = 'daylight', onChange }) {
  return (
    <div role="radiogroup" aria-label="Theme" style={{ display: 'flex', border: '1px solid var(--pv-line-strong)', borderRadius: 'var(--pv-radius-sm)', overflow: 'hidden' }}>
      {Object.keys(P).map((k) => {
        const on = k === value;
        return (
          <button key={k} type="button" role="radio" aria-checked={on} title={k[0].toUpperCase() + k.slice(1)} onClick={() => onChange && onChange(k)} className={'pv-reset ' + (on ? '' : 'pv-i')}
            style={{ width: 28, height: 24, display: 'grid', placeItems: 'center', background: on ? 'var(--pv-mark-bg)' : undefined, color: on ? 'var(--pv-mark-fg)' : 'var(--pv-text-subtle)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: P[k] }} />
          </button>
        );
      })}
    </div>
  );
}
