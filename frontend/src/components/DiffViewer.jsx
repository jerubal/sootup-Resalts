import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useJobs } from '../context';
import { Card, SectionHeader, Btn, EmptyState } from './ui';
import { GitCompare, ArrowRight, CheckCircle, Plus, Minus, AlertCircle } from 'lucide-react';

export function DiffViewer() {
  const { jobs } = useJobs();
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED');

  const [jobId1, setJobId1] = useState('');
  const [jobId2, setJobId2] = useState('');
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const triggerDiff = async () => {
    if (!jobId1 || !jobId2) return;
    setLoading(true);
    setError(null);
    setDiff(null);
    try {
      const res = await api.diffJobs(jobId1, jobId2);
      setDiff(res);
    } catch (e) {
      setError(e.message || 'Failed to compare scans');
    } finally {
      setLoading(false);
    }
  };

  const getJobLabel = (id) => {
    const j = jobs.find(x => x.jobId === id);
    if (!j) return id;
    const name = j.targetPath.split(/[/\\]/).pop() || 'Job';
    return `${name} (${new Date(j.submittedAt).toLocaleTimeString()})`;
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <SectionHeader
        title="Scan Diffing"
        subtitle="Compare two completed analysis runs to identify added/removed classes, methods, or taint chains."
      />

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Base Job (Run 1)</div>
            <select
              value={jobId1}
              onChange={e => setJobId1(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none'
              }}
            >
              <option value="">Select base run...</option>
              {completedJobs.map(j => (
                <option key={j.jobId} value={j.jobId}>{getJobLabel(j.jobId)}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 36 }}>
            <ArrowRight size={16} color="var(--text-muted)" />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Target Job (Run 2)</div>
            <select
              value={jobId2}
              onChange={e => setJobId2(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none'
              }}
            >
              <option value="">Select target run...</option>
              {completedJobs.filter(j => j.jobId !== jobId1).map(j => (
                <option key={j.jobId} value={j.jobId}>{getJobLabel(j.jobId)}</option>
              ))}
            </select>
          </div>

          <Btn variant="primary" onClick={triggerDiff} disabled={loading || !jobId1 || !jobId2}>
            {loading ? 'Comparing...' : 'Compare Scans'}
          </Btn>
        </div>
      </Card>

      {error && (
        <Card style={{ padding: 16, borderColor: 'var(--status-red)33', color: 'var(--status-red)', fontSize: 13, marginBottom: 20 }}>
          {error}
        </Card>
      )}

      {diff ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Taint chains changes */}
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitCompare size={14} color="var(--accent)" />
              Discovered Taint Deviations
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Plus size={12} /> New Taint Sinks ({diff.newTaintSinks?.length || 0})
                </div>
                {diff.newTaintSinks && diff.newTaintSinks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {diff.newTaintSinks.map((s, idx) => (
                      <div key={idx} style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{s}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No new taint sinks introduced.</div>
                )}
              </div>

              <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <CheckCircle size={12} /> Resolved Taint Sinks ({diff.resolvedTaintSinks?.length || 0})
                </div>
                {diff.resolvedTaintSinks && diff.resolvedTaintSinks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {diff.resolvedTaintSinks.map((s, idx) => (
                      <div key={idx} style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{s}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No taint sinks resolved.</div>
                )}
              </div>
            </div>
          </Card>

          {/* Classes & methods diffs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Classes Diff</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>Added Classes ({diff.addedClasses?.length || 0})</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {diff.addedClasses?.map((c, i) => (
                      <div key={i} style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{c}</div>
                    )) || <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>None</div>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Removed Classes ({diff.removedClasses?.length || 0})</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {diff.removedClasses?.map((c, i) => (
                      <div key={i} style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{c}</div>
                    )) || <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>None</div>}
                  </div>
                </div>
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Methods Diff</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>Added Methods ({diff.addedMethods?.length || 0})</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {diff.addedMethods?.slice(0, 10).map((m, i) => (
                      <div key={i} style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{m}</div>
                    ))}
                    {diff.addedMethods?.length > 10 && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+ {diff.addedMethods.length - 10} more</div>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Removed Methods ({diff.removedMethods?.length || 0})</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {diff.removedMethods?.slice(0, 10).map((m, i) => (
                      <div key={i} style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{m}</div>
                    ))}
                    {diff.removedMethods?.length > 10 && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+ {diff.removedMethods.length - 10} more</div>}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={GitCompare}
          title="Select Runs to Diff"
          subtitle="Compare analysis reports to inspect drift across application revisions."
        />
      )}
    </div>
  );
}
