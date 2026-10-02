import React from 'react';

const WIDTHS = { narrow: 'var(--pv-sheet-narrow)', book: 'var(--pv-sheet-book)', wide: 'var(--pv-sheet-wide)' };

// A manuscript page: square, grained, with the next sheet peeking out underneath.
export function Sheet({ project, folio, chapterLabel, title, children, width = 'book', height = 840, runningHead = true, grain = true, under = true, fontFamily, style }) {
  return (
    <div style={{ position: 'relative', width: WIDTHS[width] || width, minHeight: height, flex: 'none', ...style }}>
      {under && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: 'translate(5px, 6px) rotate(.6deg)', background: 'var(--pv-paper-under)', boxShadow: 'var(--pv-shadow-under)' }} />}
      <article style={{ position: 'relative', minHeight: height, boxSizing: 'border-box', padding: 'var(--pv-sheet-pad-y) var(--pv-sheet-pad-x)',
        backgroundColor: 'var(--pv-paper)', backgroundImage: grain ? 'var(--pv-grain), var(--pv-vignette)' : 'var(--pv-vignette)',
        boxShadow: 'var(--pv-shadow-sheet)', fontFamily: fontFamily || 'var(--pv-font-manuscript)', color: 'var(--pv-ink)' }}>
        {runningHead && (project || folio) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--pv-text-xs)', letterSpacing: 'var(--pv-track-running)', textTransform: 'uppercase', color: 'var(--pv-ink-meta)', marginBottom: 64 }}>
            <span>{project}</span><span>{folio}</span>
          </div>
        )}
        {chapterLabel && <div style={{ textAlign: 'center', fontSize: 12, letterSpacing: 'var(--pv-track-chapter)', textTransform: 'uppercase', color: 'var(--pv-ink-accent)', marginBottom: 12 }}>{chapterLabel}</div>}
        {title && <div style={{ textAlign: 'center', fontSize: 'var(--pv-chapter-title)', marginBottom: 44 }}>{title}</div>}
        {children}
      </article>
    </div>
  );
}
