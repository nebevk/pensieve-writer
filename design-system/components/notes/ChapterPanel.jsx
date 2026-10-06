import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { ChecklistItem } from './ChecklistItem.jsx';
import { NoteMini } from './NoteMini.jsx';
import { NoteLink } from './NoteLink.jsx';

// 300px panel beside the page in Write: this chapter's to-dos and the notes mentioned in it.
export function ChapterPanel({ chapterLabel, title, todos = [], notes = [], showTodos = true, showNotes = true, onTodoToggle, onAddTodo, onOpenNotes, onClose, onNote }) {
  const [draft, setDraft] = React.useState('');
  const open = todos.filter((t) => t.state !== 'done').length;
  const [first, ...rest] = notes;
  return (
    <aside style={{ width: 300, flex: 'none', borderLeft: '1px solid var(--pv-line)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', minHeight: 0, background: 'var(--pv-chrome)', fontFamily: 'var(--pv-font-ui)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 0 20px', height: 44, borderBottom: '1px solid var(--pv-line)', fontSize: 'var(--pv-text-md)', flex: 'none' }}>
        <span style={{ color: 'var(--pv-text-faint)' }}>{chapterLabel}</span><span style={{ color: 'var(--pv-text-faint)' }}>·</span>
        <span style={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <button type="button" className="pv-reset pv-i" onClick={onClose} title="Close panel" style={{ display: 'flex', padding: 3, borderRadius: 'var(--pv-radius-xs)', color: 'var(--pv-text-subtle)' }}><Icon name="x" size={13} strokeWidth={2} /></button>
      </div>
      {showTodos && (
        <div style={{ padding: '16px 12px 6px', display: 'flex', flexDirection: 'column', gap: 1, borderBottom: '1px solid var(--pv-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 6px' }}><span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 'var(--pv-heading-sm)' }}>To-dos</span><span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-text-faint)' }}>{open} open</span></div>
          {todos.map((t, i) => <ChecklistItem key={i} {...t} onToggle={() => onTodoToggle && onTodoToggle(i)} />)}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 8px 10px', height: 32, padding: '0 10px', border: '1px dashed var(--pv-line-strong)', borderRadius: 'var(--pv-radius-xs)', fontSize: 'var(--pv-text-md)' }}>
            <span style={{ color: 'var(--pv-accent)', fontSize: 16, lineHeight: 1 }}>+</span>
            <input className="pv-input" value={draft} placeholder="Add a to-do for this chapter…" onChange={(e) => setDraft(e.target.value)} style={{ color: 'var(--pv-text)' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onAddTodo && onAddTodo(draft.trim()); setDraft(''); } }} />
          </label>
        </div>
      )}
      {showNotes && (
        <div style={{ flex: 1, padding: 16, paddingLeft: 20, paddingRight: 20, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--pv-desk)', minHeight: 0, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 'var(--pv-heading-sm)' }}>Notes</span><span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-text-faint)' }}>mentioned here</span></div>
          {first && (
            <div style={{ backgroundColor: 'var(--pv-paper)', backgroundImage: 'var(--pv-grain)', boxShadow: 'var(--pv-shadow-sheet)', color: 'var(--pv-ink)', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1.5px solid var(--pv-ink-rule-accent)' }}><span style={{ fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--pv-ink-accent)', fontWeight: 600 }}>{first.kind}</span><span style={{ fontSize: 'var(--pv-text-sm)', color: 'var(--pv-ink-muted)' }}>{first.meta}</span></div>
              <div style={{ fontFamily: 'var(--pv-font-heading)', fontSize: 19 }}>{first.title}</div>
              {first.fields && <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', rowGap: 4, fontSize: 'var(--pv-text-md)' }}>{first.fields.map(([k, v], i) => <React.Fragment key={i}><span style={{ color: 'var(--pv-ink-muted)' }}>{k}</span><span>{v}</span></React.Fragment>)}</div>}
              {first.body && <div style={{ fontFamily: 'var(--pv-font-manuscript)', fontSize: 13, lineHeight: 1.6, color: 'var(--pv-ink-2)', textWrap: 'pretty' }}>{first.body.map((b, i) => typeof b === 'string' ? b : <NoteLink key={i} onClick={() => onNote && onNote(b.link)}>{b.link}</NoteLink>)}</div>}
            </div>
          )}
          {rest.map((n, i) => <NoteMini key={i} kind={n.kind} title={n.title} meta={n.meta} onClick={() => onNote && onNote(n.title)} />)}
          <div style={{ flex: 1 }} />
          <button type="button" className="pv-reset" onClick={onOpenNotes} style={{ fontSize: 'var(--pv-text-md)', fontWeight: 600, color: 'var(--pv-accent)', alignSelf: 'flex-start' }}>Open in Notes →</button>
        </div>
      )}
    </aside>
  );
}
