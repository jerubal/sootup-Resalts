import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';

const ToastContext = createContext(null);
const JobsContext = createContext(null);

// ─── Toast Context ───────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);
  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ add, remove }}>
      {children}
      <ToastDrawer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function ToastDrawer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 8, padding: '10px 16px', minWidth: 260, maxWidth: 380,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          borderLeft: `3px solid ${t.type === 'success' ? 'var(--status-green)' : t.type === 'error' ? 'var(--status-red)' : t.type === 'warning' ? 'var(--status-amber)' : 'var(--accent)'}`,
          animation: 'slideIn 0.2s ease',
        }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{t.msg}</span>
          <button onClick={() => onDismiss(t.id)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
          }}>×</button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ─── Jobs Context ─────────────────────────────────────────────────────────────
// Persists jobs submitted this session (since no GET /analyses list endpoint exists)
const LOCAL_KEY = 'sootup_jobs';

function loadJobs() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch { return []; }
}
function saveJobs(jobs) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(jobs));
}

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState(() => loadJobs());
  const pollingRef = useRef({});
  const toast = useToast();

  const addJob = useCallback((job) => {
    setJobs(prev => {
      const next = [job, ...prev.filter(j => j.jobId !== job.jobId)];
      saveJobs(next);
      return next;
    });
  }, []);

  const updateJob = useCallback((jobId, patch) => {
    setJobs(prev => {
      const next = prev.map(j => j.jobId === jobId ? { ...j, ...patch } : j);
      saveJobs(next);
      return next;
    });
  }, []);

  const removeJob = useCallback((jobId) => {
    setJobs(prev => {
      const next = prev.filter(j => j.jobId !== jobId);
      saveJobs(next);
      return next;
    });
  }, []);

  // Poll running/queued jobs
  const pollJob = useCallback((jobId) => {
    if (pollingRef.current[jobId]) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.getJobStatus(jobId);
        updateJob(jobId, {
          status: data.status, progress: data.progress,
          message: data.message, completedAt: data.completedAt,
        });
        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          delete pollingRef.current[jobId];
          toast?.add(`Analysis completed: ${jobId.slice(0, 8)}…`, 'success');
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          delete pollingRef.current[jobId];
          toast?.add(`Analysis failed: ${data.message}`, 'error');
        }
      } catch (e) {
        console.error('Poll error', e);
      }
    }, 3000);
    pollingRef.current[jobId] = interval;
  }, [updateJob, toast]);

  // Resume polling on mount for any running/queued jobs
  useEffect(() => {
    jobs.forEach(j => {
      if (j.status === 'RUNNING' || j.status === 'QUEUED') pollJob(j.jobId);
    });
    return () => Object.values(pollingRef.current).forEach(clearInterval);
  }, []); // eslint-disable-line

  const submitJob = useCallback(async (payload) => {
    const res = await api.submitJob(payload);
    const job = {
      jobId: res.jobId,
      status: res.status || 'QUEUED',
      targetPath: payload.targetPath,
      submittedAt: Date.now(),
      progress: 0,
      message: res.message || '',
      analysisFlags: payload.analysisFlags,
      cgAlgorithm: payload.cgAlgorithm,
    };
    addJob(job);
    pollJob(res.jobId);
    return job;
  }, [addJob, pollJob]);

  const cancelJob = useCallback(async (jobId) => {
    clearInterval(pollingRef.current[jobId]);
    delete pollingRef.current[jobId];
    try { await api.cancelJob(jobId); } catch { /* best effort */ }
    updateJob(jobId, { status: 'CANCELLED' });
  }, [updateJob]);

  return (
    <JobsContext.Provider value={{ jobs, submitJob, cancelJob, removeJob, pollJob }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  return useContext(JobsContext);
}
