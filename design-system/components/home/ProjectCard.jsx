import React from 'react';

const TONE = { accent: 'var(--pv-ink-accent)', success: 'var(--pv-ink-success)', neutral: 'var(--pv-ink-muted)' };

// A project as a title page on the desk, stats underneath. stacked = has more than one manuscript.
export function ProjectCard({ kind, title, tone = 'accent', progress = 0, stats, when, stacked = false, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <button type="button" onClick={onClick} className="pv-reset pv-lift" style={{ height: 150, backgroundColor: 'var(--pv-paper)', color: 'var(--pv-ink)',
        boxShadow: 'var(--pv-shadow-card)' + (stacked ? ', 4px 4px 0 -1px var(--pv-paper-under), 4px 4px 0 0 var(--pv-line-strong)' : ''),
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--pv-font-manuscript)', textAlign: 'center', padding: '0 20px' }}>
        <span style={{ fontSize: 10, letterSpacing: 'var(--pv-track-chapter)', textTransform: 'uppercase', color: TONE[tone] }}>{kind}</span>
        <span style={{ fontSize: 19 }}>{title}</span>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 2, background: 'var(--pv-divider)' }}><div style={{ width: Math.round(progress * 100) + '%', height: '100%', background: tone === 'success' ? 'var(--pv-success)' : tone === 'neutral' ? 'var(--pv-success)' : 'var(--pv-accent)' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--pv-text-md)', color: 'var(--pv-text-subtle)' }}><span>{stats}</span><span>{when}</span></div>
      </div>
    </div>
  );
}
