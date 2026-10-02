import React from 'react';

// A [[link]] to another note, inside text on paper.
export function NoteLink({ children, onClick }) {
  return <span role="link" tabIndex={0} onClick={onClick} className="pv-f" style={{ color: 'var(--pv-ink-accent)', borderBottom: '1px solid var(--pv-ink-link-underline)', cursor: 'pointer' }}>{children}</span>;
}
