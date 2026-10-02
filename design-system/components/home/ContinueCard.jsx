import React from 'react';
import { Caret } from '../manuscript/Caret.jsx';
import { Button } from '../core/Button.jsx';

// "Continue writing": a sheet showing your last two lines.
export function ContinueCard({ project, location, previous, current, meta, onContinue, height = 300, label = 'Continue writing' }) {
  return (
    <div style={{ position: 'relative', height }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: 'translate(6px, 7px) rotate(1deg)', background: 'var(--pv-paper-under)', boxShadow: 'var(--pv-shadow-under)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--pv-paper)', backgroundImage: 'var(--pv-grain)', boxShadow: 'var(--pv-shadow-sheet)', padding: '30px 36px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: 'var(--pv-ink)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--pv-text-xs)', letterSpacing: 'var(--pv-track-running)', textTransform: 'uppercase', color: 'var(--pv-ink-meta)' }}><span>{project}</span><span>{location}</span></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, fontFamily: 'var(--pv-font-manuscript)', fontSize: 15, lineHeight: 1.75 }}>
          {previous && <p style={{ margin: 0, opacity: 0.55, color: 'var(--pv-ink-2)' }}>{previous}</p>}
          <p style={{ margin: 0 }}>{current}<Caret height={17} /></p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 'var(--pv-text-md)', color: 'var(--pv-ink-muted)' }}>{meta}</span>
          <Button iconRight="arrowRight" onClick={onContinue} style={{ background: 'var(--pv-ink-accent)' }}>{label}</Button>
        </div>
      </div>
    </div>
  );
}
