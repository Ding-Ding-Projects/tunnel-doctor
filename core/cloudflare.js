// Minimal Cloudflare API v4 client. The token is passed in per call and never
// logged; errors carry the API's own messages without request headers.

const API = 'https://api.cloudflare.com/client/v4';

export class CloudflareError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || [];
  }
}

export function createClient(token, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (!token || typeof token !== 'string') throw new CloudflareError('No API token is configured', 0);

  async function call(method, path, body) {
    const res = await fetchImpl(API + path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
    let json;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok || !json || json.success === false) {
      const errs = (json && json.errors) || [];
      const msg = errs.map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
      throw new CloudflareError(`Cloudflare API ${method} ${path.split('?')[0]} failed: ${msg}`, res.status, errs);
    }
    return json;
  }

  async function all(path) {
    const out = [];
    for (let page = 1; page < 100; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const json = await call('GET', `${path}${sep}page=${page}&per_page=100`);
      out.push(...(json.result || []));
      const info = json.result_info;
      if (!info || page >= (info.total_pages || 1)) break;
    }
    return out;
  }

  return {
    verify: () => call('GET', '/user/tokens/verify').then((j) => j.result),
    zones: () => all('/zones'),
    dnsRecords: (zoneId, name) => all(`/zones/${zoneId}/dns_records${name ? `?name=${encodeURIComponent(name)}` : ''}`),
    patchRecord: (zoneId, id, patch) => call('PATCH', `/zones/${zoneId}/dns_records/${id}`, patch).then((j) => j.result),
    createRecord: (zoneId, rec) => call('POST', `/zones/${zoneId}/dns_records`, rec).then((j) => j.result),
    deleteRecord: (zoneId, id) => call('DELETE', `/zones/${zoneId}/dns_records/${id}`).then((j) => j.result),
    zoneSetting: (zoneId, key) => call('GET', `/zones/${zoneId}/settings/${key}`).then((j) => j.result),
    tunnels: (accountId) => all(`/accounts/${accountId}/cfd_tunnel?is_deleted=false`),
    tunnel: (accountId, id) => call('GET', `/accounts/${accountId}/cfd_tunnel/${id}`).then((j) => j.result),
    tunnelConfig: (accountId, id) => call('GET', `/accounts/${accountId}/cfd_tunnel/${id}/configurations`).then((j) => j.result),
    putTunnelConfig: (accountId, id, config) => call('PUT', `/accounts/${accountId}/cfd_tunnel/${id}/configurations`, { config }).then((j) => j.result)
  };
}

// Longest-suffix match of a hostname against the account's zones.
export function zoneFor(hostname, zones) {
  const h = hostname.toLowerCase();
  return zones
    .filter((z) => h === z.name || h.endsWith('.' + z.name))
    .sort((a, b) => b.name.length - a.name.length)[0] || null;
}

// The record that answers for a hostname: exact first, then a wildcard one label up.
export function answeringRecord(hostname, records) {
  const h = hostname.toLowerCase();
  const exact = records.filter((r) => r.name.toLowerCase() === h && ['CNAME', 'A', 'AAAA'].includes(r.type));
  if (exact.length) return { record: exact[0], via: 'exact' };
  const wild = '*.' + h.split('.').slice(1).join('.');
  const w = records.filter((r) => r.name.toLowerCase() === wild && ['CNAME', 'A', 'AAAA'].includes(r.type));
  return w.length ? { record: w[0], via: 'wildcard' } : { record: null, via: 'none' };
}
