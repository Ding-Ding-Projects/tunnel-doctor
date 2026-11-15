// DNS-over-HTTPS lookups against public resolvers, so answers can be compared
// with each other and with the local system resolver.

export const DEFAULT_RESOLVERS = [
  { id: 'cloudflare', label: '1.1.1.1', url: 'https://cloudflare-dns.com/dns-query' },
  { id: 'google', label: '8.8.8.8', url: 'https://dns.google/resolve' }
];

const TYPE_NAMES = { 1: 'A', 5: 'CNAME', 28: 'AAAA', 16: 'TXT', 2: 'NS' };

export async function dohQuery(resolver, name, type, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const url = `${resolver.url}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const res = await fetchImpl(url, {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`${resolver.label} answered HTTP ${res.status}`);
  const body = await res.json();
  return {
    status: body.Status,
    answers: (body.Answer || []).map((a) => ({
      name: String(a.name).replace(/\.$/, ''),
      type: TYPE_NAMES[a.type] || String(a.type),
      ttl: a.TTL,
      data: String(a.data).replace(/\.$/, '')
    }))
  };
}

// Resolve A and AAAA through one resolver and summarise the chain.
export async function resolveHost(resolver, name, opts) {
  const [a, aaaa] = await Promise.all([dohQuery(resolver, name, 'A', opts), dohQuery(resolver, name, 'AAAA', opts)]);
  const all = [...a.answers, ...aaaa.answers];
  const cnames = all.filter((x) => x.type === 'CNAME').map((x) => x.data);
  return {
    resolver: resolver.label,
    nxdomain: a.status === 3,
    cnames: [...new Set(cnames)],
    ipv4: a.answers.filter((x) => x.type === 'A').map((x) => x.data),
    ipv6: aaaa.answers.filter((x) => x.type === 'AAAA').map((x) => x.data),
    ttl: all.length ? Math.min(...all.map((x) => x.ttl)) : null
  };
}

export function isTunnelTarget(host) {
  return /\.cfargotunnel\.com$/i.test(host || '');
}

export function tunnelIdFromTarget(host) {
  const m = /^([0-9a-f-]{36})\.cfargotunnel\.com$/i.exec(host || '');
  return m ? m[1].toLowerCase() : null;
}

// fc00::/7 unique local, fe80::/10 link local, plus RFC 1918 and loopback.
export function isPrivateAddress(ip) {
  const v = String(ip).toLowerCase();
  if (v.includes(':')) return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v === '::1';
  const p = v.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254);
}
