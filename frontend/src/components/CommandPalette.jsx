import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '../context';
import { Search, Command, Play, Smartphone, FileSearch, HelpCircle } from 'lucide-react';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { jobs } = useJobs();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(open => !open);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const actions = [
    { id: 'dashboard', label: 'Go to Dashboard', shortcut: 'G D', icon: Command, action: () => navigate('/') },
    { id: 'new', label: 'Submit New Scan', shortcut: 'N S', icon: Play, action: () => navigate('/new') },
    { id: 'mobsf', label: 'Open MobSF Viewer', shortcut: 'M O', icon: Smartphone, action: () => navigate('/mobsf') },
    { id: 'diff', label: 'Compare Scans (Diff)', shortcut: 'C D', icon: FileSearch, action: () => navigate('/diff') },
  ];

  const matchingJobs = jobs
    .filter(j => j.targetPath.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5)
    .map(j => ({
      id: `job-${j.jobId}`,
      label: `Open Job: ${j.targetPath.split(/[/\\]/).pop()}`,
      shortcut: j.cgAlgorithm || 'CHA',
      icon: Command,
      action: () => navigate(`/job/${j.jobId}`)
    }));

  const results = [...actions, ...matchingJobs].filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex',
      alignItems: 'start', justifyContent: 'center', paddingTop: 100
    }} onClick={() => setIsOpen(false)}>
      <div style={{
        width: 600, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
        borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.4)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Search header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--bg-border)' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            autoFocus
            placeholder="Type a command or search scans... (Esc to close)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)',
              fontSize: 14, fontFamily: 'inherit', outline: 'none'
            }}
          />
          <kbd style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)' }}>ESC</kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 330, overflowY: 'auto', padding: 8 }}>
          {results.length > 0 ? (
            results.map(item => (
              <button
                key={item.id}
                onClick={() => { item.action(); setIsOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 6,
                  cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s',
                  textAlign: 'left'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <item.icon size={15} color="var(--text-muted)" />
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              No matches found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
