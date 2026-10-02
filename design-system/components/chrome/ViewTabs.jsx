import React from 'react';

export function ViewTabs({ views = ['Write', 'Outline', 'Book', 'Notes'], value = 'Write', onChange }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 20, height: '100%' }}>
      {views.map((v) => {
        const on = v === value;
        return (
          <button key={v} role="tab" aria-selected={on} type="button" className="pv-reset pv-tab" onClick={() => onChange && onChange(v)}
            style={{ display: 'flex', alignItems: 'center', height: '100%', fontSize: 'var(--pv-text-md)', fontWeight: on ? 600 : 400,
              color: on ? 'var(--pv-text)' : 'var(--pv-text-subtle)', boxShadow: on ? 'inset 0 -2px var(--pv-accent)' : 'none' }}>{v}</button>
        );
      })}
    </div>
  );
}
