import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { api } from '../api';
import { EmptyState, Skeleton, Btn } from './ui';
import { GitBranch, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const STMT_COLORS = {
  branch: '#f97316',
  return: '#34d399',
  invoke: '#7c85ff',
  default: '#6b7280',
};

function stmtColor(label = '') {
  if (/\bif\b|\bgoto\b/.test(label)) return STMT_COLORS.branch;
  if (/\breturn\b/.test(label)) return STMT_COLORS.return;
  if (/\binvoke\b/.test(label)) return STMT_COLORS.invoke;
  return STMT_COLORS.default;
}

export function CfgViewer({ jobId, methodSig }) {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!jobId || !methodSig) return;
    setLoading(true);
    setError(null);
    api.getCfg(jobId, methodSig)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId, methodSig]);

  useEffect(() => {
    if (!data || !cyRef.current) return;
    if (cyInstance.current) cyInstance.current.destroy();

    const elements = [
      ...(data.nodes || []).map(n => ({
        data: {
          id: n.data.id,
          label: n.data.label || n.data.id,
          stmtType: n.data.type,
          color: stmtColor(n.data.label || ''),
        }
      })),
      ...(data.edges || []).map(e => ({
        data: { id: e.data.id, source: e.data.source, target: e.data.target }
      })),
    ];

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.15,
            'border-color': 'data(color)',
            'border-width': 1.5,
            'label': 'data(label)',
            'color': '#d4d4d8',
            'font-size': 9,
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 'label',
            'height': 24,
            'padding': '5px',
            'shape': 'roundrectangle',
            'text-overflow-wrap': 'none',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#3a3a4a',
            'target-arrow-color': '#3a3a4a',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
          }
        },
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 16, spacingFactor: 1.3 },
    });

    return () => cyInstance.current?.destroy();
  }, [data]);

  if (!methodSig) return (
    <EmptyState icon={GitBranch} title="Select a method" subtitle="Choose a method signature from the list to view its control flow graph." />
  );
  if (loading) return <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={16} />)}</div>;
  if (error) return <EmptyState icon={GitBranch} title="Failed to load CFG" subtitle={error} />;
  if (!data) return null;

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 400 }}>
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 10,
        display: 'flex', gap: 4,
      }}>
        <Btn variant="subtle" size="sm" onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.2)}><ZoomIn size={12} /></Btn>
        <Btn variant="subtle" size="sm" onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 0.8)}><ZoomOut size={12} /></Btn>
        <Btn variant="subtle" size="sm" onClick={() => cyInstance.current?.fit()}><Maximize2 size={12} /></Btn>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 10, right: 10, zIndex: 10,
        background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
        borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 10,
      }}>
        {Object.entries({ Branch: STMT_COLORS.branch, Return: STMT_COLORS.return, Invoke: STMT_COLORS.invoke, Other: STMT_COLORS.default }).map(([k, c]) => (
          <span key={k} style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
            {k}
          </span>
        ))}
      </div>

      <div ref={cyRef} style={{ width: '100%', height: '100%', minHeight: 400, background: 'var(--bg-base)' }} />
    </div>
  );
}
