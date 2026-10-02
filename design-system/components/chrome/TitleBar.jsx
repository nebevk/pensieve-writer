import React from 'react';
import { BrandMark } from '../core/BrandMark.jsx';
import { SavedIndicator } from '../core/SavedIndicator.jsx';
import { LangBadge } from '../core/LangBadge.jsx';
import { Icon } from '../core/Icon.jsx';
import { ViewTabs } from './ViewTabs.jsx';

// The single 34px bar: mark, project, view tabs centred, save state, language, settings.
export function TitleBar({ project = 'Untitled', view = 'Write', views, onViewChange, saveState = 'saved', lang = 'EN', onLang, onSettings, onHome, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', height: 'var(--pv-titlebar-h)', flex: 'none',
      borderBottom: '1px solid var(--pv-line)', background: 'var(--pv-chrome)', fontFamily: 'var(--pv-font-ui)', fontSize: 'var(--pv-text-md)', boxSizing: 'border-box' }}>
      <button type="button" className="pv-reset pv-f" onClick={onHome} title="Home" style={{ display: 'flex' }}><BrandMark size={18} /></button>
      <span style={{ color: 'var(--pv-text-muted)', whiteSpace: 'nowrap' }}>{project}</span>
      <div style={{ flex: 1 }} />
      {title ? <span style={{ fontWeight: 600 }}>{title}</span> : <ViewTabs views={views} value={view} onChange={onViewChange} />}
      <div style={{ flex: 1 }} />
      <SavedIndicator state={saveState} />
      <LangBadge code={lang} onClick={onLang} />
      <button type="button" className="pv-reset pv-i" onClick={onSettings} title="Settings" style={{ color: 'var(--pv-text-muted)', padding: 3, borderRadius: 'var(--pv-radius-xs)', display: 'flex' }}>
        <Icon name="settings" size={15} />
      </button>
    </div>
  );
}
