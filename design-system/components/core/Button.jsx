import React from 'react';
import { Icon } from './Icon.jsx';

export function Button({ variant = 'primary', size = 'md', icon, iconRight, children, disabled, onClick, style, type = 'button', title }) {
  const sm = size === 'sm';
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sm ? 5 : 8,
    height: sm ? 24 : 36, padding: sm ? '0 9px' : '0 16px', boxSizing: 'border-box',
    borderRadius: sm ? 'var(--pv-radius-xs)' : 'var(--pv-radius-sm)',
    fontFamily: 'var(--pv-font-ui)', fontSize: sm ? 'var(--pv-text-sm)' : 'var(--pv-text-base)', fontWeight: 600, lineHeight: 1,
    whiteSpace: 'nowrap', opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : undefined
  };
  const variants = {
    primary: { background: 'var(--pv-accent-solid)', color: 'var(--pv-on-accent)' },
    secondary: { border: '1px solid var(--pv-line-strong)', background: 'var(--pv-field)', color: 'var(--pv-text)', fontWeight: 500 },
    ghost: { color: 'var(--pv-accent)', padding: sm ? '0 5px' : '0 8px' }
  };
  const cls = 'pv-reset ' + (variant === 'primary' ? 'pv-solid' : 'pv-i');
  const isz = sm ? 11 : 14;
  return (
    <button type={type} title={title} className={cls} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={isz} strokeWidth={2.25} />}
      {children}
      {iconRight && <Icon name={iconRight} size={isz} strokeWidth={2.25} />}
    </button>
  );
}
