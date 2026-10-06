import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { ToolButton } from './ToolButton.jsx';
import { ToolDivider } from './ToolDivider.jsx';
import { ToolGroup } from './ToolGroup.jsx';
import { StyleSelect } from './StyleSelect.jsx';
import { PanelToggle } from './PanelToggle.jsx';

const glyph = {
  bold: <b style={{ fontWeight: 700 }}>B</b>,
  italic: <i style={{ fontFamily: 'var(--pv-font-manuscript)' }}>I</i>,
  underline: <span style={{ textDecoration: 'underline' }}>U</span>,
  strike: <span style={{ textDecoration: 'line-through' }}>S</span>,
  quote: <span style={{ fontFamily: 'var(--pv-font-manuscript)', fontSize: 18, lineHeight: 1 }}>“</span>,
  sceneBreak: <span style={{ fontSize: 12, letterSpacing: 2 }}>* *</span>
};

// Quiet row (default) or the expanded, grouped "All tools" row.
export function Toolbar({ expanded = false, onToggleExpanded, active = [], onTool, paragraphStyle = 'Normal text', font = 'Literata', size = 17, panels, onPanel }) {
  const on = (id) => active.includes(id);
  const tb = (id, props) => <ToolButton key={id} active={on(id)} onClick={() => onTool && onTool(id)} title={props.title || id} {...props} />;
  const bar = { display: 'flex', borderBottom: '1px solid var(--pv-line)', color: 'var(--pv-text-2)', fontFamily: 'var(--pv-font-ui)', flex: 'none', boxSizing: 'border-box' };

  if (!expanded) return (
    <div style={{ ...bar, alignItems: 'center', gap: 4, padding: '0 16px', height: 'var(--pv-toolbar-h)', background: 'var(--pv-chrome)' }}>
      <StyleSelect value={paragraphStyle} />
      <ToolDivider />
      {tb('bold', { children: glyph.bold, title: 'Bold' })}
      {tb('italic', { children: glyph.italic, title: 'Italic' })}
      {tb('underline', { children: glyph.underline, title: 'Underline' })}
      {tb('strike', { children: glyph.strike, title: 'Strikethrough' })}
      <ToolDivider />
      {tb('list', { icon: 'list', title: 'Bulleted list' })}
      {tb('alignLeft', { icon: 'alignLeft', title: 'Alignment' })}
      {tb('quote', { children: glyph.quote, title: 'Block quote' })}
      {tb('sceneBreak', { children: glyph.sceneBreak, title: 'Scene break' })}
      <ToolDivider />
      <button type="button" className="pv-reset pv-i" onClick={onToggleExpanded} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 'var(--pv-tool-h)', padding: '0 8px', borderRadius: 'var(--pv-radius-xs)', fontSize: 'var(--pv-text-md)', color: 'var(--pv-text-muted)' }}>
        All tools<Icon name="chevronDown" size={11} strokeWidth={2} />
      </button>
      <div style={{ flex: 1 }} />
      {panels && <>
        <PanelToggle icon="listTodo" label="To-dos" count={panels.todosCount} active={panels.todos} onClick={() => onPanel && onPanel('todos')} />
        <PanelToggle icon="newNote" label="Notes" count={panels.notesCount} active={panels.notes} onClick={() => onPanel && onPanel('notes')} />
        <ToolDivider />
      </>}
      <ToolButton icon="search" title="Find" style={{ color: 'var(--pv-text-subtle)' }} onClick={() => onTool && onTool('find')} />
    </div>
  );

  return (
    <div style={{ ...bar, alignItems: 'stretch', padding: '8px 12px 0', background: 'var(--pv-chrome-raised)' }}>
      <ToolGroup label="History">{tb('undo', { icon: 'undo', title: 'Undo' })}{tb('redo', { icon: 'redo', title: 'Redo', disabled: true })}</ToolGroup>
      <ToolGroup label="Text">
        <div style={{ display: 'flex', gap: 4 }}>
          <StyleSelect value={paragraphStyle} raised />
          <StyleSelect value={font} manuscript raised />
          <StyleSelect value={String(size)} compact raised />
        </div>
      </ToolGroup>
      <ToolGroup label="Format">
        {tb('bold', { children: glyph.bold, title: 'Bold' })}
        {tb('italic', { children: glyph.italic, title: 'Italic' })}
        {tb('underline', { children: glyph.underline, title: 'Underline' })}
        {tb('strike', { children: glyph.strike, title: 'Strikethrough' })}
        {tb('superscript', { children: <span style={{ fontSize: 12 }}>x²</span>, title: 'Superscript' })}
        {tb('textColor', { children: <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontWeight: 600, lineHeight: 1, gap: 1 }}>A<span style={{ width: 13, height: 3, background: 'var(--pv-accent)' }} /></span>, title: 'Text colour' })}
        {tb('highlight', { children: <span style={{ width: 13, height: 11, background: 'var(--pv-highlight)', border: '1px solid var(--pv-highlight-edge)', boxSizing: 'border-box' }} />, title: 'Highlight' })}
        {tb('clearFormat', { icon: 'clearFormat', title: 'Clear formatting' })}
      </ToolGroup>
      <ToolGroup label="Paragraph">
        {tb('list', { icon: 'list', title: 'Bulleted list' })}
        {tb('listOrdered', { icon: 'listOrdered', title: 'Numbered list' })}
        {tb('outdent', { icon: 'outdent', title: 'Decrease indent' })}
        {tb('indent', { icon: 'indent', title: 'Increase indent' })}
        <ToolDivider height={16} />
        {tb('alignLeft', { icon: 'alignLeft', title: 'Align left' })}
        {tb('alignCenter', { icon: 'alignCenter', title: 'Centre' })}
        {tb('alignRight', { icon: 'alignRight', title: 'Align right' })}
        {tb('alignJustify', { icon: 'alignJustify', title: 'Justify' })}
      </ToolGroup>
      <ToolGroup label="Insert">
        {tb('quote', { children: glyph.quote, title: 'Block quote' })}
        {tb('sceneBreak', { children: glyph.sceneBreak, title: 'Scene break' })}
        {tb('image', { icon: 'image', title: 'Image' })}
        {tb('link', { icon: 'link', title: 'Link' })}
        {tb('footnote', { children: <span style={{ fontFamily: 'var(--pv-font-manuscript)', fontWeight: 600, fontSize: 12 }}>¹</span>, title: 'Footnote' })}
        {tb('comment', { icon: 'comment', title: 'Comment' })}
      </ToolGroup>
      <ToolGroup label="Pensieve">
        {tb('newNote', { icon: 'newNote', title: 'New note', wide: true })}
        {tb('addTodo', { icon: 'listTodo', title: 'Add to-do', wide: true })}
        {tb('wikiLink', { children: <span style={{ fontFamily: 'var(--pv-font-manuscript)', fontWeight: 600, fontSize: 12, color: 'var(--pv-accent)' }}>[[ ]]</span>, title: 'Link a note', wide: true })}
      </ToolGroup>
      <ToolGroup label="Find" last>{tb('find', { icon: 'search', title: 'Find' })}{tb('replace', { icon: 'replace', title: 'Replace' })}</ToolGroup>
      <div style={{ flex: 1 }} />
      <button type="button" className="pv-reset pv-i" onClick={onToggleExpanded} style={{ display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'center', height: 'var(--pv-tool-h)', padding: '0 8px', borderRadius: 'var(--pv-radius-xs)', fontSize: 'var(--pv-text-md)', background: 'var(--pv-pressed)', marginBottom: 14 }}>
        Fewer<Icon name="chevronUp" size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
