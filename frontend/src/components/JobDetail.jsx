import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useJobs } from '../context';
import { api } from '../api';
import { StatusBadge, ProgressBar, StatCard, Tabs, Card, SectionHeader, Btn, Skeleton, EmptyState } from './ui';
import { CallGraphViewer } from './CallGraphViewer';
import { CfgViewer } from './CfgViewer';
import { JimpleBrowser } from './JimpleBrowser';
import { Network, GitBranch, Code2, Download, Cpu, Box, ArrowLeft, AlertCircle } from 'lucide-react';

function targetName(path) {
  if (!path) return 'Unknown';
  return path.split(/[/\\]/).filter(Boolean).pop();
}

export function JobDetail() {
  const { jobId } = useParams();
  const { jobs } = useJobs();
  const job = jobs.find(j => j.jobId === jobId);

  const [result, setResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [tab, setTab] = useState('callgraph');
  const [cfgMethod, setCfgMethod] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    setLoadingResult(true);
    api.getJobResult(jobId)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoadingResult(false));
  }, [jobId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportJob(jobId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sootup_${jobId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  if (!job) return (
    <div style={{ padding: '28px 32px' }}>
      <EmptyState icon={AlertCircle} title="Job not found" subtitle={`No job with ID: ${jobId}`}
        action={<Link to="/"><Btn variant="subtle"><ArrowLeft size={14} /> Back to Dashboard</Btn></Link>}
      />
    </div>
  );

  const methods = result?.loadedClasses
    ? [] // methods list comes from callgraph nodes in real usage
    : [];
  const cgMethods = result ? [] : [];

  const tabs = [
    { id: 'callgraph', label: 'Call Graph', icon: Network },
    { id: 'cfg',       label: 'CFG Browser', icon: GitBranch },
    { id: 'jimple',    label: 'Jimple IR', icon: Code2 },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                {targetName(job.targetPath)}
              </h1>
              <StatusBadge status={job.status} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{job.jobId.slice(0, 16)}…</span>
              <span>Algorithm: {job.cgAlgorithm || 'CHA'}</span>
              {job.bytecodeVersion && <span>Java {job.bytecodeVersion}</span>}
            </div>
          </div>
        </div>
        <Btn variant="subtle" onClick={handleExport} disabled={exporting || job.status !== 'COMPLETED'}>
          <Download size={14} />
          {exporting ? 'Exporting…' : 'Export JSON'}
        </Btn>
      </div>

      {/* Progress (if running) */}
      {(job.status === 'RUNNING' || job.status === 'QUEUED') && (
        <Card style={{ padding: '12px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <span>{job.message || 'Initializing…'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{job.progress ?? 0}%</span>
          </div>
          <ProgressBar value={job.progress ?? 0} status={job.status} />
        </Card>
      )}

      {/* Failed state */}
      {job.status === 'FAILED' && (
        <Card style={{ padding: '14px 18px', marginBottom: 20, borderColor: 'var(--status-red)33' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--status-red)', fontSize: 13 }}>
            <AlertCircle size={14} />
            {job.message || 'Analysis failed. Check backend logs for details.'}
          </div>
        </Card>
      )}

      {/* Summary stats */}
      {loadingResult ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => <Card key={i} style={{ padding: '14px 18px' }}><Skeleton height={36} /></Card>)}
        </div>
      ) : result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard icon={Box} label="Loaded Classes" value={result.loadedClasses?.length ?? result.loadedClasses ?? '—'} color="#7c85ff" />
          <StatCard icon={Cpu} label="Methods" value={result.methodCount ?? '—'} color="#c084fc" />
          <StatCard icon={Network} label="CG Nodes" value={result.edgeCount != null ? result.methodCount : '—'} color="#34d399" />
          <StatCard icon={Network} label="CG Edges" value={result.edgeCount ?? '—'} color="#f97316" />
        </div>
      )}

      {/* Tab content (only when COMPLETED) */}
      {job.status === 'COMPLETED' && (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 20px' }}>
            <Tabs tabs={tabs} active={tab} onChange={setTab} />
          </div>
          <div style={{ minHeight: 480 }}>
            {tab === 'callgraph' && <CallGraphViewer jobId={jobId} />}
            {tab === 'cfg' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
                <input
                  placeholder="Paste method signature, e.g. <sample.HelloWorld: void main(java.lang.String[])>"
                  value={cfgMethod || ''}
                  onChange={e => setCfgMethod(e.target.value)}
                  style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)', borderRadius: 6, padding: '7px 12px',
                    fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none',
                    width: '100%',
                  }}
                />
                <CfgViewer jobId={jobId} methodSig={cfgMethod} />
              </div>
            )}
            {tab === 'jimple' && <JimpleBrowser jobId={jobId} methods={[]} />}
          </div>
        </Card>
      )}
    </div>
  );
}
