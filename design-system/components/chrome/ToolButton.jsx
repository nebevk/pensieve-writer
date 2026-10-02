import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function ToolButton({ icon, children, active, disabled, title, onClick, wide, style }) {
  return (
    <button type="button" title={title} aria-pressed={active ? true : undefined} disabled={disabled} onClick={onClick} className="pv-reset pv-i"
      style={{ minWidth: 'var(--pv-tool-w)', height: 'var(--pv-tool-h)', padding: wide ? '0 7px' : 0, borderRadius: 'var(--pv-radius-xs)',
        display: 'grid', placeItems: 'center', fontSize: 14, whiteSpace: 'nowrap', color: disabled ? 'var(--pv-empty)' : 'inherit',
        background: active ? 'var(--pv-pressed)' : undefined, boxSizing: 'border-box', ...style }}>
      {icon ? <Icon name={icon} size={15} /> : children}
    </button>
  );
}
