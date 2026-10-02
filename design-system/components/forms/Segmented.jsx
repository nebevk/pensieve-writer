import React from 'react';

// Segmented choice with a solid ink selection. Used for Notes / To-dos and Page width.
export function Segmented({ options = [], value, onChange, block = false }) {
  const opts = options.map((o) => typeof o === 'string' ? { value: o, label: o } : o);
  return (
    <div role="radiogroup" style={{ display: 'flex', border: '1px solid var(--pv-line-strong)', borderRadius: 'var(--pv-radius-sm)', overflow: 'hidden',
      fontSize: 'var(--pv-text-md)', alignSelf: block ? 'stretch' : 'flex-start', width: block ? '100%' : undefined, boxSizing: 'border-box' }}>
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange && onChange(o.value)} className={'pv-reset ' + (on ? '' : 'pv-i')}
            style={{ flex: block ? 1 : 'none', textAlign: 'center', padding: block ? '6px 0' : '5px 14px', fontWeight: on ? 600 : 400,
              background: on ? 'var(--pv-mark-bg)' : undefined, color: on ? 'var(--pv-mark-fg)' : 'var(--pv-text)' }}>
            {o.label}{o.count != null && <span style={{ opacity: 0.6 }}> {o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
