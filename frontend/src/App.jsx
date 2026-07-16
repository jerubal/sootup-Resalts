import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { ToastProvider, JobsProvider } from './context';
import { Dashboard } from './components/Dashboard';
import { NewAnalysisForm } from './components/NewAnalysisForm';
import { JobDetail } from './components/JobDetail';
import { MobSFViewer } from './components/MobSFViewer';
import { LayoutGrid, PlusCircle, FlaskConical, ShieldAlert } from 'lucide-react';
import './index.css';

function Sidebar() {
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
    <nav style={{
      width: 220, flexShrink: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--bg-border)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 12px',
      height: '100vh',
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '0 4px' }}>
        <div style={{
          width: 30, height: 30, background: 'var(--accent-subtle)',
          border: '1px solid var(--accent)33', borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FlaskConical size={16} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>SootUp</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Analysis Platform</div>
        </div>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavLink to="/" end style={({ isActive }) => navStyle(isActive)}>
          <LayoutGrid size={14} />
          Dashboard
        </NavLink>
        <NavLink to="/new" style={({ isActive }) => navStyle(isActive)}>
          <PlusCircle size={14} />
          New Analysis
        </NavLink>
        <NavLink to="/mobsf" style={({ isActive }) => navStyle(isActive)}>
          <ShieldAlert size={14} />
          MobSF Report
        </NavLink>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--bg-border)', paddingTop: 12 }}>
        Static bytecode analysis via SootUp
      </div>
    </nav>
  );
}

function AppShell() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewAnalysisForm />} />
          <Route path="/job/:jobId" element={<JobDetail />} />
          <Route path="/mobsf" element={<MobSFViewer />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <JobsProvider>
          <AppShell />
        </JobsProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
