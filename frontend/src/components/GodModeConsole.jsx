import React, { useState, useEffect, useRef } from 'react';
import { Card, Btn } from './ui';
import { Terminal, ShieldAlert, Plus, Trash, Play, Save, Cpu, Database, Layers, AlertCircle, Bookmark, RefreshCw, MessageSquare, Code2 } from 'lucide-react';
import { api } from '../api';

/* ═══════════════════════════════════════════════════════════════════════════
 *  GM-1: Enhanced Query Console / REPL
 *  GM-2: Live Catalog Hot-Swap
 *  GM-6: System Console
 *  GM-8: Bookmarks
 * ════════════════════════════════════════════════════════════════════════════ */

const QUERY_SUGGESTIONS = [
  'sinks',
  'sinks where category = "SQL_INJECTION"',
  'sinks where category = "COMMAND_INJECTION"',
  'sources',
  'classes',
  'taint',
  'callers of Runtime',
  'policy',
  'help',
];

/* ─── GM-1 Query Console ─────────────────────────────────────────────── */
function QueryConsole({ jobId }) {
  const [query, setQuery] = useState('');
  const [logs, setLogs] = useState([
    { type: 'system', msg: `SootUp REPL v2.0 — job:${jobId || 'global'}` },
    { type: 'system', msg: 'Type "help" for available commands. ↑↓ for history.' },
  ]);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nlMode, setNlMode] = useState(false); // FR-J: Natural-Language mode toggle
  const logsRef = useRef(null);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const addLog = (entries) => setLogs(prev => [...prev, ...entries]);

  const executeQuery = async () => {
    const q = query.trim();
    if (!q) return;
    setHistory(h => [q, ...h.slice(0, 49)]);
    setHistIdx(-1);
    setQuery('');
    setShowSuggest(false);
    addLog([{ type: 'input', msg: (nlMode ? '🗣 ' : '') + q }]);
    setLoading(true);

    try {
      if (jobId) {
        const endpoint = nlMode ? `/analyses/${jobId}/query/nl` : `/analyses/${jobId}/query`;
        const res = await api.post(endpoint, { query: q });
        
        // FR-J: If NL mode, show the translated DSL back to the user
        if (nlMode && res.data.translatedQuery) {
          addLog([{ type: 'muted', msg: `↳ Translated DSL: ${res.data.translatedQuery}` }]);
        }
        
        if (res.data.results && res.data.results.length > 0) {
          addLog([
            { type: 'success', msg: `→ ${res.data.count} result(s):` },
            ...res.data.results.slice(0, 20).map(r => ({
              type: 'info',
              msg: '  ' + JSON.stringify(r, null, 0).replace(/^\{|\}$/g, '').replace(/","/g, '", "'),
            })),
          ]);
          if (res.data.count > 20) addLog([{ type: 'muted', msg: `  … and ${res.data.count - 20} more` }]);
        } else {
          addLog([{ type: 'muted', msg: '→ 0 results' }]);
        }
      } else {
        // Local fallback when no jobId (global mode)
        addLog([{ type: 'muted', msg: '→ Select a job first for server-side queries.' }]);
      }
    } catch (err) {
      addLog([{ type: 'error', msg: `Error: ${err?.response?.data?.error || err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { executeQuery(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      if (history[next]) setQuery(history[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setQuery(next === -1 ? '' : history[next]);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const first = suggestions[0];
      if (first) { setQuery(first); setShowSuggest(false); }
    }
  };

  const onQueryChange = (val) => {
    setQuery(val);
    if (val.length > 0) {
      const matches = QUERY_SUGGESTIONS.filter(s => s.toLowerCase().startsWith(val.toLowerCase()) && s !== val);
      setSuggestions(matches.slice(0, 5));
      setShowSuggest(matches.length > 0);
    } else {
      setShowSuggest(false);
    }
  };

  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', background: '#08080f', border: '1px solid #1a1a24', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1a1a24', paddingBottom: 10, marginBottom: 12 }}>
        <Terminal size={15} color="var(--accent)" />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.06em', flex: 1 }}>
          REPL Console {jobId ? `· job:${jobId}` : '· global'}
        </span>

        {/* FR-J: Natural-Language Mode Toggle */}
        <button
          onClick={() => {
            const next = !nlMode;
            setNlMode(next);
            addLog([{ type: 'system', msg: next
              ? '🗣 NL mode ON — type plain English, DSL translation shown'
              : '💻 DSL mode ON — direct query syntax' }]);
          }}
          title={nlMode ? 'Switch to DSL mode' : 'Switch to plain-English mode (FR-J)'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: nlMode ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: `1px solid ${nlMode ? '#6366f1' : '#1a1a24'}`,
            borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
            color: nlMode ? '#818cf8' : 'var(--text-muted)', fontSize: 10, fontWeight: 600,
            transition: 'all 0.2s',
          }}
        >
          {nlMode ? <MessageSquare size={11} /> : <Code2 size={11} />}
          {nlMode ? 'Plain English' : 'DSL'}
        </button>

        <button onClick={() => setLogs([{ type: 'system', msg: 'Console cleared.' }])}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>
          clear
        </button>
      </div>

      {/* Output */}
      <div ref={logsRef} style={{
        flex: 1, minHeight: 300, maxHeight: 300, overflowY: 'auto',
        background: '#050509', padding: 12, borderRadius: 6,
        display: 'flex', flexDirection: 'column', gap: 4,
        fontFamily: 'JetBrains Mono, Fira Code, monospace', fontSize: 11,
        border: '1px solid #0e0e18', scrollBehavior: 'smooth',
      }}>
        {logs.map((log, i) => {
          const colors = { input: '#818cf8', success: '#34d399', error: '#f87171', system: '#64748b', info: '#94a3b8', muted: '#475569' };
          return (
            <div key={i} style={{ color: colors[log.type] || '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.55 }}>
              {log.type === 'input' ? <span style={{ color: '#6366f1' }}>❯ </span> : null}
              {log.msg}
            </div>
          );
        })}
        {loading && <div style={{ color: '#818cf8', animation: 'blink 1s step-end infinite' }}>⠋ executing…</div>}
      </div>

      {/* Input */}
      <div style={{ position: 'relative', marginTop: 10 }}>
        {showSuggest && !nlMode && (
          <div style={{
            position: 'absolute', bottom: '110%', left: 0, right: 0,
            background: '#13131d', border: '1px solid #1e1e2e', borderRadius: 6, overflow: 'hidden', zIndex: 10,
          }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setQuery(s); setShowSuggest(false); }}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', padding: '7px 12px', textAlign: 'left',
                  fontFamily: 'JetBrains Mono', fontSize: 11,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e2e'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: nlMode ? '#818cf8' : '#6366f1', fontFamily: 'JetBrains Mono', fontSize: 13, lineHeight: '34px', flexShrink: 0 }}>{nlMode ? '🗣' : '❯'}</span>
          <input
            placeholder={nlMode
              ? 'Ask in plain English: "show me all SQL injection sinks"'
              : 'sinks where category = "SQL_INJECTION"'}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              flex: 1, background: nlMode ? '#0d0d1f' : '#0d0d17',
              border: `1px solid ${nlMode ? '#2a1e4e' : '#1a1a24'}`,
              borderRadius: 6, padding: '7px 12px', color: '#e2e8f0',
              fontSize: 12, fontFamily: nlMode ? 'Inter, sans-serif' : 'JetBrains Mono',
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = nlMode ? '#6366f1' : '#4f46e5'}
            onBlur={e => e.target.style.borderColor = nlMode ? '#2a1e4e' : '#1a1a24'}
          />
          <Btn variant="primary" onClick={executeQuery} style={{ gap: 6, flexShrink: 0, background: nlMode ? '#4f46e5' : undefined }}>
            {nlMode ? <MessageSquare size={12} /> : <Play size={12} />} {nlMode ? 'Ask' : 'Run'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

/* ─── GM-2 Live Catalog Editor ──────────────────────────────────────── */
function LiveCatalogEditor({ dangerMode, dangerConfirm }) {
  const [editorType, setEditorType] = useState('sinks'); // 'sinks' | 'sanitizers'
  const [rules, setRules] = useState([]);
  const [newPattern, setNewPattern] = useState('');
  const [newCategory, setNewCategory] = useState('COMMAND_INJECTION');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchRules = (type) => {
    const endpoint = type === 'sinks' ? '/admin/sink-catalog' : '/admin/sanitizer-catalog';
    api.get(endpoint)
      .then(res => {
        if (res && res.rules) {
          setRules(res.rules.map(r => ({
            pattern: r.pattern,
            category: r.riskCategory || r.sanitizerCategory || 'DEFAULT'
          })));
          setSaved(true);
        }
      })
      .catch(() => {
        // Fallback hardcoded defaults
        if (type === 'sinks') {
          setRules([
            { pattern: 'Runtime.exec(', category: 'COMMAND_INJECTION' },
            { pattern: 'ProcessBuilder', category: 'COMMAND_INJECTION' },
            { pattern: 'ObjectInputStream.readObject(', category: 'INSECURE_DESERIALIZATION' },
            { pattern: 'Statement.execute', category: 'SQL_INJECTION' },
            { pattern: 'prepareStatement', category: 'SQL_INJECTION' },
          ]);
        } else {
          setRules([
            { pattern: 'Encoder.encode', category: 'DEFAULT' },
            { pattern: 'Jsoup.clean', category: 'DEFAULT' },
          ]);
        }
        setSaved(false);
      });
  };

  useEffect(() => {
    fetchRules(editorType);
  }, [editorType]);

  const addRule = () => {
    if (!newPattern.trim()) return;
    setRules(prev => [...prev, { pattern: newPattern.trim(), category: newCategory }]);
    setNewPattern('');
    setSaved(false);
  };

  const removeRule = (idx) => {
    setRules(prev => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const pushToServer = async () => {
    if (!dangerMode || dangerConfirm !== 'confirm') {
      setErrorMsg('Danger Mode must be unlocked first.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const endpoint = editorType === 'sinks' ? '/admin/sink-catalog' : '/admin/sanitizer-catalog';
      const formattedRules = rules.map(r => {
        if (editorType === 'sinks') {
          return { pattern: r.pattern, riskCategory: r.category };
        } else {
          return { pattern: r.pattern, sanitizerCategory: r.category };
        }
      });
      const opts = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Danger-Mode': 'confirmed' },
        body: JSON.stringify({ rules: formattedRules })
      };
      const API_HOST = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_HOST}/api/v1${endpoint}`, opts);
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
    } catch {
      setErrorMsg('Sync failed.');
    } finally {
      setSaving(false);
    }
  };

  const CATEGORIES = editorType === 'sinks'
    ? ['COMMAND_INJECTION', 'SQL_INJECTION', 'INSECURE_DESERIALIZATION', 'REFLECTION', 'XSS', 'SSRF', 'FILE', 'NETWORK', 'LDAP_INJECTION']
    : ['DEFAULT', 'HTML_ESCAPE', 'SQL_SANITIZE', 'PATH_SANITIZE'];

  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header and Sync Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <ShieldAlert size={13} color="var(--status-amber)" />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
          Live Catalog Rules
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: saved ? '#34d399' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {saved ? '✓ synced' : `${rules.length} rules · unsaved`}
        </span>
      </div>

      {/* Editor Selector Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 5, padding: 2, marginBottom: 12, border: '1px solid var(--bg-border)' }}>
        <button
          onClick={() => { setEditorType('sinks'); setNewCategory('COMMAND_INJECTION'); }}
          style={{
            flex: 1, background: editorType === 'sinks' ? 'var(--bg-border)' : 'none',
            border: 'none', borderRadius: 4, cursor: 'pointer', padding: '3px 8px', fontSize: 10,
            color: editorType === 'sinks' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600
          }}>
          Sinks
        </button>
        <button
          onClick={() => { setEditorType('sanitizers'); setNewCategory('DEFAULT'); }}
          style={{
            flex: 1, background: editorType === 'sanitizers' ? 'var(--bg-border)' : 'none',
            border: 'none', borderRadius: 4, cursor: 'pointer', padding: '3px 8px', fontSize: 10,
            color: editorType === 'sanitizers' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600
          }}>
          Sanitizers
        </button>
      </div>

      {/* Add rule */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, padding: 10, background: 'var(--bg-elevated)', borderRadius: 7, border: '1px solid var(--bg-border)' }}>
        <input placeholder={editorType === 'sinks' ? 'Method pattern (e.g. Runtime.exec)' : 'Sanitizer pattern (e.g. Encoder.encode)'}
          value={newPattern} onChange={e => setNewPattern(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addRule()}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 5, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'JetBrains Mono' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
            style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 5, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Btn variant="subtle" onClick={addRule}><Plus size={13} /></Btn>
        </div>
      </div>

      {/* Rules list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180 }}>
        {rules.map((s, idx) => (
          <div key={idx} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            padding: '5px 10px', borderRadius: 5,
            borderLeft: `2px solid ${editorType === 'sinks' ? 'var(--status-amber)' : '#34d399'}`,
          }}>
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.pattern}</div>
              <div style={{ fontSize: 9, color: editorType === 'sinks' ? 'var(--status-amber)' : '#34d399', marginTop: 1 }}>{s.category}</div>
            </div>
            <button onClick={() => removeRule(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red)', flexShrink: 0 }}>
              <Trash size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Sync */}
      {errorMsg && <div style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', marginTop: 8 }}>{errorMsg}</div>}
      <Btn variant={dangerMode && dangerConfirm === 'confirm' ? 'primary' : 'subtle'} 
           onClick={pushToServer} 
           disabled={!dangerMode || dangerConfirm !== 'confirm'}
           style={{ marginTop: 10, gap: 6, justifyContent: 'center' }}>
        {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
        {saving ? 'Syncing…' : 'Hot-Sync to Engine'}
      </Btn>
    </Card>
  );
}

/* ─── GM-6 System Console ──────────────────────────────────────────── */
function SystemConsole() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetch = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/system');
      setMetrics(r.data);
    } catch { setMetrics(null); } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); const t = setInterval(fetch, 8000); return () => clearInterval(t); }, []);

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Cpu size={13} color="var(--accent)" /> System Console
        <button onClick={fetch} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>
      {metrics ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Heap Used', value: `${metrics.heapUsedMb} MB`, sub: `/ ${metrics.heapMaxMb} MB`, accent: metrics.heapUsedPct > 75 ? 'var(--status-red)' : 'var(--accent)' },
            { label: 'Heap %', value: `${metrics.heapUsedPct}%`, sub: 'of max', accent: metrics.heapUsedPct > 75 ? 'var(--status-red)' : 'var(--status-green)' },
            { label: 'Active Threads', value: metrics.activeThreads, sub: `${metrics.availableProcessors} CPU cores` },
            { label: 'Sink Rules', value: metrics.sinkCatalogSize, sub: 'in live catalog' },
            { label: 'Total Jobs', value: metrics.totalJobsEver, sub: `${metrics.runningJobs} running` },
            { label: 'Completed', value: metrics.completedJobs, sub: `${metrics.failedJobs} failed`, accent: metrics.failedJobs > 0 ? 'var(--status-amber)' : 'var(--status-green)' },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.accent || 'var(--text-primary)', lineHeight: 1.2, margin: '3px 0 1px' }}>{m.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
          {loading ? 'Loading metrics…' : 'Could not reach backend'}
        </div>
      )}
    </Card>
  );
}

/* ─── GM-8 Bookmark Manager ────────────────────────────────────────── */
function BookmarkManager() {
  const [note, setNote] = useState('');
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sootup_bookmarks') || '[]'); } catch { return []; }
  });

  const save = async () => {
    if (!note.trim()) return;
    const bm = { id: Math.random().toString(36).slice(2, 10), note: note.trim(), createdAt: Date.now(), url: window.location.href };
    try {
      const r = await api.post('/bookmarks', bm);
      bm.serverId = r.data.id;
    } catch { /* offline */ }
    const next = [bm, ...bookmarks.slice(0, 19)];
    setBookmarks(next);
    localStorage.setItem('sootup_bookmarks', JSON.stringify(next));
    setNote('');
  };

  const remove = (id) => {
    const next = bookmarks.filter(b => b.id !== id);
    setBookmarks(next);
    localStorage.setItem('sootup_bookmarks', JSON.stringify(next));
  };

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bookmark size={13} color="var(--accent)" /> Snapshots & Bookmarks
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input placeholder="Note for this moment…" value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 5, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
        <Btn variant="subtle" onClick={save}><Plus size={13} /></Btn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
        {bookmarks.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No bookmarks yet</div>}
        {bookmarks.map(bm => (
          <div key={bm.id} style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
            borderRadius: 5, padding: '6px 10px', gap: 8,
            borderLeft: '2px solid var(--accent)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.note}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(bm.createdAt).toLocaleString()}</div>
            </div>
            <button onClick={() => remove(bm.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red)', flexShrink: 0 }}>
              <Trash size={11} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Top-level God Mode page ───────────────────────────────────────── */
export function GodModeConsole({ jobId }) {
  const [dangerMode, setDangerMode] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 20, height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Terminal size={18} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>God Mode</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Raw query console · Live catalog · System metrics · Bookmarks</div>
        </div>

        {/* GM-7 Danger Mode toggle */}
        <div style={{ marginLeft: 'auto' }}>
          {!dangerMode ? (
            <button onClick={() => setDangerMode(true)}
              style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              ⚠ Danger Mode
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input placeholder='type "confirm" to unlock' value={dangerConfirm}
                onChange={e => setDangerConfirm(e.target.value)}
                style={{ width: 140, background: 'rgba(239,68,68,0.06)', border: '1px solid #ef4444', borderRadius: 5, padding: '5px 8px', color: '#ef4444', fontSize: 11, outline: 'none', fontFamily: 'JetBrains Mono' }} />
              <button onClick={() => setDangerMode(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Danger Mode banner */}
      {dangerMode && dangerConfirm === 'confirm' && (
        <div style={{
          padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} />
          <strong>Danger Mode active.</strong> Engine modifications (catalog wipes, job deletions) are now unlocked. Proceed with extreme caution.
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* LEFT: REPL */}
        <QueryConsole jobId={jobId} />

        {/* RIGHT: Catalog + Bookmarks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <LiveCatalogEditor dangerMode={dangerMode} dangerConfirm={dangerConfirm} />
          <SystemConsole />
          <BookmarkManager />
        </div>
      </div>

      {/* Bottom row: System console + cross-job search */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <SystemConsole />
        <CrossJobSearch />
      </div>
    </div>
  );
}

/* ─── GM-4 Cross-Job Search ─────────────────────────────────────────── */
function CrossJobSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await api.get(`/admin/search?q=${encodeURIComponent(q)}`);
      setResults(r.data);
    } catch { setResults(null); } finally { setLoading(false); }
  };

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Database size={13} color="var(--accent)" /> Cross-Job Intelligence Search
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input placeholder="Search all jobs for class / method / pattern…"
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 5, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
        <Btn variant="primary" onClick={search}><Play size={12} /></Btn>
      </div>
      {loading && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Searching…</div>}
      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
          {results.results.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No matches across {results.total} jobs</div>
          )}
          {results.results.map(r => (
            <div key={r.jobId} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 5, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{r.jobId}</span>
                <span style={{ fontSize: 9, padding: '2px 6px', background: 'var(--bg-surface)', borderRadius: 3, color: 'var(--text-muted)' }}>{r.status}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.target}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[['Classes', r.matchedClasses], ['Nodes', r.matchedNodes], ['Taint Chains', r.matchedTaintChains]].map(([k, v]) =>
                  v > 0 ? <span key={k} style={{ fontSize: 9, color: 'var(--accent)' }}>+{v} {k}</span> : null
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
