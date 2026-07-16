import React, { useEffect, useState } from 'react';
import { Card, EmptyState, Btn } from './ui';
import { ShieldAlert, RefreshCw, AlertTriangle, Link2, Box } from 'lucide-react';
import { api } from '../api';

export function CrossRefViewer({ jobId, onSelectMethod }) {
  const [report, setReport] = useState(null);
  const [cgNodes, setCgNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    // Load MobSF report from localStorage
    try {
      const mobsf = JSON.parse(localStorage.getItem('mobsf_report'));
      setReport(mobsf);
    } catch (e) {
      console.error(e);
    }

    // Load Call Graph nodes
    if (jobId) {
      setLoading(true);
      api.getCallGraph(jobId)
        .then(res => setCgNodes(res.nodes || []))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [jobId]);

  // Compute cross-reference intersections
  useEffect(() => {
    if (!report || cgNodes.length === 0) {
      setMatches([]);
      return;
    }

    const found = [];

    // Match 1: Permissions matching classes/methods in the bytecode (e.g. dynamic API matches)
    if (report.android_api) {
      Object.entries(report.android_api).forEach(([apiName, apiInfo]) => {
        // e.g. "java.lang.Runtime" or dynamic loading
        const matchingNodes = cgNodes.filter(n => 
          n.data.id.includes(apiName) || 
          (apiInfo.files && Object.keys(apiInfo.files).some(f => n.data.id.includes(f.replace('.java', ''))) )
        );

        if (matchingNodes.length > 0) {
          found.push({
            type: 'Dangerous API Usage',
            source: `MobSF: ${apiName}`,
            description: apiInfo.metadata?.description || 'Dangerous API method called in bytecode.',
            severity: 'warning',
            nodes: matchingNodes.map(n => n.data.id),
          });
        }
      });
    }

    // Match 2: Activities / Services / Receivers declared in manifest matching loaded classes
    const components = [
      ...(report.manifest_analysis?.activities || []),
      ...(report.manifest_analysis?.services || []),
      ...(report.manifest_analysis?.receivers || []),
      ...(report.manifest_analysis?.providers || []),
    ];

    components.forEach(comp => {
      const compClass = typeof comp === 'string' ? comp : comp.name || '';
      if (!compClass) return;

      const matchingNodes = cgNodes.filter(n => n.data.class && n.data.class.includes(compClass));
      if (matchingNodes.length > 0) {
        found.push({
          type: 'Component Entry Point',
          source: `Manifest: ${compClass}`,
          description: `Declared Android Component found in Call Graph, containing ${matchingNodes.length} analysable methods.`,
          severity: 'info',
          nodes: matchingNodes.map(n => n.data.id),
        });
      }
    });

    setMatches(found);
  }, [report, cgNodes]);

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Analyzing cross-references...</div>;
  }

  if (!report) {
    return (
      <div style={{ padding: 48 }}>
        <EmptyState
          icon={ShieldAlert}
          title="No MobSF Report Loaded"
          subtitle="Upload a response.json report in the MobSF tab first to cross-reference static findings with this call graph."
        />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div style={{ padding: 48 }}>
        <EmptyState
          icon={RefreshCw}
          title="No Direct Class/Method Matches Found"
          subtitle={`Loaded MobSF report package (${report.package_name}) does not directly overlap with the classes in this class graph.`}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Cross-referencing MobSF static finding nodes with the analyzed Call Graph elements:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {matches.map((match, idx) => (
          <Card key={idx} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: match.severity === 'warning' ? 'var(--status-amber)' : 'var(--accent)',
                  background: match.severity === 'warning' ? 'var(--status-amber-bg)' : 'var(--accent-subtle)',
                  padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase'
                }}>{match.type}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>{match.source}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.nodes.length} call graph nodes matched</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{match.description}</div>
            
            <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Matching bytecode methods:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {match.nodes.slice(0, 5).map((nodeId, nidx) => (
                  <div key={nidx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{nodeId}</span>
                    <Btn size="xs" variant="subtle" onClick={() => onSelectMethod(nodeId)}>
                      <Link2 size={11} /> Trace Jimple
                    </Btn>
                  </div>
                ))}
                {match.nodes.length > 5 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 4 }}>+ {match.nodes.length - 5} more matching methods</div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
