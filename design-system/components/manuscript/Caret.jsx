import React from 'react';

export function Caret({ height = 19 }) {
  return <span aria-hidden="true" style={{ display: 'inline-block', width: 1.5, height, background: 'var(--pv-ink-accent)', verticalAlign: -4, marginLeft: 2 }} />;
}
