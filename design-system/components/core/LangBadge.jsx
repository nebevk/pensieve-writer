import React from 'react';

export function LangBadge({ code = 'EN', size = 'sm', onClick }) {
  const lg = size === 'lg';
  return (
    <button type="button" className="pv-reset pv-i" onClick={onClick} title="Writing language" style={{
      fontFamily: 'var(--pv-font-ui)', fontSize: lg ? 12 : 'var(--pv-text-xs)', fontWeight: 600, lineHeight: 1.3,
      color: 'var(--pv-text-subtle)', border: '1px solid var(--pv-line-strong)', borderRadius: 'var(--pv-radius-xs)',
      padding: lg ? '2px 6px' : '1px 5px'
    }}>{code}</button>
  );
}
