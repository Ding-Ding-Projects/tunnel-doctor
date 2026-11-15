// One API surface for the interface. The desktop app's preload script exposes
// window.tunnelDoctor with the same method names; the hosted forms use HTTP.

const desktop = typeof window !== 'undefined' ? window.tunnelDoctor : undefined;

async function http(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-tunnel-doctor': '1' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const hosted = {
  authState: () => http('GET', '/api/auth/state'),
  setup: (password) => http('POST', '/api/auth/setup', { password }),
  login: (password) => http('POST', '/api/auth/login', { password }),
  logout: () => http('POST', '/api/auth/logout'),
  capabilities: () => http('GET', '/api/capabilities'),
  getSettings: () => http('GET', '/api/settings'),
  updateSettings: (patch) => http('PATCH', '/api/settings', patch),
  resetSettings: (keys) => http('POST', '/api/settings/reset', { keys }),
  tokenStatus: () => http('GET', '/api/token'),
  saveToken: (token) => http('PUT', '/api/token', { token }),
  clearToken: () => http('DELETE', '/api/token'),
  zones: () => http('GET', '/api/zones'),
  runChecks: (input) => http('POST', '/api/checks', input),
  lastReport: () => http('GET', '/api/checks/last'),
  planFix: (fixId, params) => http('POST', '/api/fixes/plan', { fixId, params }),
  applyFix: (fixId, params, confirmation) => http('POST', '/api/fixes/apply', { fixId, params, confirmation }),
  undo: (historyId) => http('POST', '/api/fixes/undo', { historyId }),
  history: () => http('GET', '/api/history')
};

const desktopAdapter = desktop && {
  ...Object.fromEntries(Object.keys(hosted).map((k) => [k, (...a) => desktop.call(k, ...a)])),
  authState: async () => ({ configured: true, signedIn: true }),
  logout: async () => ({ signedIn: true })
};

export const api = desktopAdapter || hosted;
export const isDesktop = Boolean(desktopAdapter);
