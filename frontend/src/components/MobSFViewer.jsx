import React, { useState, useCallback } from 'react';
import { SectionHeader, Card, StatCard, Tabs, EmptyState, StatusBadge, Btn } from './ui';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Info,
  Package, Activity, Wifi, Lock, Code2, Upload, FileJson,
  ChevronDown, ChevronRight, ExternalLink, Smartphone, Link2, Globe
} from 'lucide-react';

// ─── Severity badge ───────────────────────────────────────────────────────────
const SEVERITY = {
  high:    { color: 'var(--status-red)',   bg: 'var(--status-red-bg)',   label: 'High' },
  medium:  { color: 'var(--status-amber)', bg: 'var(--status-amber-bg)', label: 'Medium' },
  warning: { color: 'var(--status-amber)', bg: 'var(--status-amber-bg)', label: 'Warning' },
  info:    { color: '#06b6d4',             bg: 'rgba(6,182,212,0.1)',    label: 'Info' },
  low:     { color: '#22c55e',             bg: 'rgba(34,197,94,0.1)',    label: 'Low' },
  secure:  { color: 'var(--status-green)', bg: 'var(--status-green-bg)', label: 'Secure' },
};
function SeverityBadge({ level }) {
  const s = SEVERITY[(level || 'info').toLowerCase()] || SEVERITY.info;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
    }}>{s.label}</span>
  );
}

// ─── Collapsible finding row ──────────────────────────────────────────────────
function FindingRow({ title, severity, description, reference }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--bg-border)' }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {open ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
        <SeverityBadge level={severity} />
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {open && (
        <div style={{ padding: '8px 16px 14px 42px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {description && <div style={{ margin: '0 0 6px' }} dangerouslySetInnerHTML={{ __html: description }} />}
          {reference && (
            <a href={reference} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11 }}>
              <ExternalLink size={11} /> Reference
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section: App Info ────────────────────────────────────────────────────────
function AppInfoSection({ data }) {
  const fields = [
    ['App Name',      data.app_name],
    ['Package',       data.package_name],
    ['Version',       data.version_name],
    ['Version Code',  data.version_code],
    ['File Name',     data.file_name],
    ['File Size',     data.size],
    ['MD5 Hash',      data.md5],
    ['SHA256 Hash',   data.sha256],
    ['Target SDK',    data.target_sdk],
    ['Min SDK',       data.min_sdk],
    ['Main Activity', data.main_activity],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {fields.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
        <div key={label} style={{
          background: 'var(--bg-elevated)', borderRadius: 6, padding: '10px 14px',
          border: '1px solid var(--bg-border)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Section: Permissions ─────────────────────────────────────────────────────
function PermissionsSection({ permissions }) {
  if (!permissions || typeof permissions !== 'object') return <EmptyState icon={Lock} title="No permission data" />;
  const entries = Object.entries(permissions);
  const [filter, setFilter] = useState('all');
  const danger = entries.filter(([, v]) => (v.status || '').toLowerCase() === 'dangerous');
  const normal = entries.filter(([, v]) => (v.status || '').toLowerCase() !== 'dangerous');
  const shown = filter === 'dangerous' ? danger : filter === 'normal' ? normal : entries;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['all', `All (${entries.length})`], ['dangerous', `Dangerous (${danger.length})`], ['normal', `Normal (${normal.length})`]].map(([k, l]) => (
          <Btn key={k} variant={filter === k ? 'subtle' : 'ghost'} size="sm" onClick={() => setFilter(k)}>{l}</Btn>
        ))}
      </div>
      <Card>
        {shown.map(([perm, info]) => (
          <div key={perm} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px',
            borderBottom: '1px solid var(--bg-border)',
          }}>
            <SeverityBadge level={(info.status || '').toLowerCase() === 'dangerous' ? 'high' : 'low'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-primary)' }}>{perm}</div>
              {info.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{info.description}</div>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Section: Dangerous APIs ──────────────────────────────────────────────────
function AndroidApiSection({ apiData }) {
  if (!apiData || typeof apiData !== 'object') return <EmptyState icon={AlertTriangle} title="No Dangerous API data found" />;
  
  const entries = Object.entries(apiData);
  if (entries.length === 0) return <EmptyState icon={AlertTriangle} title="No Dangerous APIs detected" />;

  return (
    <Card>
      {entries.map(([key, val]) => {
        const severity = val.metadata?.severity || 'warning';
        const desc = val.metadata?.description || key;
        const fileList = Object.entries(val.files || {}).map(([file, lines]) => `${file} (lines: ${lines})`).join('\n');
        
        return (
          <FindingRow
            key={key}
            title={desc}
            severity={severity}
            description={`
              <strong>API Type / Key:</strong> <code style="font-family: JetBrains Mono">${key}</code><br/><br/>
              <strong>Referenced Files:</strong><pre style="margin: 6px 0; font-family: JetBrains Mono; background: var(--bg-elevated); padding: 8px; border-radius: 4px; font-size: 11px; white-space: pre-wrap">${fileList}</pre>
            `}
          />
        );
      })}
    </Card>
  );
}

// ─── Section: Manifest Analysis ───────────────────────────────────────────────
function ManifestSection({ findings }) {
  const list = Array.isArray(findings) ? findings : [];
  if (list.length === 0) return <EmptyState icon={Shield} title="No manifest findings" />;

  return (
    <Card>
      {list.map((f, i) => (
        <FindingRow
          key={i}
          title={f.title || f.name}
          severity={f.severity || 'warning'}
          description={`
            ${f.description || ''}<br/>
            ${f.component && f.component.length ? `<br/><strong>Components affected:</strong><br/><pre style="font-family: JetBrains Mono; background: var(--bg-elevated); padding: 8px; border-radius: 4px; font-size: 11px; white-space: pre-wrap">${JSON.stringify(f.component, null, 2)}</pre>` : ''}
          `}
        />
      ))}
    </Card>
  );
}

// ─── Section: Certificate Analysis ────────────────────────────────────────────
function CertificateSection({ cert }) {
  if (!cert) return <EmptyState icon={Shield} title="No certificate data" />;
  const info = cert.certificate_info || (typeof cert === 'string' ? cert : '');
  const findings = cert.certificate_findings || [];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {findings.length > 0 && (
        <Card>
          {findings.map((f, i) => (
            <FindingRow
              key={i}
              title={f[1] || f[2]}
              severity={f[0]}
              description={f[1]}
            />
          ))}
        </Card>
      )}
      
      {info && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Certificate Metadata</div>
          <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.7 }}>
            {info}
          </pre>
        </Card>
      )}
    </div>
  );
}

// ─── Section: URL and Domains ─────────────────────────────────────────────────
function UrlDomainSection({ urls, domains }) {
  const urlList = Array.isArray(urls) ? urls : [];
  const domainList = typeof domains === 'object' ? Object.keys(domains || {}) : [];

  const [activeSubTab, setActiveSubTab] = useState('urls');

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <Btn variant={activeSubTab === 'urls' ? 'subtle' : 'ghost'} size="sm" onClick={() => setActiveSubTab('urls')}>Extracted URLs ({urlList.length})</Btn>
        <Btn variant={activeSubTab === 'domains' ? 'subtle' : 'ghost'} size="sm" onClick={() => setActiveSubTab('domains')}>Domains ({domainList.length})</Btn>
      </div>

      {activeSubTab === 'urls' ? (
        <Card>
          {urlList.map((item, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg-border)', fontSize: 12 }}>
              <div style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
                {Array.isArray(item.urls) ? item.urls.join(', ') : String(item.urls)}
              </div>
              {item.path && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Found in: {item.path}
                </div>
              )}
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          {domainList.map((d, i) => (
            <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--bg-border)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
              {d}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────
function DropZone({ onLoad }) {
  const [dragging, setDragging] = useState(false);
  const handle = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { onLoad(JSON.parse(e.target.result)); } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  }, [onLoad]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--bg-border)'}`,
        borderRadius: 10, padding: '60px 40px', textAlign: 'center',
        background: dragging ? 'var(--accent-subtle)' : 'var(--bg-surface)',
        transition: 'all 0.2s', cursor: 'pointer',
      }}
      onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = e => handle(e.target.files[0]); i.click(); }}
    >
      <Upload size={36} color={dragging ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth={1.5} />
      <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Drop MobSF JSON report here</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>or click to browse — supports MobSF v4+ static analysis output</div>
    </div>
  );
}

// ─── Main MobSF Viewer ────────────────────────────────────────────────────────
export function MobSFViewer() {
  const [report, setReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mobsf_report')); } catch { return null; }
  });
  const [tab, setTab] = useState('overview');

  const handleSetReport = useCallback((data) => {
    setReport(data);
    if (data) {
      localStorage.setItem('mobsf_report', JSON.stringify(data));
    } else {
      localStorage.removeItem('mobsf_report');
    }
  }, []);

  if (!report) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 800 }}>
        <SectionHeader title="MobSF Report Viewer" subtitle="Import a MobSF static analysis JSON report to visualize findings" />
        <DropZone onLoad={handleSetReport} />
      </div>
    );
  }


  // Compute stats
  const permEntries = report.permissions ? Object.entries(report.permissions) : [];
  const dangerousPerms = permEntries.filter(([, v]) => (v.status || '').toLowerCase() === 'dangerous').length;
  const manifestFindingsCount = report.manifest_analysis?.manifest_findings ? report.manifest_analysis.manifest_findings.length : 0;
  const apiFindingsCount = report.android_api ? Object.keys(report.android_api).length : 0;
  const urlCount = Array.isArray(report.urls) ? report.urls.length : 0;

  const tabs = [
    { id: 'overview',    label: 'Overview',      icon: Smartphone },
    { id: 'permissions', label: `Permissions (${permEntries.length})`, icon: Lock },
    { id: 'manifest',    label: `Manifest (${manifestFindingsCount})`, icon: Shield },
    { id: 'api',         label: `Dangerous APIs (${apiFindingsCount})`, icon: AlertTriangle },
    { id: 'urls',        label: `URLs/Domains (${urlCount})`, icon: Link2 },
    { id: 'certificate', label: 'Certificate', icon: Shield },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: 'var(--accent-subtle)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={18} color="var(--accent)" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{report.app_name || report.file_name}</h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{report.package_name}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>MobSF {report.version}</span>
          <Btn variant="subtle" size="sm" onClick={() => handleSetReport(null)}><Upload size={13} /> Load another</Btn>
        </div>
      </div>


      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={Package}       label="App Size"          value={report.size} color="#7c85ff" />
        <StatCard icon={Shield}        label="Manifest Alerts"   value={manifestFindingsCount} color="var(--status-red)" />
        <StatCard icon={AlertTriangle} label="Dangerous APIs"    value={apiFindingsCount} color="var(--status-amber)" />
        <StatCard icon={Lock}          label="Dangerous Perms"   value={dangerousPerms} color="var(--status-amber)" />
        <StatCard icon={Link2}         label="Extracted URLs"    value={urlCount} color="#06b6d4" />
      </div>

      {/* Tabs */}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '0 20px' }}>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          {tab === 'overview'    && <AppInfoSection data={report} />}
          {tab === 'permissions' && <PermissionsSection permissions={report.permissions} />}
          {tab === 'manifest'    && <ManifestSection findings={report.manifest_analysis?.manifest_findings} />}
          {tab === 'api'         && <AndroidApiSection apiData={report.android_api} />}
          {tab === 'urls'        && <UrlDomainSection urls={report.urls} domains={report.domains} />}
          {tab === 'certificate' && <CertificateSection cert={report.certificate_analysis} />}
        </div>
      </Card>
    </div>
  );
}
