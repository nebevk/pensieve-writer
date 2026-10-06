import React from 'react';

// Heading row for a Home column: title, count, link.
export function HomeSection({ title, count, link, onLink, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--pv-divider)', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 19 }}>{title}</span>
        {count != null && <span style={{ fontSize: 'var(--pv-text-md)', color: 'var(--pv-text-faint)' }}>{count}</span>}
        <div style={{ flex: 1 }} />
        {link && <button type="button" className="pv-reset" onClick={onLink} style={{ fontSize: 'var(--pv-text-md)', fontWeight: 600, color: 'var(--pv-accent)' }}>{link}</button>}
      </div>
      {children}
    </div>
  );
}
