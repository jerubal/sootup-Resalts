import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { ToastProvider, JobsProvider, useJobs } from './context';
import { Dashboard } from './components/Dashboard';
import { NewAnalysisForm } from './components/NewAnalysisForm';
import { JobDetail } from './components/JobDetail';
import { MobSFViewer } from './components/MobSFViewer';
import { DiffViewer } from './components/DiffViewer';
import { CommandPalette } from './components/CommandPalette';
import { GodModeConsole } from './components/GodModeConsole';
import { WelcomeScreen } from './components/WelcomeScreen';
import {
  LayoutGrid, PlusCircle, FlaskConical, ShieldAlert, GitCompare,
  Terminal, Keyboard, ChevronRight, Activity, Home, Menu, X
} from 'lucide-react';
import './index.css';

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({ mobileOpen, onClose }) {
  const { jobs } = useJobs();
  const runningCount = jobs.filter(j => j.status === 'RUNNING').length;
  const queuedCount  = jobs.filter(j => j.status === 'QUEUED').length;
  const recentJobs   = jobs.slice(0, 3);

  const navStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 6, textDecoration: 'none',
    fontSize: 13, fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: isActive ? 'var(--bg-elevated)' : 'transparent',
    borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
    transition: 'all 0.15s',
  });

  return (
    <nav 
      className={`sidebar-nav ${mobileOpen ? 'mobile-open' : ''}`}
      style={{
        width: 220, flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 12px',
        height: '100%',
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '0 4px' }}>
        <div style={{
          width: 30, height: 30, background: 'var(--accent-subtle)',
          border: '1px solid var(--accent)33', borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FlaskConical size={16} color="var(--accent)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>SootUp</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Analysis Platform</div>
        </div>
        {mobileOpen && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Living Job Status bar */}
      {(runningCount > 0 || queuedCount > 0) && (
        <div style={{
          marginBottom: 16, padding: '8px 10px',
          background: 'rgba(0, 255, 102, 0.04)',
          border: '1px solid rgba(0, 255, 102, 0.15)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--status-green)', flexShrink: 0,
            animation: 'liveRing 1.4s ease-in-out infinite',
          }} />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>
            {runningCount > 0 && <><strong style={{ color: 'var(--status-green)' }}>{runningCount}</strong> running</>}
            {runningCount > 0 && queuedCount > 0 && ' · '}
            {queuedCount > 0 && <><strong style={{ color: 'var(--status-amber)' }}>{queuedCount}</strong> queued</>}
          </div>
          <Activity size={11} color="var(--status-green)" />
        </div>
      )}

      {/* Nav links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} onClick={onClose}>
        <NavLink to="/welcome" end style={({ isActive }) => navStyle(isActive)}>
          <Home size={14} /> Welcome
        </NavLink>
        <NavLink to="/dashboard" style={({ isActive }) => navStyle(isActive)}>
          <LayoutGrid size={14} /> Dashboard
        </NavLink>
        <NavLink to="/new" style={({ isActive }) => navStyle(isActive)}>
          <PlusCircle size={14} /> New Analysis
        </NavLink>
        <NavLink to="/mobsf" style={({ isActive }) => navStyle(isActive)}>
          <ShieldAlert size={14} /> MobSF Report
        </NavLink>
        <NavLink to="/diff" style={({ isActive }) => navStyle(isActive)}>
          <GitCompare size={14} /> Scan Diffing
        </NavLink>

        {/* God Mode */}
        <div style={{ marginTop: 8, marginBottom: 2 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0 4px', marginBottom: 4 }}>
            Power
          </div>
        </div>
        <NavLink to="/god-mode" style={({ isActive }) => ({
          ...navStyle(isActive),
          borderLeft: `2px solid ${isActive ? 'var(--status-amber)' : 'transparent'}`,
          color: isActive ? 'var(--status-amber)' : 'var(--text-secondary)',
          background: isActive ? 'rgba(255,170,0,0.06)' : 'transparent',
        })}>
          <Terminal size={14} color="var(--status-amber)" />
          <span>God Mode</span>
          <span style={{
            marginLeft: 'auto', fontSize: 9, background: 'rgba(255,170,0,0.1)',
            border: '1px solid rgba(255,170,0,0.2)', borderRadius: 4,
            padding: '1px 5px', color: 'var(--status-amber)', fontWeight: 700,
          }}>PRO</span>
        </NavLink>
      </div>

      {/* Recent jobs */}
      {recentJobs.length > 0 && (
        <div style={{ marginTop: 20 }} onClick={onClose}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0 4px', marginBottom: 6 }}>
            Recent Jobs
          </div>
          {recentJobs.map(j => (
            <NavLink key={j.jobId} to={`/job/${j.jobId}`} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              borderRadius: 5, textDecoration: 'none', fontSize: 11,
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              marginBottom: 2, transition: 'all 0.12s',
            })}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: j.status === 'RUNNING' ? 'var(--status-green)' : j.status === 'COMPLETED' ? 'var(--status-green)' : j.status === 'FAILED' ? 'var(--status-red)' : '#5c7064',
              }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {j.targetPath?.split(/[/\\]/).pop() || j.jobId}
              </span>
              <ChevronRight size={10} />
            </NavLink>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', padding: '8px 4px', borderTop: '1px solid var(--bg-border)', paddingTop: 12 }}>
        <button
          onClick={() => {}} 
          title="Ctrl+K"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
            borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          <Keyboard size={11} />
          <span style={{ flex: 1, textAlign: 'left' }}>Command Palette</span>
          <kbd style={{ fontSize: 9, background: 'var(--bg-surface)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--bg-border)' }}>⌘K</kbd>
        </button>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          Static bytecode analysis via SootUp
        </div>
      </div>
    </nav>
  );
}

/* ─── App Shell ───────────────────────────────────────────────────────────── */
function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">

      {/* Mobile Top Bar — CSS shows this on ≤768px, hides on desktop */}
      <div className="mobile-topbar" style={{
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--bg-border)',
        width: '100%', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, background: 'var(--accent-subtle)',
            border: '1px solid rgba(0,255,102,0.3)', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FlaskConical size={14} color="var(--accent)" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>SootUp</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>Analysis Platform</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 6 }}
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="app-box">
        {/* Backdrop overlay when sidebar open on mobile */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(3px)', zIndex: 999,
            }}
          />
        )}

        <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }} className="page-transition">
            <Routes>
              <Route path="/"            element={<WelcomeScreen />} />
              <Route path="/welcome"     element={<WelcomeScreen />} />
              <Route path="/dashboard"   element={<Dashboard />} />
              <Route path="/new"         element={<NewAnalysisForm />} />
              <Route path="/job/:jobId"  element={<JobDetail />} />
              <Route path="/mobsf"       element={<MobSFViewer />} />
              <Route path="/diff"        element={<DiffViewer />} />
              <Route path="/god-mode"    element={<GodModeConsole />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Root ─────────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <JobsProvider>
          <CommandPalette />
          <AppShell />
        </JobsProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
