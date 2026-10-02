import React from 'react';
import { TodoItem } from './TodoItem.jsx';

// An index card on the desk: kind, title, a few fields, free text, its own to-dos.
export function NoteCard({ kind = 'Note', edited, title, fields = [], children, todos = [], onTodoToggle, width }) {
  return (
    <div style={{ width: width || 'var(--pv-note-w)', maxWidth: '100%', boxSizing: 'border-box', padding: '30px 44px 36px', display: 'flex', flexDirection: 'column', gap: 18,
      backgroundColor: 'var(--pv-paper)', backgroundImage: 'var(--pv-grain)', boxShadow: 'var(--pv-shadow-sheet)', color: 'var(--pv-ink)', fontFamily: 'var(--pv-font-ui)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '1.5px solid var(--pv-ink-rule-accent)' }}>
        <span style={{ fontSize: 'var(--pv-text-xs)', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--pv-ink-accent)', fontWeight: 600 }}>{kind}</span>
        {edited && <span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-ink-muted)' }}>{edited}</span>}
      </div>
      <div style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 'var(--pv-heading-2xl)', marginTop: -4 }}>{title}</div>
      {fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', rowGap: 8, fontSize: 'var(--pv-text-base)', paddingBottom: 16, borderBottom: '1px solid var(--pv-ink-rule)' }}>
          {fields.map(([k, v], i) => <React.Fragment key={i}><span style={{ color: 'var(--pv-ink-muted)' }}>{k}</span><span>{v}</span></React.Fragment>)}
        </div>
      )}
      {children && <div style={{ fontFamily: 'var(--pv-font-manuscript)', fontSize: 15, lineHeight: 1.75, color: 'var(--pv-ink-2)', textWrap: 'pretty' }}>{children}</div>}
      {todos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          <div style={{ fontSize: 'var(--pv-text-xs)', letterSpacing: 'var(--pv-track-eyebrow)', textTransform: 'uppercase', color: 'var(--pv-ink-muted)', fontWeight: 600 }}>To-dos</div>
          {todos.map((t, i) => <TodoItem key={i} {...t} onToggle={() => onTodoToggle && onTodoToggle(i)} />)}
        </div>
      )}
    </div>
  );
}
