import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Btn, Card, Skeleton } from './ui';
import { Tag, Plus, Trash2, AlertCircle, Zap } from 'lucide-react';

const PRESET_LABELS = [
  { label: 'handles payment data',    multiplier: 3.0, color: '#ef4444' },
  { label: 'processes PII',           multiplier: 2.5, color: '#f97316' },
  { label: 'internet-facing entry',   multiplier: 2.0, color: '#eab308' },
  { label: 'admin / privileged',      multiplier: 2.0, color: '#eab308' },
  { label: 'authentication logic',    multiplier: 2.5, color: '#f97316' },
  { label: 'session management',      multiplier: 2.0, color: '#eab308' },
];

export function BusinessTagManager({ jobId }) {
  const [tags, setTags]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [pattern, setPattern]   = useState('');
  const [label, setLabel]       = useState('handles payment data');
  const [multiplier, setMultiplier] = useState(2.0);

  const loadTags = () => {
    setLoading(true);
    api.getTags(jobId)
      .then(data => setTags(data || {}))
      .catch(() => setError('Failed to load tags'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTags(); }, [jobId]);

  const handleAdd = async () => {
    if (!pattern.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.addTag(jobId, { pattern: pattern.trim(), label, multiplier });
      setPattern('');
      loadTags();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pat) => {
    try {
      await api.deleteTag(jobId, pat);
      loadTags();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Tag size={16} color="#eab308" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Business-Context Risk Weighting</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Tag class/method patterns as business-critical to elevate their findings above identical technical findings in lower-priority code.
          </div>
        </div>
      </div>

      {/* Add new tag */}
      <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Tag</div>

        {/* Preset quick-pick */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>Quick presets:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESET_LABELS.map(p => (
              <button key={p.label} onClick={() => { setLabel(p.label); setMultiplier(p.multiplier); }}
                style={{
                  background: label === p.label ? `rgba(234,179,8,0.15)` : 'var(--bg-elevated)',
                  border: `1px solid ${label === p.label ? '#eab308' : 'var(--bg-border)'}`,
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                  color: label === p.label ? '#eab308' : 'var(--text-secondary)', fontSize: 10,
                  transition: 'all 0.15s',
                }}>
                {p.label} <span style={{ color: 'var(--text-muted)' }}>×{p.multiplier}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Class / method pattern (substring match)</div>
            <input
              placeholder="e.g. PaymentService, processCard, UserPII"
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                borderRadius: 6, padding: '7px 12px', color: 'var(--text-primary)',
                fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ minWidth: 100 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Label</div>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                borderRadius: 6, padding: '7px 12px', color: 'var(--text-primary)', fontSize: 11, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ minWidth: 80 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Multiplier</div>
            <input
              type="number" min="1" max="10" step="0.5"
              value={multiplier}
              onChange={e => setMultiplier(parseFloat(e.target.value))}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                borderRadius: 6, padding: '7px 12px', color: '#eab308', fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Btn variant="primary" onClick={handleAdd} disabled={saving || !pattern.trim()}>
              <Plus size={13} /> {saving ? 'Adding…' : 'Add Tag'}
            </Btn>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-red)', fontSize: 11 }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </Card>

      {/* Active tags table */}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--bg-border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Active Tags ({Object.keys(tags).length})</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>Taint chains are re-scored on next analysis fetch</span>
        </div>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2].map(i => <Skeleton key={i} height={40} />)}
          </div>
        ) : Object.keys(tags).length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No business tags yet. Add a tag above to start weighting findings by business context.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                {['Pattern', 'Label', 'Multiplier', 'Action'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(tags).map(([pat, tag]) => (
                <tr key={pat} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-primary)' }}>{pat}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 5, padding: '3px 8px', fontSize: 11, color: '#eab308' }}>
                      <Zap size={10} /> {tag.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'JetBrains Mono', fontSize: 13, color: '#eab308', fontWeight: 700 }}>×{tag.multiplier}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Btn variant="subtle" size="sm" onClick={() => handleDelete(pat)}>
                      <Trash2 size={12} /> Remove
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Impact explanation */}
      <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <span style={{ color: '#eab308', fontWeight: 700 }}>⚡ How tags affect findings: </span>
        When a taint chain's source or sink matches a tagged pattern, the chain is marked with the tag label and a ×multiplier badge. Tagged chains are sorted to the top of the Findings panel, and the ambient risk gauge incorporates the multiplier into its score calculation.
      </div>
    </div>
  );
}
