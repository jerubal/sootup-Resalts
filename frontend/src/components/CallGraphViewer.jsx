import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { api } from '../api';
import { EmptyState, Skeleton, Btn, Card } from './ui';
import { Network, Search, ZoomIn, ZoomOut, Maximize2, GitMerge, AlertOctagon, Loader } from 'lucide-react';

const NODE_COLORS = ['#7c85ff', '#c084fc', '#34d399', '#f97316', '#06b6d4', '#ec4899'];
const classColor = (cls) => {
  let h = 0;
  for (let i = 0; i < (cls || '').length; i++) h = (h << 5) - h + cls.charCodeAt(i);
  return NODE_COLORS[Math.abs(h) % NODE_COLORS.length];
};

// Risk category → color mapping (server-driven, from sinks.yaml via API)
const RISK_COLORS = {
  COMMAND_INJECTION:       '#ef4444',
  INSECURE_DESERIALIZATION:'#f97316',
  REFLECTION:              '#eab308',
  SQL_INJECTION:           '#ef4444',
  NATIVE_CODE_LOAD:        '#f97316',
  JNDI_INJECTION:          '#ef4444',
  XML_INJECTION:           '#eab308',
  WEAK_CRYPTO:             '#a78bfa',
  CODE_INJECTION:          '#ef4444',
};

export function CallGraphViewer({ jobId }) {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  // Pathfinding — wired to real backend /paths BFS (Fix 1)
  const [sourceNodeId, setSourceNodeId] = useState(null);
  const [targetNodeId, setTargetNodeId] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathResult, setPathResult] = useState(null); // null | string[] | []
  const [showDeadCode, setShowDeadCode] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    api.getCallGraph(jobId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!data || !cyRef.current) return;

    const elements = [
      ...data.nodes.map(n => {
        // Use server-side riskCategory (Fix 2) — no client-side substring matching
        const riskCategory = n.data.riskCategory || null;
        const reachable = n.data.reachableFromEntry !== false; // true if missing (legacy)
        const sinkColor = riskCategory ? (RISK_COLORS[riskCategory] || '#ef4444') : null;
        return {
          data: {
            id: n.data.id,
            label: n.data.label,
            cls: n.data.class,
            riskCategory,
            reachable,
            color: sinkColor || classColor(n.data.class),
            isSink: !!riskCategory,
          }
        };
      }),
      ...data.edges.map(e => ({
        data: { id: e.data.id, source: e.data.source, target: e.data.target }
      })),
    ];

    if (cyInstance.current) cyInstance.current.destroy();

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
            'color': '#f0f0f2',
            'font-size': 10,
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 'label',
            'height': 28,
            'padding': '6px',
            'shape': 'roundrectangle',
            'text-overflow-wrap': 'none',
          }
        },
        {
          selector: 'node[?isSink]',
          style: {
            'border-width': 2.5,
            'border-style': 'double',
            'background-opacity': 0.35,
            'background-color': '#ef4444',
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 2.5,
            'background-opacity': 0.3,
            'border-color': '#fff',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#3a3a4a',
            'target-arrow-color': '#3a3a4a',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8,
            'curve-style': 'bezier',
          }
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': '#6e7bff', 'target-arrow-color': '#6e7bff' }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 20,
        spacingFactor: 1.4,
      },
    });

    cyInstance.current.on('tap', 'node', evt => {
      const node = evt.target;
      const id = node.data('id');
      const incoming = cyInstance.current.edges(`[target="${id}"]`).map(e => e.data('source'));
      const outgoing = cyInstance.current.edges(`[source="${id}"]`).map(e => e.data('target'));
      setSelected({
        id,
        label: node.data('label'),
        cls: node.data('cls'),
        isSink: node.data('isSink'),
        riskCategory: node.data('riskCategory'),
        reachable: node.data('reachable'),
        incoming,
        outgoing
      });
    });

    cyInstance.current.on('tap', evt => {
      if (evt.target === cyInstance.current) setSelected(null);
    });

    return () => cyInstance.current?.destroy();
  }, [data]);

  // Search highlight
  useEffect(() => {
    if (!cyInstance.current) return;
    cyInstance.current.nodes().forEach(n => {
      const match = !search || n.data('id').toLowerCase().includes(search.toLowerCase())
        || n.data('label').toLowerCase().includes(search.toLowerCase());
      n.style('opacity', search ? (match ? 1 : 0.15) : 1);
    });
  }, [search]);

  // Dead-code dimming toggle (FR-3b) — uses server-side reachableFromEntry flag
  useEffect(() => {
    if (!cyInstance.current) return;
    cyInstance.current.nodes().forEach(n => {
      if (!showDeadCode && n.data('reachable') === false) {
        n.style('opacity', 0.12);
      } else if (!search) {
        n.style('opacity', 1);
      }
    });
  }, [showDeadCode, search]);

  // ── Fix 1: Real backend /paths BFS pathfinding ──────────────────────────────
  const runBackendPath = useCallback(async (src, tgt) => {
    if (!src || !tgt || !jobId) return;
    setPathLoading(true);
    setPathResult(null);
    // Reset previous highlights
    if (cyInstance.current) {
      cyInstance.current.elements().style('opacity', 1);
      cyInstance.current.nodes().forEach(n => {
        n.style('border-color', n.data('isSink') ? (RISK_COLORS[n.data('riskCategory')] || '#ef4444') : n.data('color'));
        n.style('border-width', n.data('isSink') ? 2.5 : 1.5);
      });
      cyInstance.current.edges().style('line-color', '#3a3a4a').style('target-arrow-color', '#3a3a4a').style('width', 1);
    }
    try {
      const path = await api.getShortestPath(jobId, src, tgt);
      setPathResult(path);
      if (path.length > 0 && cyInstance.current) {
        // Dim everything, then highlight the returned path
        cyInstance.current.elements().style('opacity', 0.12);
        path.forEach((nodeId, idx) => {
          const node = cyInstance.current.getElementById(nodeId);
          if (node.length) node.style('opacity', 1).style('border-color', '#f97316').style('border-width', 3);
          if (idx < path.length - 1) {
            const nextId = path[idx + 1];
            const edge = cyInstance.current.edges(`[source="${nodeId}"][target="${nextId}"]`);
            if (edge.length) edge.style('opacity', 1).style('line-color', '#f97316').style('target-arrow-color', '#f97316').style('width', 2.5);
          }
        });
      }
    } catch (e) {
      setPathResult([]);
    } finally {
      setPathLoading(false);
    }
  }, [jobId]);

  // Trigger path search whenever both source and target are set
  useEffect(() => {
    if (sourceNodeId && targetNodeId) runBackendPath(sourceNodeId, targetNodeId);
  }, [sourceNodeId, targetNodeId, runBackendPath]);

  const clearPath = useCallback(() => {
    setSourceNodeId(null);
    setTargetNodeId(null);
    setPathResult(null);
    if (cyInstance.current) {
      cyInstance.current.elements().style('opacity', 1);
      cyInstance.current.nodes().forEach(n => {
        n.style('border-color', n.data('isSink') ? (RISK_COLORS[n.data('riskCategory')] || '#ef4444') : n.data('color'));
        n.style('border-width', n.data('isSink') ? 2.5 : 1.5);
      });
      cyInstance.current.edges().style('line-color', '#3a3a4a').style('target-arrow-color', '#3a3a4a').style('width', 1);
    }
  }, []);

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...Array(3)].map((_, i) => <Skeleton key={i} height={20} />)}
    </div>
  );
  if (error) return (
    <EmptyState icon={Network} title="Failed to load call graph" subtitle={error} />
  );
  if (!data || !data.nodes?.length) return (
    <EmptyState icon={Network} title="No call graph data" subtitle="Run an analysis with the callGraph flag enabled." />
  );

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 520, gap: 0 }}>
      {/* Graph canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
            borderRadius: 6, padding: '4px 10px',
          }}>
            <Search size={12} color="var(--text-muted)" />
            <input
              placeholder="Search nodes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-primary)',
                fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 160,
              }}
            />
          </div>
          <Btn variant="subtle" size="sm" onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.2)} title="Zoom in"><ZoomIn size={13} /></Btn>
          <Btn variant="subtle" size="sm" onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 0.8)} title="Zoom out"><ZoomOut size={13} /></Btn>
          <Btn variant="subtle" size="sm" onClick={() => cyInstance.current?.fit()} title="Fit"><Maximize2 size={13} /></Btn>
          <Btn
            variant={showDeadCode ? 'ghost' : 'subtle'}
            size="sm"
            onClick={() => setShowDeadCode(v => !v)}
            title="Toggle dead-code dimming"
          >
            {showDeadCode ? 'Dim Dead Code' : 'Show All'}
          </Btn>
          {(sourceNodeId || targetNodeId) && (
            <Btn variant="danger" size="sm" onClick={clearPath}>Clear Path</Btn>
          )}
        </div>

        {/* Path status banner */}
        {sourceNodeId && (
          <div style={{
            position: 'absolute', top: 55, left: 12, zIndex: 10,
            background: 'rgba(20,20,30,0.95)', border: '1px solid var(--bg-border)',
            borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)',
            display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 320,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
              <span style={{ fontFamily: 'JetBrains Mono', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                Source: {sourceNodeId.split(':').pop()}
              </span>
            </div>
            {targetNodeId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontFamily: 'JetBrains Mono', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  Target: {targetNodeId.split(':').pop()}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Select another node → "Set as Target" to find attack path.</div>
            )}
            {pathLoading && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-amber)' }}><Loader size={11} /> Querying backend for shortest path…</div>}
            {!pathLoading && pathResult !== null && (
              <div style={{ fontWeight: 600, color: pathResult.length > 0 ? '#f97316' : 'var(--status-red)', marginTop: 2 }}>
                {pathResult.length > 0
                  ? `✓ Attack path: ${pathResult.length} hops (server BFS)`
                  : '✕ No reachable path found'}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 10,
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 6, padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)',
          display: 'flex', gap: 12,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} /> Sink (server catalog)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316' }} /> Attack Path (backend BFS)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, opacity: 0.3, background: '#888' }} /> Dead Code
          </span>
        </div>

        <div ref={cyRef} style={{ width: '100%', height: '100%', minHeight: 520, background: 'var(--bg-base)' }} />
      </div>

      {/* Side detail panel */}
      {selected && (
        <div style={{
          width: 320, background: 'var(--bg-surface)', borderLeft: '1px solid var(--bg-border)',
          padding: 16, overflow: 'auto', animation: 'slideIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: 14
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Method Detail</div>
            {selected.isSink && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 6,
                padding: '6px 10px', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10
              }}>
                <AlertOctagon size={13} /> {selected.riskCategory || 'DANGEROUS SINK'}
              </div>
            )}
            {selected.reachable === false && (
              <div style={{
                background: 'rgba(100,100,120,0.15)', color: 'var(--text-muted)', borderRadius: 6,
                padding: '6px 10px', fontSize: 11, marginBottom: 10
              }}>
                ⚠ Unreachable from entry point (dead code)
              </div>
            )}
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-primary)',
              background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 10px',
              wordBreak: 'break-all',
            }}>
              {selected.id}
            </div>
          </div>

          {/* Pathfinding Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="subtle" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSourceNodeId(selected.id)}>
              <GitMerge size={12} /> Set as Source
            </Btn>
            <Btn variant="subtle" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTargetNodeId(selected.id)}>
              <AlertOctagon size={12} /> Set as Target
            </Btn>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Class</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              {selected.cls}
            </div>
          </div>

          {selected.incoming.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Callers ({selected.incoming.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selected.incoming.slice(0, 10).map(id => (
                  <div key={id} style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-secondary)',
                    background: 'var(--bg-elevated)', borderRadius: 4, padding: '4px 8px',
                    wordBreak: 'break-all',
                  }}>{id}</div>
                ))}
                {selected.incoming.length > 10 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>…and {selected.incoming.length - 10} more</div>}
              </div>
            </div>
          )}

          {selected.outgoing.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Callees ({selected.outgoing.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selected.outgoing.slice(0, 10).map(id => (
                  <div key={id} style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-secondary)',
                    background: 'var(--bg-elevated)', borderRadius: 4, padding: '4px 8px',
                    wordBreak: 'break-all',
                  }}>{id}</div>
                ))}
                {selected.outgoing.length > 10 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>…and {selected.outgoing.length - 10} more</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
