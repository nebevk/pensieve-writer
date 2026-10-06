import React from 'react';

const ROW_TONE = { accent: 'var(--pv-ink-accent)', success: 'var(--pv-ink-success)' };

// Compact project row with a tiny title page, language and progress (Home bottom row).
export function ProjectRow({ kind, title, lang = 'EN', status, progress = 0, tone = 'accent', stacked = false, onClick }) {
  const col = ROW_TONE[tone] || ROW_TONE.accent;
  return (
    <button type="button" onClick={onClick} className="pv-reset pv-i" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '6px 4px', borderRadius: 'var(--pv-radius-xs)', width: '100%', boxSizing: 'border-box' }}>
      <span style={{ width: 42, height: 54, flex: 'none', background: 'var(--pv-paper)', display: 'grid', placeItems: 'center', fontFamily: 'var(--pv-font-manuscript)', fontSize: 13, color: col,
        boxShadow: 'var(--pv-shadow-slip)' + (stacked ? ', 3px 3px 0 -1px var(--pv-paper-under), 3px 3px 0 0 var(--pv-line-strong)' : '') }}>{title[0]}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 'var(--pv-text-base)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{title}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--pv-text-subtle)', border: '1px solid var(--pv-line-strong)', borderRadius: 'var(--pv-radius-xs)', padding: '0 4px' }}>{lang}</span>
        </span>
        <span style={{ height: 2, background: 'var(--pv-divider)', display: 'block' }}><span style={{ display: 'block', width: Math.round(progress * 100) + '%', height: '100%', background: col }} /></span>
        <span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-text-subtle)' }}>{kind} · {status}</span>
      </span>
    </button>
  );
}
