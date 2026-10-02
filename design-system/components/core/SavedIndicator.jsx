import React from 'react';
import { Icon } from './Icon.jsx';

export function SavedIndicator({ state = 'saved', label, size = 'sm' }) {
  const lg = size === 'lg';
  const text = label || (state === 'saving' ? 'Saving…' : 'Saved');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: lg ? 6 : 5, fontFamily: 'var(--pv-font-ui)',
      fontSize: lg ? 13 : 'var(--pv-text-sm)', color: state === 'saving' ? 'var(--pv-text-faint)' : 'var(--pv-success)', whiteSpace: 'nowrap' }}>
      {state !== 'saving' && <Icon name="check" size={lg ? 14 : 13} strokeWidth={2} />}
      {text}
    </span>
  );
}
