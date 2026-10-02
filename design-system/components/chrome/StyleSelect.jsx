import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Select trigger used in the toolbar (paragraph style, font, size).
export function StyleSelect({ value, manuscript = false, compact = false, onClick, raised = false }) {
  return (
    <button type="button" className="pv-reset pv-f" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: compact ? 6 : 8, height: 'var(--pv-tool-h)', padding: compact ? '0 7px' : '0 9px',
      border: '1px solid var(--pv-line-strong)', borderRadius: 'var(--pv-radius-xs)', boxSizing: 'border-box',
      background: raised ? 'var(--pv-paper)' : 'var(--pv-field)', color: raised ? 'var(--pv-ink)' : 'inherit',
      fontFamily: manuscript ? 'var(--pv-font-manuscript)' : 'var(--pv-font-ui)', fontSize: manuscript ? 13 : 'var(--pv-text-md)', whiteSpace: 'nowrap'
    }}>{value}<Icon name="chevronDown" size={11} strokeWidth={2} /></button>
  );
}
