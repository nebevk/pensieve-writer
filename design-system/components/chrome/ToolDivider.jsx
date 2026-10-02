import React from 'react';

export function ToolDivider({ height = 18 }) {
  return <span aria-hidden="true" style={{ width: 1, height, background: 'var(--pv-divider)', margin: '0 6px', flex: 'none' }} />;
}
