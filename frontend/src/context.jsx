import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';

const ToastContext = createContext(null);
const JobsContext  = createContext(null);

// ─── Toast Context ────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add    = useCallback((msg, type = 'info') => {
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
  const typeColor = { success: 'var(--status-green)', error: 'var(--status-red)', warning: 'var(--status-amber)' };
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 8, padding: '10px 16px', minWidth: 260, maxWidth: 380,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          borderLeft: `3px solid ${typeColor[t.type] || 'var(--accent)'}`,
          animation: 'slideFadeIn 0.2s ease',
        }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{t.msg}</span>
          <button onClick={() => onDismiss(t.id)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      ))}
    </div>
  );
}

export function useToast() { return useContext(ToastContext); }

// ─── Jobs Context ──────────────────────────────────────────────────────────────
// Merges server-persisted jobs (jobs.json) with session cache (localStorage).
// Backend is the source of truth; localStorage fills the gap for fields like
// targetPath that the old summary endpoint didn't return.

const LOCAL_KEY = 'sootup_jobs';

function localLoad()    { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } }
function localSave(jobs) { localStorage.setItem(LOCAL_KEY, JSON.stringify(jobs)); }

/** Merge server list into local list. Server wins on status/progress/message.
 *  Local wins on targetPath/analysisFlags when server doesn't return them. */
function mergeJobs(local, server) {
  const byId = {};
  local.forEach(j  => { byId[j.jobId] = { ...j }; });
  server.forEach(s => {
    const base = byId[s.jobId] || {};
    byId[s.jobId] = {
      ...base,
      ...s,
      // keep local targetPath if server didn't return it
      targetPath:    s.targetPath    || base.targetPath    || '',
      analysisFlags: s.analysisFlags || base.analysisFlags || [],
      cgAlgorithm:   s.cgAlgorithm   || base.cgAlgorithm   || 'CHA',
      submittedAt:   s.submittedAt   || s.createdAt || base.submittedAt || 0,
    };
  });
  return Object.values(byId).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
}

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState(() => localLoad());
  const pollingRef = useRef({});
  const toast = useToast();

  /* ── Helpers ─────────────────────────────────────────────────────── */
  const applyAndSave = useCallback((updater) => {
    setJobs(prev => {
      const next = updater(prev);
      localSave(next);
      return next;
    });
  }, []);

  const addJob    = useCallback((job) => applyAndSave(prev =>
    [job, ...prev.filter(j => j.jobId !== job.jobId)]), [applyAndSave]);

  const updateJob = useCallback((jobId, patch) => applyAndSave(prev =>
    prev.map(j => j.jobId === jobId ? { ...j, ...patch } : j)), [applyAndSave]);

  const removeJob = useCallback((jobId) => applyAndSave(prev =>
    prev.filter(j => j.jobId !== jobId)), [applyAndSave]);

  /* ── Polling ─────────────────────────────────────────────────────── */
  const pollJob = useCallback((jobId) => {
    if (pollingRef.current[jobId]) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.getJobStatus(jobId);
        updateJob(jobId, {
          status:      data.status,
          progress:    data.progress,
          message:     data.message,
          completedAt: data.completedAt,
        });
        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          delete pollingRef.current[jobId];
          toast?.add(`✓ Analysis complete: ${jobId.slice(0, 8)}…`, 'success');
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          delete pollingRef.current[jobId];
          toast?.add(`✗ Analysis failed: ${data.message || jobId.slice(0, 8)}`, 'error');
        }
      } catch (e) {
        console.error('Poll error', e);
      }
    }, 3000);
    pollingRef.current[jobId] = interval;
  }, [updateJob, toast]);

  /* ── Hydrate from backend on mount ──────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.listJobs();
        // Backend returns { jobs: [...], total: N } OR a plain array
        const serverJobs = Array.isArray(res) ? res : (res.jobs || []);
        if (serverJobs.length > 0) {
          setJobs(prev => {
            const merged = mergeJobs(prev, serverJobs);
            localSave(merged);
            return merged;
          });
        }
      } catch (e) {
        console.warn('Could not hydrate from backend:', e.message);
      }
    })();
  }, []); // eslint-disable-line

  /* ── Resume polling for in-flight jobs ───────────────────────────── */
  useEffect(() => {
    jobs.forEach(j => {
      if (j.status === 'RUNNING' || j.status === 'QUEUED') pollJob(j.jobId);
    });
    return () => Object.values(pollingRef.current).forEach(clearInterval);
  }, []); // eslint-disable-line

  /* ── Submit ──────────────────────────────────────────────────────── */
  const submitJob = useCallback(async (payload) => {
    const res = await api.submitJob(payload);
    const job = {
      jobId:         res.jobId,
      status:        res.status  || 'QUEUED',
      targetPath:    payload.targetPath,
      submittedAt:   Date.now(),
      createdAt:     Date.now(),
      progress:      0,
      message:       res.message || '',
      analysisFlags: payload.analysisFlags || [],
      cgAlgorithm:   payload.cgAlgorithm   || 'CHA',
    };
    addJob(job);
    pollJob(res.jobId);
    return job;
  }, [addJob, pollJob]);

  /* ── Cancel ──────────────────────────────────────────────────────── */
  const cancelJob = useCallback(async (jobId) => {
    clearInterval(pollingRef.current[jobId]);
    delete pollingRef.current[jobId];
    try { await api.cancelJob(jobId); } catch { /* best effort */ }
    updateJob(jobId, { status: 'CANCELLED' });
    toast?.add(`Job ${jobId.slice(0, 8)}… cancelled.`, 'warning');
  }, [updateJob, toast]);

  return (
    <JobsContext.Provider value={{ jobs, submitJob, cancelJob, removeJob, pollJob }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() { return useContext(JobsContext); }
