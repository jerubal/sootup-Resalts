import React from 'react';
import { clsx } from 'clsx';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  COMPLETED: { label: 'Completed', color: 'var(--status-green)', bg: 'var(--status-green-bg)' },
  RUNNING:   { label: 'Running',   color: 'var(--status-amber)', bg: 'var(--status-amber-bg)' },
  QUEUED:    { label: 'Queued',    color: 'var(--status-amber)', bg: 'var(--status-amber-bg)' },
  FAILED:    { label: 'Failed',    color: 'var(--status-red)',   bg: 'var(--status-red-bg)'   },
  CANCELLED: { label: 'Cancelled', color: 'var(--status-gray)',  bg: 'var(--status-gray-bg)'  },
};

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.QUEUED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`,
      textTransform: 'uppercase',
    }}>
      {(status === 'RUNNING' || status === 'QUEUED') && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: cfg.color,
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      )}
      {cfg.label}
    </span>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value = 0, status }) {
  const color = status === 'FAILED' ? 'var(--status-red)'
    : status === 'COMPLETED' ? 'var(--status-green)'
    : 'var(--accent)';
  return (
    <div style={{
      height: 3, background: 'var(--bg-border)', borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${value}%`,
        background: color, borderRadius: 2,
        transition: 'width 0.4s ease, background 0.3s ease',
      }} />
    </div>
  );
}

// ─── Card / Panel ─────────────────────────────────────────────────────────────
export function Card({ children, style, className }) {
  return (
    <div className={className} style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--bg-border)',
      borderRadius: 8,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: 20, flexWrap: 'wrap', gap: 12,
    }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'ghost', size = 'md', disabled, style, title, type = 'button' }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', fontWeight: 500, opacity: disabled ? 0.5 : 1,
    transition: 'background 0.15s, color 0.15s',
    borderRadius: 6, fontSize: 13,
  };
  const sizes = { sm: '4px 10px', md: '6px 14px', lg: '8px 18px' };
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff',      padding: sizes[size] },
    ghost:   { background: 'transparent',   color: 'var(--text-secondary)', padding: sizes[size], border: 'none' },
    subtle:  { background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: sizes[size] },
    danger:  { background: 'var(--status-red-bg)', color: 'var(--status-red)', padding: sizes[size] },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({ label, error, id, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label htmlFor={id} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>}
      <input id={id}
        style={{
          background: 'var(--bg-elevated)', border: `1px solid ${error ? 'var(--status-red)' : 'var(--bg-border)'}`,
          color: 'var(--text-primary)', borderRadius: 6, padding: '7px 12px',
          fontSize: 13, fontFamily: 'inherit', outline: 'none',
          transition: 'border-color 0.15s',
        }}
        {...props}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--status-red)' }}>{error}</span>}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)} style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? 'var(--accent)' : 'var(--bg-border)',
        position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16,
          borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      {label && <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--bg-border)',
      marginBottom: 20,
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 18px', fontSize: 13, fontFamily: 'inherit',
            color: active === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: active === tab.id ? 600 : 400,
            borderBottom: `2px solid ${active === tab.id ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {tab.icon && <tab.icon size={14} />}
          {tab.label}
          {tab.count != null && (
            <span style={{
              background: 'var(--bg-border)', color: 'var(--text-secondary)',
              borderRadius: 4, padding: '0 5px', fontSize: 10, fontWeight: 600,
            }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      {Icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: color ? `${color}18` : 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} color={color || 'var(--text-secondary)'} />
        </div>
      )}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
          {value ?? '—'}
        </div>
      </div>
    </Card>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', gap: 12, textAlign: 'center',
    }}>
      {Icon && <Icon size={36} color="var(--text-muted)" strokeWidth={1.5} />}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340 }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 14, style }) {
  return (
    <div style={{
      width, height, borderRadius: 4,
      background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-border) 50%, var(--bg-elevated) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ─── Keyframes (injected once) ────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes slideIn { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
`;
document.head.appendChild(style);
