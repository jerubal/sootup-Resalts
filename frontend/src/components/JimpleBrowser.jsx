import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, Skeleton, Btn } from './ui';
import { Code2, Copy, Check } from 'lucide-react';

// Simple Jimple tokenizer for syntax highlighting
function tokenize(line) {
  if (!line) return [{ text: '', type: 'plain' }];
  const tokens = [];
  // Keywords
  const keywords = /\b(if|goto|return|new|invoke|virtual|special|static|interface|throw|catch|instanceof|checkcast|entermonitor|exitmonitor|void|int|long|float|double|boolean|byte|char|short|null|class)\b/g;
  // Types
  const types = /\b([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\b/g;
  // Numbers
  const nums = /\b(\d+(?:\.\d+)?[LFD]?)\b/g;
  // Strings
  const strings = /"([^"]*)"/g;

  let last = 0;
  const spans = [];
  for (const re of [keywords, types, nums, strings]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, type: re === keywords ? 'kw' : re === types ? 'type' : re === nums ? 'num' : 'str', text: m[0] });
    }
  }
  spans.sort((a, b) => a.start - b.start);

  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    if (s.start > pos) tokens.push({ text: line.slice(pos, s.start), type: 'plain' });
    tokens.push({ text: s.text, type: s.type });
    pos = s.end;
  }
  if (pos < line.length) tokens.push({ text: line.slice(pos), type: 'plain' });
  return tokens.length ? tokens : [{ text: line, type: 'plain' }];
}

const COLOR_MAP = {
  kw:   '#c084fc',
  type: '#7c85ff',
  num:  '#34d399',
  str:  '#f97316',
  plain: '#d4d4d8',
};

function HighlightedLine({ line }) {
  const tokens = tokenize(line);
  return (
    <span>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: COLOR_MAP[t.type] }}>{t.text}</span>
      ))}
    </span>
  );
}

export function JimpleBrowser({ jobId, methods = [] }) {
  const [selected, setSelected] = useState(null);
  const [jimple, setJimple] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search
    ? methods.filter(m => m.toLowerCase().includes(search.toLowerCase()))
    : methods;

  useEffect(() => {
    if (!selected || !jobId) return;
    setLoading(true);
    setError(null);
    api.getJimple(jobId, selected)
      .then(data => setJimple(data.code || data.jimple || JSON.stringify(data, null, 2)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected, jobId]);

  const copy = () => {
    if (!jimple) return;
    navigator.clipboard.writeText(jimple);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 460 }}>
      {/* Method tree */}
      <div style={{
        width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-border)' }}>
          <input
            placeholder="Search methods…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              color: 'var(--text-primary)', borderRadius: 6, padding: '5px 10px',
              fontSize: 12, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>No methods</div>
          ) : filtered.map(m => {
            const short = m.replace(/.*:\s*/, '').replace(/\(.*/, '(…)').slice(0, 30);
            return (
              <div key={m} onClick={() => setSelected(m)}
                style={{
                  padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--bg-border)',
                  background: selected === m ? 'var(--accent-subtle)' : 'transparent',
                  borderLeft: `2px solid ${selected === m ? 'var(--accent)' : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (selected !== m) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (selected !== m) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: selected === m ? 'var(--accent)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m}>
                  {short}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Code panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <EmptyState icon={Code2} title="Select a method" subtitle="Choose a method from the list to view its Jimple IR." />
        ) : loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} height={14} width={`${60 + Math.random() * 30}%`} />)}
          </div>
        ) : error ? (
          <EmptyState icon={Code2} title="Failed to load Jimple" subtitle={error} />
        ) : (
          <>
            {/* Code header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px', borderBottom: '1px solid var(--bg-border)',
              background: 'var(--bg-surface)',
            }}>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }} title={selected}>
                {selected}
              </span>
              <Btn variant="ghost" size="sm" onClick={copy} title="Copy to clipboard">
                {copied ? <Check size={13} color="var(--status-green)" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </Btn>
            </div>
            {/* Code body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
              <pre style={{
                margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                lineHeight: 1.7, color: '#d4d4d8',
              }}>
                {jimple.split('\n').map((line, i) => (
                  <div key={i} style={{ display: 'flex' }}>
                    <span style={{
                      width: 40, flexShrink: 0, textAlign: 'right', paddingRight: 16,
                      color: 'var(--text-muted)', userSelect: 'none', fontSize: 10,
                    }}>{i + 1}</span>
                    <span style={{ flex: 1, paddingRight: 16 }}>
                      <HighlightedLine line={line} />
                    </span>
                  </div>
                ))}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
