import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Shield, Target, BookOpen, AlertTriangle, ChevronDown, ChevronRight, ArrowRight, ExternalLink } from 'lucide-react';

function OWASPPanel() {
  const [expanded, setExpanded] = useState(null);
  const [owaspData, setOwaspData] = useState({ items: [], lastUpdated: '', edition: '' });
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const API_HOST = import.meta.env.VITE_API_URL || '';
    fetch(`${API_HOST}/api/v1/content/owasp-top10`)
      .then(r => r.json())
      .then(data => {
        setOwaspData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading OWASP Top 10 data...</div>;
  }

  // Icons mapping
  const getIcon = (id) => {
    if (id.includes('A01')) return '🔓';
    if (id.includes('A02')) return '⚙️';
    if (id.includes('A03')) return '📦';
    if (id.includes('A04')) return '🔐';
    if (id.includes('A05')) return '💉';
    if (id.includes('A06')) return '📐';
    if (id.includes('A07')) return '🪪';
    if (id.includes('A08')) return '🧩';
    if (id.includes('A09')) return '📋';
    if (id.includes('A10')) return '🌐';
    return '🛡️';
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{owaspData.edition || 'OWASP Top 10'}</span>
        <a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noreferrer"
          style={{ fontSize: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          <ExternalLink size={10} /> owasp.org
        </a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {owaspData.items && owaspData.items.map(item => (
          <div key={item.rank}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setExpanded(expanded === item.rank ? null : item.rank)}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                color: 'var(--text-primary)', textAlign: 'left'
              }}>
              <span style={{ fontSize: 15 }}>{getIcon(item.id)}</span>
              <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'JetBrains Mono', fontWeight: 600, minWidth: 62 }}>{item.id}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{item.name}</span>
              {expanded === item.rank ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
            </button>
            {expanded === item.rank && (
              <div style={{ padding: '0 12px 12px 48px', borderTop: '1px solid var(--bg-border)' }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 8px' }}>{item.description}</p>
                <a href={item.owaspUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                  Full details on owasp.org <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, textAlign: 'right' }}>
        Last updated: {owaspData.lastUpdated || 'Unknown'} · Sourced from OWASP Project
      </p>
    </div>
  );
}

const TABS = [
  {
    id: 'red', label: 'Red Teaming', icon: Target,
    content: (
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>What is Red Teaming?</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 12px' }}>
          Red teaming is a <strong style={{ color: 'var(--text-primary)' }}>full-scope, adversary simulation</strong> exercise where
          a team (the "red team") emulates real-world attacker tactics, techniques, and procedures (TTPs) against an organization
          with no prior knowledge of its defenses. Unlike a pentest, there is no defined scope boundary — the objective is to achieve
          a specific goal (e.g. access payroll data) by any means an attacker would use.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: 'var(--accent)' }}>How this platform fits in:</strong> Static bytecode analysis (what SootUp provides)
          is a pre-engagement reconnaissance tool for red teams — quickly identifying dangerous sinks, call paths, and data flows
          in a target's compiled Java codebase before active exploitation begins.
        </p>
      </div>
    )
  },
  {
    id: 'pentest', label: 'Penetration Testing', icon: Shield,
    content: (
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Penetration Testing Methodology</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 12px' }}>
          A penetration test is a <strong style={{ color: 'var(--text-primary)' }}>time-boxed, scoped security assessment</strong> that
          identifies and exploits vulnerabilities in a defined target system. Standard phases include Reconnaissance, Scanning,
          Exploitation, Post-Exploitation, and Reporting.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: 'var(--accent)' }}>Static analysis in the pentest workflow:</strong> Source/bytecode analysis
          occurs in the Reconnaissance and Vulnerability Discovery phases — before any active exploitation. SootUp analysis
          surfaces injection sinks, dangerous deserialization paths, and taint flows, dramatically shortening the time from
          "I have the JAR" to "I have a target attack surface."
        </p>
      </div>
    )
  },
  {
    id: 'sootup', label: 'What is SootUp', icon: FlaskConical,
    content: (
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>SootUp & This Platform</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 12px' }}>
          <strong style={{ color: 'var(--text-primary)' }}>SootUp</strong> is a modern, re-architected Java bytecode analysis
          framework (successor to Soot). It parses compiled <code style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>.class</code> and
          <code style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>.jar</code> files into an intermediate
          representation called <strong style={{ color: 'var(--text-primary)' }}>Jimple</strong>, then builds call graphs and
          control-flow graphs (CFGs) over the entire codebase — without running a single line of code.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: 'var(--accent)' }}>This platform</strong> wraps SootUp in a Spring Boot REST API and a React
          dashboard, adding: configurable sink/source catalogs, taint chain discovery, call-graph visualization (Cytoscape),
          policy-as-code enforcement, and the God Mode analyst layer documented in this screen.
        </p>
      </div>
    )
  },
  { id: 'owasp', label: 'OWASP Top 10', icon: AlertTriangle, content: <OWASPPanel /> },
];

export function WelcomeScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('red');
  const [dontShow, setDontShow] = useState(false);

  const handleEnter = () => {
    if (dontShow) localStorage.setItem('skipWelcome', '1');
    navigate('/dashboard');
  };

  const activeTabData = TABS.find(t => t.id === activeTab);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', minHeight: '100%', overflowY: 'auto',
      padding: '24px 16px 32px', background: 'var(--bg-base)', boxSizing: 'border-box',
    }}>
      {/* Hero / Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
        <div style={{
          width: 130, height: 130, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(110,123,255,0.15) 0%, rgba(110,123,255,0.04) 100%)',
          border: '2px solid rgba(110,123,255,0.35)',
          boxShadow: '0 0 40px rgba(110,123,255,0.18), 0 0 80px rgba(110,123,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, position: 'relative',
          animation: 'pulseRing 3s ease-in-out infinite',
        }}>
          <div style={{
            position: 'absolute', inset: 6, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(110,123,255,0.1), rgba(0,0,0,0.5))',
            border: '1px solid rgba(110,123,255,0.2)',
          }} />
          <FlaskConical size={44} color="var(--accent)" style={{ position: 'relative', zIndex: 1 }} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
          SootUp Analysis Platform
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0', textAlign: 'center' }}>
          Static bytecode security analysis · Call graph intelligence · God Mode analyst layer
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ width: '100%', maxWidth: 760 }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 2, background: 'var(--bg-elevated)',
          borderRadius: 10, padding: 4, border: '1px solid var(--bg-border)',
          marginBottom: 20,
        }}>
          {TABS.map(t => {
            const isActive = t.id === activeTab;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 12px', background: isActive ? 'var(--bg-surface)' : 'transparent',
                  border: isActive ? '1px solid var(--bg-border)' : '1px solid transparent',
                  borderRadius: 7, cursor: 'pointer',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: isActive ? 600 : 400, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                }}>
                <t.icon size={13} color={isActive ? 'var(--accent)' : 'currentColor'} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content panel */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
          borderRadius: 12, padding: '24px 28px', minHeight: 280,
          animation: 'slideFadeIn 0.2s ease forwards',
        }}>
          {activeTabData?.content}
        </div>
      </div>

      {/* Enter platform */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 28 }}>
        <button
          onClick={handleEnter}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 32px', background: 'var(--accent)', border: 'none',
            borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(110,123,255,0.4)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'none'; }}>
          Enter Platform <ArrowRight size={16} />
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 12, height: 12 }} />
          Don\'t show this screen again
        </label>
      </div>

      <style>{`
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 40px rgba(110,123,255,0.18), 0 0 80px rgba(110,123,255,0.06); }
          50% { box-shadow: 0 0 60px rgba(110,123,255,0.30), 0 0 100px rgba(110,123,255,0.10); }
        }
      `}</style>
    </div>
  );
}
