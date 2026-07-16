const BASE = '/api/v1/analyses';

export const api = {
  // Submit a new analysis job
  submitJob: async (payload) => {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // Get all jobs (backend returns list or we list from local cache)
  listJobs: async () => {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Poll status of a single job
  getJobStatus: async (jobId) => {
    const res = await fetch(`${BASE}/${jobId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get full result summary
  getJobResult: async (jobId) => {
    const res = await fetch(`${BASE}/${jobId}/result`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get call graph
  getCallGraph: async (jobId) => {
    const res = await fetch(`${BASE}/${jobId}/callgraph`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get CFG for a specific method signature
  getCfg: async (jobId, methodSig) => {
    const encoded = encodeURIComponent(methodSig);
    const res = await fetch(`${BASE}/${jobId}/cfg/${encoded}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get Jimple IR for a specific method signature
  getJimple: async (jobId, methodSig) => {
    const encoded = encodeURIComponent(methodSig);
    const res = await fetch(`${BASE}/${jobId}/jimple/${encoded}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get full export
  exportJob: async (jobId) => {
    const res = await fetch(`${BASE}/${jobId}/export`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Cancel a running job
  cancelJob: async (jobId) => {
    const res = await fetch(`${BASE}/${jobId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get shortest call-graph path between two method signatures (Fix 1).
  // Calls the real backend BFS over the full graph — not limited to paginated client data.
  getShortestPath: async (jobId, from, to) => {
    const params = new URLSearchParams({ from, to });
    const res = await fetch(`${BASE}/${jobId}/paths?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json(); // returns string[] — ordered list of method IDs on the path
  },
};

