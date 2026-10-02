import React from 'react';

export function NewProjectTile({ label = 'Start something new', onClick }) {
  return <button type="button" onClick={onClick} className="pv-reset pv-i" style={{ height: 150, border: '1px dashed var(--pv-line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--pv-text-base)', color: 'var(--pv-text-faint)' }}>{label}</button>;
}
