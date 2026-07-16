import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, EmptyState, Btn, Skeleton } from './ui';
import { ShieldAlert, GitFork, ArrowRight, Activity, Server, AlertCircle } from 'lucide-react';

export function TaintViewer({ jobId, onSelectPath }) {
  const [chains, setChains] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    api.getTaintChains(jobId)
      .then(setChains)
      .catch(err => {
        console.error(err);
        setError('Failed to load taint analysis results from backend.');
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton height={20} width={120} />
      <Skeleton height={60} />
      <Skeleton height={60} />
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, color: 'var(--status-red)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <AlertCircle size={16} />
      {error}
    </div>
  );

  if (!chains || chains.length === 0) return (
    <div style={{ padding: 48 }}>
      <EmptyState
        icon={ShieldAlert}
        title="No Taint Chains Detected"
        subtitle="Static analysis found zero reachable paths from user-controlled sources to dangerous sinks."
      />
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 480 }}>
      {/* Left List of Taint Flows */}
      <div style={{ borderRight: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Detected Flows ({chains.length})
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chains.map((chain, index) => {
            const isSelected = selectedChain === index;
            return (
              <button
                key={index}
                onClick={() => setSelectedChain(index)}
                style={{
                  background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--bg-border)' : 'transparent'}`,
                  borderRadius: 6,
                  padding: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    background: 'rgba(239,68,68,0.12)',
                    color: '#ef4444',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}>
                    {chain.sinkRiskCategory}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {chain.hopCount} {chain.hopCount === 1 ? 'hop' : 'hops'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace' }}>
                  Source: {chain.source.split(':').pop()?.replace('>', '')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Detailed Visualizer */}
      <div style={{ padding: 24, overflowY: 'auto' }}>
        {selectedChain !== null ? (
          <div>
            {/* Header info */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Taint Source</span>
                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{chains[selectedChain].source}</span>
                <span style={{ fontSize: 9, color: 'var(--accent)' }}>Category: {chains[selectedChain].sourceCategory}</span>
              </div>
              <ArrowRight size={16} color="var(--text-muted)" />
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dangerous Sink</span>
                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{chains[selectedChain].sink}</span>
                <span style={{ fontSize: 9, color: '#ef4444' }}>Risk: {chains[selectedChain].sinkRiskCategory}</span>
              </div>
            </div>

            {/* Path flow items */}
            <div style={{ borderLeft: '2px solid var(--bg-border)', marginLeft: 16, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {chains[selectedChain].path.map((node, i) => {
                const isStart = i === 0;
                const isEnd = i === chains[selectedChain].path.length - 1;
                return (
                  <div key={i} style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: -26,
                      top: 4,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: isStart ? '#34d399' : isEnd ? '#ef4444' : 'var(--accent)',
                      border: '2px solid var(--bg-surface)'
                    }} />
                    <div style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: 6,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{node}</div>
                      </div>
                      {isStart && <span style={{ fontSize: 9, color: '#34d399', fontWeight: 600 }}>SOURCE ENTRY</span>}
                      {isEnd && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>SINK ARRIVAL</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action button */}
            {onSelectPath && (
              <div style={{ marginTop: 24 }}>
                <Btn onClick={() => onSelectPath(chains[selectedChain])}>
                  <Activity size={13} /> View Taint Path in Graph Viewer
                </Btn>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={GitFork}
            title="Select a Flow"
            subtitle="Choose a detected taint flow from the left panel to trace its propagation path."
          />
        )}
      </div>
    </div>
  );
}
