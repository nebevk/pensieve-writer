import React from 'react';

// Row for sidebars: notes list, to-do filters, settings sections.
export function SidebarItem({ title, subtitle, count, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className="pv-reset pv-i" aria-current={active ? 'true' : undefined} style={{
      display: 'flex', alignItems: subtitle ? 'stretch' : 'center', flexDirection: subtitle ? 'column' : 'row', justifyContent: 'space-between', gap: 1,
      padding: '7px 10px', borderRadius: 'var(--pv-radius-xs)', width: '100%', boxSizing: 'border-box', fontSize: 'var(--pv-text-base)',
      background: active ? 'var(--pv-selected)' : undefined }}>
      <span style={{ fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      {subtitle && <span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>}
      {count != null && !subtitle && <span style={{ color: 'var(--pv-text-faint)' }}>{count}</span>}
    </button>
  );
}
