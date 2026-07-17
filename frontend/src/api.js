const API_HOST = import.meta.env.VITE_API_URL || '';
const BASE = `${API_HOST}/api/v1/analyses`;

/** Generic helper: wraps fetch + json parse + error throw */
async function request(url, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || err.message || `HTTP ${res.status}`), { response: { data: err } });
  }
  return { data: await res.json() };
}

export const api = {
  /* ── Analysis Jobs ───────────────────────────────────────────────── */
  submitJob:       (payload) => request(BASE, 'POST', payload).then(r => r.data),
  listJobs:        ()        => fetch(BASE).then(r => r.ok ? r.json() : []),
  getJobStatus:    (id)      => request(`${BASE}/${id}`).then(r => r.data),
  getJobResult:    (id)      => request(`${BASE}/${id}/result`).then(r => r.data),
  getCallGraph:    (id)      => request(`${BASE}/${id}/callgraph`).then(r => r.data),
  getCfg:          (id, m)   => request(`${BASE}/${id}/cfg/${encodeURIComponent(m)}`).then(r => r.data),
  getJimple:       (id, m)   => request(`${BASE}/${id}/jimple/${encodeURIComponent(m)}`).then(r => r.data),
  exportJob:       (id)      => request(`${BASE}/${id}/export`).then(r => r.data),
  cancelJob:       (id)      => request(`${BASE}/${id}`, 'DELETE').then(r => r.data),
  getShortestPath: (id, f, t) => {
    const p = new URLSearchParams({ from: f, to: t });
    return request(`${BASE}/${id}/paths?${p}`).then(r => r.data);
  },
  getTaintChains:  (id)      => request(`${BASE}/${id}/taint`).then(r => r.data),
  diffJobs:        (a, b)    => {
    const p = new URLSearchParams({ jobId1: a, jobId2: b });
    return request(`${BASE}/diff?${p}`).then(r => r.data);
  },

  /* ── GM-1: REPL Query Console ───────────────────────────────────── */
  post: (path, body) => request(`${API_HOST}/api/v1${path}`, 'POST', body),

  /* ── GM-2: Live catalog hot-swap ────────────────────────────────── */
  put:  (path, body) => request(`${API_HOST}/api/v1${path}`, 'PUT', body),

  /* ── GM-4/6/8: Admin GET endpoints ─────────────────────────────── */
  get:  (path)       => request(`${API_HOST}/api/v1${path}`, 'GET'),

  /* ── FR-M: Business-Context Tags ───────────────────────────────────── */
  getTags:   (jobId)         => request(`${API_HOST}/api/v1/analyses/${jobId}/tags`).then(r => r.data),
  addTag:    (jobId, body)   => request(`${API_HOST}/api/v1/analyses/${jobId}/tags`, 'POST', body).then(r => r.data),
  deleteTag: (jobId, pat)    => request(`${API_HOST}/api/v1/analyses/${jobId}/tags/${encodeURIComponent(pat)}`, 'DELETE').then(r => r.data),
};
