import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Floats over the desk, bottom centre: ambience, word count, daily goal, Zen.
export function FloatingBar({ ambience = { icon: 'rain', label: 'Rain' }, words = 0, today = 0, goal = 500, onAmbience, onZen, zenLabel = 'Zen', style }) {
  const pct = Math.max(0, Math.min(1, goal ? today / goal : 0));
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 11, height: 'var(--pv-floatbar-h)', padding: '0 3px 0 11px', boxSizing: 'border-box',
      background: 'var(--pv-bar-bg)', border: '1px solid var(--pv-bar-border)', color: 'var(--pv-bar-text)', borderRadius: 'var(--pv-radius-md)',
      boxShadow: 'var(--pv-shadow-bar)', fontFamily: 'var(--pv-font-ui)', fontSize: 'var(--pv-text-sm)', whiteSpace: 'nowrap', ...style }}>
      <button type="button" className="pv-reset" onClick={onAmbience} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--pv-bar-ambient)' }}>
        <Icon name={ambience.icon} size={13} />{ambience.label}
      </button>
      <span style={{ width: 1, height: 12, background: 'var(--pv-bar-line)' }} />
      <span>{words.toLocaleString('en')} words</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pv-bar-muted)' }}>
        Today
        <span style={{ width: 48, height: 2, background: 'var(--pv-bar-line)', display: 'block' }}>
          <span style={{ display: 'block', width: (pct * 100) + '%', height: '100%', background: 'var(--pv-progress)' }} />
        </span>
        {today}/{goal}
      </span>
      <button type="button" className="pv-reset pv-solid" onClick={onZen} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px',
        background: 'var(--pv-accent-solid)', color: 'var(--pv-on-accent)', borderRadius: 'var(--pv-radius-xs)', fontWeight: 600 }}>
        <Icon name="moon" size={11} strokeWidth={2.25} />{zenLabel}
      </button>
    </div>
  );
}
