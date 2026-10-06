import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Toolbar toggle that opens a side panel in Write (To-dos, Notes).
export function PanelToggle({ icon, label, count, active, onClick }) {
  return (
    <button type="button" aria-pressed={!!active} onClick={onClick} className="pv-reset pv-i" style={{
      display: 'flex', alignItems: 'center', gap: 6, height: 'var(--pv-tool-h)', padding: '0 9px', borderRadius: 'var(--pv-radius-xs)',
      fontSize: 'var(--pv-text-md)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
      background: active ? 'var(--pv-pressed)' : undefined, color: active ? 'var(--pv-text)' : 'var(--pv-text-muted)' }}>
      <Icon name={icon} size={14} />{label}{count != null && <span style={{ fontWeight: 400, color: 'var(--pv-text-faint)' }}>{count}</span>}
    </button>
  );
}
