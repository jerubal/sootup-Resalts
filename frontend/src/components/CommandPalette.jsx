import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '../context';
import {
  Search, LayoutGrid, PlusCircle, Smartphone, GitCompare, Terminal,
  BookOpen, RefreshCw, FlaskConical, ChevronRight, Clock, Shield,
  Keyboard, Star
} from 'lucide-react';

// ── Static action registry ───────────────────────────────────────────────────
const ACTIONS = [
  { id: 'dashboard',  label: 'Go to Dashboard',       shortcut: 'G D', icon: LayoutGrid, category: 'Navigation',  action: (nav) => nav('/') },
  { id: 'new',        label: 'Submit New Scan',        shortcut: 'N S', icon: PlusCircle, category: 'Navigation',  action: (nav) => nav('/new') },
  { id: 'welcome',    label: 'Open Welcome Screen',    shortcut: 'W S', icon: FlaskConical, category: 'Navigation', action: (nav) => nav('/welcome') },
  { id: 'mobsf',      label: 'MobSF Report Viewer',   shortcut: 'M O', icon: Smartphone, category: 'Navigation',  action: (nav) => nav('/mobsf') },
  { id: 'diff',       label: 'Compare Scans (Diff)',  shortcut: 'C D', icon: GitCompare,  category: 'Navigation',  action: (nav) => nav('/diff') },
  { id: 'godmode',    label: 'Open God Mode Console', shortcut: 'G M', icon: Terminal,    category: 'Power',       action: (nav) => nav('/god-mode') },
  { id: 'bookmarks',  label: 'Bookmarks & Snapshots', shortcut: 'B M', icon: BookOpen,    category: 'Power',       action: (nav) => nav('/god-mode') },
  { id: 'owasp',      label: 'OWASP Top 10 Reference',shortcut: 'O W', icon: Shield,      category: 'Reference',   action: (nav) => nav('/welcome') },
  { id: 'reload',     label: 'Refresh Job List',      shortcut: 'R L', icon: RefreshCw,   category: 'Actions',     action: () => window.location.reload() },
];

// Badge colors by category
const CATEGORY_COLORS = {
  Navigation: '#6366f1',
  Power: '#f59e0b',
  Reference: '#34d399',
  Actions: '#94a3b8',
};

const RECENT_KEY = 'sootup_cmd_recent';

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecent(id) {
  const r = [id, ...getRecent().filter(x => x !== id)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(r));
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [recentIds, setRecentIds] = useState(getRecent());
  const { jobs } = useJobs();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Toggle on Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(o => !o);
        setQuery('');
        setSelected(0);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setRecentIds(getRecent());
    }
  }, [isOpen]);

  const close = useCallback(() => { setIsOpen(false); setQuery(''); setSelected(0); }, []);

  // Build results: jobs + static actions, filter by query
  const jobActions = jobs.slice(0, 20).map(j => ({
    id: `job-${j.jobId}`,
    label: `Open Job: ${j.targetPath?.split(/[/\\]/).pop() || j.jobId}`,
    sub: j.targetPath,
    shortcut: j.cgAlgorithm || 'CHA',
    icon: Star,
    category: 'Jobs',
    action: (nav) => nav(`/job/${j.jobId}`),
  }));

  const all = [...ACTIONS, ...jobActions];
  const lq = query.toLowerCase();

  let results;
  if (!query) {
    // Show recent first, then rest
    const recentItems = recentIds.map(id => all.find(a => a.id === id)).filter(Boolean);
    const restItems = all.filter(a => !recentIds.includes(a.id));
    results = [...recentItems, ...restItems].slice(0, 12);
  } else {
    results = all.filter(a =>
      a.label.toLowerCase().includes(lq) ||
      (a.sub || '').toLowerCase().includes(lq) ||
      a.category.toLowerCase().includes(lq)
    ).slice(0, 14);
  }

  // Group by category for display
  const grouped = results.reduce((acc, item) => {
    const cat = !query && recentIds.includes(item.id) ? 'Recent' : item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Flat list for keyboard navigation
  const flat = results;

  const handleSelect = (item) => {
    addRecent(item.id);
    item.action(navigate);
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') { if (flat[selected]) handleSelect(flat[selected]); }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${selected}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selected]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 100,
        animation: 'fadeIn 0.12s ease forwards',
      }}
      onClick={close}
    >
      <div
        style={{
          width: 640, background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 14,
          boxShadow: '0 24px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'slideDown 0.18s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--bg-border)',
          background: 'var(--bg-elevated)',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            placeholder="Search commands, jobs, classes…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKeyDown}
            style={{
              flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)',
              fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd style={{ fontSize: 10, background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}>
              ↑↓
            </kbd>
            <kbd style={{ fontSize: 10, background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}>
              ↵
            </kbd>
            <kbd style={{ fontSize: 10, background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}>
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto', padding: '6px 8px' }}>
          {flat.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              No matches for "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '8px 10px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cat === 'Recent' && <Clock size={9} />}{cat}
                </div>
                {items.map(item => {
                  const idx = flat.indexOf(item);
                  const isSel = idx === selected;
                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onClick={() => handleSelect(item)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px', background: isSel ? 'var(--bg-elevated)' : 'transparent',
                        border: isSel ? '1px solid var(--bg-border)' : '1px solid transparent',
                        borderRadius: 7, cursor: 'pointer', color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.1s', textAlign: 'left', fontFamily: 'inherit',
                        marginBottom: 1,
                      }}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 26, height: 26, background: isSel ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)',
                          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          border: '1px solid var(--bg-border)',
                        }}>
                          <item.icon size={13} color={isSel ? 'var(--accent)' : 'var(--text-muted)'} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13 }}>{item.label}</div>
                          {item.sub && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                              {item.sub}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {item.category && (
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 4,
                            background: `${CATEGORY_COLORS[item.category] || '#64748b'}18`,
                            color: CATEGORY_COLORS[item.category] || '#64748b',
                            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>{item.category}</span>
                        )}
                        {item.shortcut && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                            {item.shortcut}
                          </span>
                        )}
                        {isSel && <ChevronRight size={12} color="var(--text-muted)" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          borderTop: '1px solid var(--bg-border)', padding: '8px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-elevated)',
        }}>
          <Keyboard size={11} color="var(--text-muted)" />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            <kbd style={{ fontFamily: 'inherit' }}>Ctrl+K</kbd> to toggle · <kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate · <kbd style={{ fontFamily: 'inherit' }}>↵</kbd> select
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
            {flat.length} result{flat.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
