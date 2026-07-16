import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useJobs } from '../context';
import { StatusBadge, ProgressBar, EmptyState, Btn, SectionHeader, Card, Skeleton } from './ui';
import { PlayCircle, Trash2, Eye, RotateCcw, XCircle, FlaskConical, Clock } from 'lucide-react';

function formatDuration(submittedAt, completedAt) {
  const end = completedAt ? completedAt : Date.now();
  const ms = end - submittedAt;
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function targetName(path) {
  if (!path) return 'Unknown';
  return path.split(/[/\\]/).filter(Boolean).pop();
}

export function Dashboard() {
  const { jobs, cancelJob, removeJob } = useJobs();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? jobs
    : jobs.filter(j => j.status === filter.toUpperCase());

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      <SectionHeader
        title="Analysis Jobs"
        subtitle="Static bytecode analysis results from SootUp"
        actions={
          <>
            <div style={{ display: 'flex', gap: 0, background: 'var(--bg-elevated)', borderRadius: 6, padding: 2, border: '1px solid var(--bg-border)' }}>
              {['all', 'running', 'completed', 'failed'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? 'var(--bg-border)' : 'none',
                  border: 'none', borderRadius: 5, cursor: 'pointer',
                  padding: '4px 12px', fontSize: 12, fontFamily: 'inherit',
                  color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: filter === f ? 600 : 400,
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}>
                  {f}
                  {f !== 'all' && (
                    <span style={{ marginLeft: 5, opacity: 0.6 }}>
                      {jobs.filter(j => j.status === f.toUpperCase()).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <Btn variant="primary" onClick={() => navigate('/new')} style={{ gap: 6 }}>
              <PlayCircle size={14} />
              New Analysis
            </Btn>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No analyses yet"
          subtitle="Submit a static analysis job against a compiled Java target to get started."
          action={
            <Btn variant="primary" onClick={() => navigate('/new')}>
              <PlayCircle size={14} /> New Analysis
            </Btn>
          }
        />
      ) : (
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                {['Target', 'Status', 'Progress', 'Submitted', 'Duration', 'Flags', 'Actions'].map(col => (
                  <th key={col} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 11, color: 'var(--text-muted)',
                    fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => (
                <tr key={job.jobId} style={{
                  borderBottom: '1px solid var(--bg-border)',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                      {targetName(job.targetPath)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                      {job.jobId.slice(0, 8)}…
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td style={{ padding: '12px 16px', width: 120 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{job.progress ?? 0}%</div>
                    <ProgressBar value={job.progress ?? 0} status={job.status} />
                    {job.message && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{job.message}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      {formatTime(job.submittedAt)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDuration(job.submittedAt, job.completedAt)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(job.analysisFlags || []).map(f => (
                        <span key={f} style={{
                          background: 'var(--accent-subtle)', color: 'var(--accent)',
                          borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        }}>{f}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn variant="ghost" size="sm" title="View results"
                        onClick={() => navigate(`/job/${job.jobId}`)}
                        disabled={job.status !== 'COMPLETED'}>
                        <Eye size={13} />
                      </Btn>
                      {(job.status === 'RUNNING' || job.status === 'QUEUED') && (
                        <Btn variant="ghost" size="sm" title="Cancel" onClick={() => cancelJob(job.jobId)}>
                          <XCircle size={13} />
                        </Btn>
                      )}
                      <Btn variant="ghost" size="sm" title="Remove from list"
                        onClick={() => removeJob(job.jobId)}>
                        <Trash2 size={13} />
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
