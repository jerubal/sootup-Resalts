import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '../context';
import { StatusBadge, ProgressBar, EmptyState, Btn, SectionHeader, Card } from './ui';
import { PlayCircle, Trash2, Eye, XCircle, FlaskConical, Clock, Activity, TrendingUp, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../api';

function formatDuration(submittedAt, completedAt) {
  const end = completedAt ? completedAt : Date.now();
  const ms  = end - submittedAt;
  if (ms < 1000)  return '<1s';
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

/* ── UI-6: Ambient Risk Score Gauge ───────────────────────────────────── */
function RiskGauge({ jobs }) {
  const completed = jobs.filter(j => j.status === 'COMPLETED');
  if (completed.length === 0) return null;

  // Compute risk score (0–100) based on taint chains and policy violations
  const totalTaint   = completed.reduce((s, j) => s + (j.taintChains?.length || 0), 0);
  const totalPolicy  = completed.reduce((s, j) => s + (j.policyViolations?.length || 0), 0);
  const totalSinks   = completed.reduce((s, j) => s + (j.callGraph?.nodes?.filter(n => n.data?.isSink)?.length || 0), 0);
  const raw = Math.min(100, totalTaint * 8 + totalPolicy * 15 + totalSinks * 3);
  const score = Math.max(5, raw);

  // Arc geometry
  const R = 44, C = 2 * Math.PI * R;
  const pct = score / 100;
  const fill = C - C * pct;
  const color = score < 30 ? '#22c55e' : score < 60 ? '#f59e0b' : '#ef4444';
  const label = score < 30 ? 'Low' : score < 60 ? 'Medium' : 'High';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
      borderRadius: 10, padding: '12px 18px',
      borderLeft: `3px solid ${color}`,
    }}>
      <svg width={60} height={60} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-border)" strokeWidth="8" />
        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={C}
          strokeDashoffset={fill}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="risk-gauge-arc"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />
        <text x="50" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill={color}
          fontFamily="Inter, sans-serif">{score}</text>
      </svg>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ambient Risk Score</div>
        <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1.2, margin: '2px 0' }}>{label} Risk</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {totalTaint} taint chains · {totalPolicy} policy violations · {totalSinks} sinks
        </div>
      </div>
    </div>
  );
}

/* ── FR-O: Cross-Target Portfolio View ───────────────────────────────── */
function PortfolioView({ jobs }) {
  const completed = jobs.filter(j => j.status === 'COMPLETED');
  if (completed.length === 0) return null;

  // 1. Unique targets count
  const uniqueTargets = new Set(completed.map(j => targetName(j.targetPath))).size;

  // 2. Aggregated taint chains
  const totalTaints = completed.reduce((s, j) => s + (j.taintChains?.length || 0), 0);

  // 3. Average scan duration
  const totalDurationMs = completed.reduce((s, j) => {
    const end = j.completedAt || Date.now();
    return s + (end - j.submittedAt);
  }, 0);
  const avgDurationSec = Math.round((totalDurationMs / completed.length) / 1000);
  const avgDurationStr = avgDurationSec < 60 ? `${avgDurationSec}s` : `${Math.floor(avgDurationSec / 60)}m ${avgDurationSec % 60}s`;

  // 4. Highest Risk Category
  const categoryCounts = {};
  completed.forEach(j => {
    (j.taintChains || []).forEach(tc => {
      const cat = tc.sinkRiskCategory || 'UNKNOWN';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
  });
  let highestCategory = 'NONE';
  let highestCount = 0;
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    if (count > highestCount) {
      highestCount = count;
      highestCategory = cat;
    }
  });

  // 5. Recent Scan Trends (last 6 completed jobs)
  const recentJobs = [...completed].sort((a, b) => a.submittedAt - b.submittedAt).slice(-6);
  const maxChains = Math.max(...recentJobs.map(j => j.taintChains?.length || 0), 1);

  return (
    <Card style={{ padding: 18, background: '#0a0a14', border: '1px solid #1f1f2e', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1a1a26', paddingBottom: 10, marginBottom: 16 }}>
        <Shield size={16} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
          Portfolio Security Scan Metrics (FR-O)
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {/* Core Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#12121f', padding: 12, borderRadius: 8, border: '1px solid #1e1e2d' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Unique Targets</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#38bdf8' }}>{uniqueTargets}</div>
          </div>
          <div style={{ background: '#12121f', padding: 12, borderRadius: 8, border: '1px solid #1e1e2d' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Taint Flows</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{totalTaints}</div>
          </div>
          <div style={{ background: '#12121f', padding: 12, borderRadius: 8, border: '1px solid #1e1e2d' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Avg Scan Time</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>{avgDurationStr}</div>
          </div>
          <div style={{ background: '#12121f', padding: 12, borderRadius: 8, border: '1px solid #1e1e2d', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Highest Threat</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={highestCategory}>
              {highestCategory.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* Taint Flow Trend Sparkline */}
        <div style={{ background: '#12121f', padding: 14, borderRadius: 8, border: '1px solid #1e1e2d', display: 'flex', flexDirection: 'column', justifyBetween: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Taint Flow Trend</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>last {recentJobs.length} scans</span>
          </div>
          {recentJobs.length < 2 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
              Scan more targets to populate trend graph
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: 50, gap: 8, padding: '0 8px' }}>
              {recentJobs.map((j, i) => {
                const count = j.taintChains?.length || 0;
                const hPct = Math.max(10, Math.min(100, (count / maxChains) * 100));
                return (
                  <div key={j.jobId} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: count > 0 ? '#ef4444' : 'var(--text-muted)' }}>{count}</div>
                    <div style={{
                      width: '100%', height: `${hPct}%`, minHeight: 4,
                      background: count > 0 ? 'linear-gradient(to top, #ef4444, #f97316)' : 'var(--bg-border)',
                      borderRadius: '3px 3px 0 0',
                    }} title={`Job ${j.jobId.slice(0,6)}: ${count} taints`} />
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>S{i+1}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── UI-2: Living Job Status Strip ────────────────────────────────────── */
function LiveStatusStrip({ jobs }) {
  const running = jobs.filter(j => j.status === 'RUNNING');
  const queued  = jobs.filter(j => j.status === 'QUEUED');
  if (running.length === 0 && queued.length === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      padding: '10px 16px', background: 'rgba(34,211,238,0.04)',
      border: '1px solid rgba(34,211,238,0.15)', borderRadius: 8, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', animation: 'liveRing 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize: 12, color: '#22d3ee', fontWeight: 600 }}>Live</span>
      </div>
      {running.map(j => (
        <div key={j.jobId} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px',
          background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)',
          borderRadius: 6,
        }}>
          <Activity size={11} color="#22d3ee" />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>
            {targetName(j.targetPath)}
          </span>
          <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 600 }}>{j.progress ?? 0}%</span>
          {j.message && <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.message}</span>}
        </div>
      ))}
      {queued.map(j => (
        <div key={j.jobId} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: 6,
        }}>
          <Clock size={11} color="var(--status-amber)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
            {targetName(j.targetPath)} <span style={{ color: 'var(--status-amber)' }}>queued</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Stats Row ─────────────────────────────────────────────────────────── */
function StatsRow({ jobs }) {
  const counts = {
    total:     jobs.length,
    running:   jobs.filter(j => j.status === 'RUNNING').length,
    completed: jobs.filter(j => j.status === 'COMPLETED').length,
    failed:    jobs.filter(j => j.status === 'FAILED').length,
  };
  const totalChains = jobs.reduce((s, j) => s + (j.taintChains?.length || 0), 0);

  const stats = [
    { label: 'Total Scans', value: counts.total, icon: FlaskConical, color: 'var(--accent)' },
    { label: 'Completed',   value: counts.completed, icon: TrendingUp, color: 'var(--status-green)' },
    { label: 'Running',     value: counts.running, icon: Activity, color: '#22d3ee' },
    { label: 'Failed',      value: counts.failed, icon: AlertTriangle, color: 'var(--status-red)' },
    { label: 'Taint Chains',value: totalChains, icon: Shield, color: 'var(--status-amber)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 8, padding: '12px 14px',
          borderTop: `2px solid ${s.color}20`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            <s.icon size={13} color={s.color} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────────────────── */
export function Dashboard() {
  const { jobs, cancelJob, removeJob } = useJobs();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter.toUpperCase());

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1200, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <SectionHeader
        title="Analysis Jobs"
        subtitle="Static bytecode analysis results from SootUp"
        actions={
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, background: 'var(--bg-elevated)', borderRadius: 6, padding: 2, border: '1px solid var(--bg-border)' }}>
              {['all','running','completed','failed'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? 'var(--bg-border)' : 'none',
                  border: 'none', borderRadius: 5, cursor: 'pointer',
                  padding: '4px 12px', fontSize: 12, fontFamily: 'inherit',
                  color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: filter === f ? 600 : 400, textTransform: 'capitalize', transition: 'all 0.15s',
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
              <PlayCircle size={14} /> New Analysis
            </Btn>
          </>
        }
      />

      {/* Stats row */}
      {jobs.length > 0 && <StatsRow jobs={jobs} />}

      {/* Living status strip */}
      <LiveStatusStrip jobs={jobs} />

      {/* Risk gauge row */}
      {jobs.some(j => j.status === 'COMPLETED') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <RiskGauge jobs={jobs} />
          <PortfolioView jobs={jobs} />
        </div>
      )}

      {/* Job table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No analyses yet"
          subtitle="Submit a static analysis job against a compiled Java target to get started."
          action={<Btn variant="primary" onClick={() => navigate('/new')}><PlayCircle size={14} /> New Analysis</Btn>}
        />
      ) : (
        <Card>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                {['Target','Status','Progress','Submitted','Duration','Flags','Actions'].map(col => (
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
                <tr key={job.jobId}
                  style={{ borderBottom: '1px solid var(--bg-border)', transition: 'background 0.1s', cursor: 'pointer' }}
                  onClick={() => job.status === 'COMPLETED' && navigate(`/job/${job.jobId}`)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono,monospace' }}>
                      {targetName(job.targetPath)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'JetBrains Mono,monospace' }}>
                      {job.jobId.slice(0, 8)}…
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={job.status} />
                    {job.status === 'RUNNING' && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', marginTop: 4, animation: 'liveRing 1.4s ease-in-out infinite' }} />
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', width: 130 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{job.progress ?? 0}%</div>
                    <ProgressBar value={job.progress ?? 0} status={job.status} />
                    {job.message && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                        {job.message}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />{formatTime(job.submittedAt)}
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
                      {(job.taintChains?.length > 0) && (
                        <span style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--status-amber)', borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                          {job.taintChains.length} TAINT
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
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
                      <Btn variant="ghost" size="sm" title="Remove" onClick={() => removeJob(job.jobId)}>
                        <Trash2 size={13} />
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
