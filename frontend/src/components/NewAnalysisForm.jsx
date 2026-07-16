import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobs, useToast } from '../context';
import { Input, Btn, Toggle, Card, SectionHeader } from './ui';
import { PlayCircle, FolderOpen, AlertCircle } from 'lucide-react';

const FLAG_OPTIONS = [
  { key: 'callGraph', label: 'Call Graph', desc: 'Class Hierarchy / Rapid Type Analysis' },
  { key: 'cfg',       label: 'CFG',        desc: 'Control Flow Graph per method' },
  { key: 'jimple',    label: 'Jimple IR',  desc: 'Three-address intermediate representation' },
];

export function NewAnalysisForm() {
  const navigate = useNavigate();
  const { submitJob } = useJobs();
  const toast = useToast();

  const [targetPath, setTargetPath] = useState('');
  const [entryPoints, setEntryPoints] = useState('');
  const [flags, setFlags] = useState({ callGraph: true, cfg: true, jimple: true });
  const [cgAlgorithm, setCgAlgorithm] = useState('CHA');
  const [bytecodeVersion, setBytecodeVersion] = useState('17');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!targetPath.trim()) e.targetPath = 'Target path is required';
    if (!entryPoints.trim()) e.entryPoints = 'At least one entry point class is required';
    if (!Object.values(flags).some(Boolean)) e.flags = 'Select at least one analysis type';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const payload = {
        targetPath: targetPath.trim(),
        entryPoints: entryPoints.split(',').map(s => s.trim()).filter(Boolean),
        bytecodeVersion: parseInt(bytecodeVersion, 10),
        analysisFlags: Object.entries(flags).filter(([, v]) => v).map(([k]) => k),
        cgAlgorithm,
      };
      const job = await submitJob(payload);
      toast.add('Analysis job submitted!', 'success');
      navigate(`/job/${job.jobId}`);
    } catch (err) {
      toast.add(`Submission failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>
      <SectionHeader
        title="New Analysis"
        subtitle="Configure and submit a SootUp static bytecode analysis job"
      />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Target Path */}
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Target
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              id="targetPath"
              label="Target Path"
              placeholder="c:\path\to\target-classes or target.jar"
              value={targetPath}
              onChange={e => setTargetPath(e.target.value)}
              error={errors.targetPath}
            />
            <Input
              id="entryPoints"
              label="Entry Point Classes (comma-separated)"
              placeholder="com.example.Main, com.example.App"
              value={entryPoints}
              onChange={e => setEntryPoints(e.target.value)}
              error={errors.entryPoints}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Bytecode Version
                </label>
                <select
                  value={bytecodeVersion}
                  onChange={e => setBytecodeVersion(e.target.value)}
                  style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)', borderRadius: 6, padding: '7px 12px',
                    fontSize: 13, fontFamily: 'inherit', width: '100%', cursor: 'pointer',
                  }}
                >
                  {[8, 11, 17, 21].map(v => <option key={v} value={v}>Java {v}</option>)}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Analysis Flags */}
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Analysis Types
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FLAG_OPTIONS.map(opt => (
              <div key={opt.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--bg-elevated)',
                borderRadius: 6, border: `1px solid ${flags[opt.key] ? 'var(--accent)33' : 'var(--bg-border)'}`,
                transition: 'border-color 0.15s',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
                <Toggle checked={flags[opt.key]} onChange={v => setFlags(f => ({ ...f, [opt.key]: v }))} />
              </div>
            ))}
            {errors.flags && <div style={{ fontSize: 11, color: 'var(--status-red)', display: 'flex', gap: 4 }}><AlertCircle size={12} />{errors.flags}</div>}
          </div>
        </Card>

        {/* CG Algorithm (shown only when callGraph is enabled) */}
        {flags.callGraph && (
          <Card style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Call Graph Algorithm
            </h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {['CHA', 'RTA'].map(algo => (
                <button key={algo} type="button" onClick={() => setCgAlgorithm(algo)}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${cgAlgorithm === algo ? 'var(--accent)' : 'var(--bg-border)'}`,
                    background: cgAlgorithm === algo ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    color: cgAlgorithm === algo ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{algo}</div>
                  <div style={{ fontSize: 11, marginTop: 3, opacity: 0.8 }}>
                    {algo === 'CHA' ? 'Class Hierarchy Analysis — fast, may over-approximate' : 'Rapid Type Analysis — more precise, slower'}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="subtle" onClick={() => navigate('/')} disabled={loading}>Cancel</Btn>
          <Btn variant="primary" type="submit" disabled={loading}>
            <PlayCircle size={14} />
            {loading ? 'Submitting…' : 'Run Analysis'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
