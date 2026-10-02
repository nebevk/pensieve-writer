import React from 'react';

// Context list in the right column: "Appears in", "Linked notes".
export function AsideList({ title, items = [], onItem }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 'var(--pv-heading-sm)' }}>{title}</div>
      {items.map((it, i) => it.link
        ? <button key={i} type="button" className="pv-reset" onClick={() => onItem && onItem(it)} style={{ fontSize: 13, color: 'var(--pv-accent)', textAlign: 'left' }}>{it.label}</button>
        : <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{it.label}</span><span style={{ color: 'var(--pv-text-faint)' }}>{it.value}</span></div>)}
    </div>
  );
}
