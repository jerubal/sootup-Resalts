import React, { useState, useEffect } from 'react';
import { Card, Btn } from './ui';
import { Terminal, ShieldAlert, Plus, Trash, Play, AlertCircle, Save } from 'lucide-react';
import { api } from '../api';

export function GodModeConsole({ jobId }) {
  const [consoleQuery, setConsoleQuery] = useState('');
  const [consoleLogs, setConsoleLogs] = useState([
    { type: 'system', msg: 'SootUp REPL Console Initialized. Type queries like: sinks where category = "SQL_INJECTION"' }
  ]);
  const [sinks, setSinks] = useState([
    { pattern: 'Runtime.exec(', riskCategory: 'COMMAND_INJECTION' },
    { pattern: 'ProcessBuilder', riskCategory: 'COMMAND_INJECTION' },
    { pattern: 'ObjectInputStream.readObject(', riskCategory: 'INSECURE_DESERIALIZATION' },
    { pattern: 'Statement.execute', riskCategory: 'SQL_INJECTION' }
  ]);
  const [newPattern, setNewPattern] = useState('');
  const [newCategory, setNewCategory] = useState('COMMAND_INJECTION');

  const executeQuery = () => {
    if (!consoleQuery.trim()) return;
    const q = consoleQuery.trim();
    setConsoleLogs(prev => [...prev, { type: 'input', msg: q }]);

    const queryLower = q.toLowerCase();
    if (queryLower.startsWith('sinks where category =')) {
      const match = q.match(/category\s*=\s*["']([^"']+)["']/i);
      if (match && match[1]) {
        const cat = match[1].toUpperCase();
        const found = sinks.filter(s => s.riskCategory === cat);
        if (found.length > 0) {
          setConsoleLogs(prev => [
            ...prev,
            { type: 'success', msg: `Found ${found.length} sinks matching category "${cat}":` },
            ...found.map(s => ({ type: 'info', msg: ` - ${s.pattern}` }))
          ]);
        } else {
          setConsoleLogs(prev => [...prev, { type: 'error', msg: `No sinks matched category "${cat}"` }]);
        }
      } else {
        setConsoleLogs(prev => [...prev, { type: 'error', msg: 'Malformed query. Expected syntax: sinks where category = "COMMAND_INJECTION"' }]);
      }
    } else if (queryLower === 'sinks') {
      setConsoleLogs(prev => [
        ...prev,
        { type: 'success', msg: `Total defined sinks: ${sinks.length}` },
        ...sinks.map(s => ({ type: 'info', msg: ` - ${s.pattern} [${s.riskCategory}]` }))
      ]);
    } else {
      setConsoleLogs(prev => [...prev, { type: 'error', msg: `Unknown command: "${q}". Try: sinks or sinks where category = "COMMAND_INJECTION"` }]);
    }

    setConsoleQuery('');
  };

  const addSink = () => {
    if (!newPattern.trim()) return;
    setSinks(prev => [...prev, { pattern: newPattern, riskCategory: newCategory }]);
    setConsoleLogs(prev => [...prev, { type: 'system', msg: `Added sink rule: "${newPattern}" [${newCategory}]` }]);
    setNewPattern('');
  };

  const removeSink = (idx) => {
    const deleted = sinks[idx];
    setSinks(prev => prev.filter((_, i) => i !== idx));
    setConsoleLogs(prev => [...prev, { type: 'system', msg: `Removed sink rule: "${deleted.pattern}"` }]);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, padding: 20 }}>
      {/* Query Console / REPL */}
      <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', background: '#09090e', border: '1px solid #1c1c24' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1c1c24', paddingBottom: 10, marginBottom: 12 }}>
          <Terminal size={15} color="var(--accent)" />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>SootUp REPL Console</span>
        </div>

        {/* Console outputs */}
        <div style={{ flex: 1, minHeight: 320, maxHeight: 320, overflowY: 'auto', background: '#00000033', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, border: '1px solid #111' }}>
          {consoleLogs.map((log, idx) => {
            let color = 'var(--text-secondary)';
            if (log.type === 'input') color = 'var(--accent)';
            else if (log.type === 'success') color = '#34d399';
            else if (log.type === 'error') color = '#ef4444';
            else if (log.type === 'system') color = 'var(--text-muted)';
            return (
              <div key={idx} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {log.type === 'input' ? '> ' : ''}{log.msg}
              </div>
            );
          })}
        </div>

        {/* Input area */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <input
            placeholder='Type command here, e.g. sinks where category = "COMMAND_INJECTION"'
            value={consoleQuery}
            onChange={e => setConsoleQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && executeQuery()}
            style={{
              flex: 1, background: '#12121a', border: '1px solid #1c1c24',
              borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: 12,
              fontFamily: 'JetBrains Mono', outline: 'none'
            }}
          />
          <Btn variant="primary" onClick={executeQuery} style={{ gap: 6 }}>
            <Play size={13} /> Run
          </Btn>
        </div>
      </Card>

      {/* Catalog Manager */}
      <Card style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldAlert size={14} color="var(--status-amber)" />
          Live Catalog Rules
        </div>

        {/* Rule creation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Method pattern, e.g. Runtime.exec"
            value={newPattern}
            onChange={e => setNewPattern(e.target.value)}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)',
              fontSize: 12, outline: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none'
              }}
            >
              <option value="COMMAND_INJECTION">Command Injection</option>
              <option value="SQL_INJECTION">SQL Injection</option>
              <option value="INSECURE_DESERIALIZATION">Deserialization</option>
              <option value="REFLECTION">Reflection</option>
            </select>
            <Btn variant="subtle" onClick={addSink}><Plus size={13} /></Btn>
          </div>
        </div>

        {/* Rules list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220 }}>
          {sinks.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', padding: '6px 10px', borderRadius: 4 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{s.pattern}</div>
                <div style={{ fontSize: 9, color: 'var(--status-amber)' }}>{s.riskCategory}</div>
              </div>
              <button onClick={() => removeSink(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-red)' }}>
                <Trash size={12} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
