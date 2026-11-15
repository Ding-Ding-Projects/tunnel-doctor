// The diagnosis engine. Every check returns a plain result object:
//   { id, status: 'pass'|'warn'|'fail'|'skip'|'error', code, params, evidence: string[], fix? }
// `code` and `params` are rendered into each interface language by web/i18n.js,
// so the engine itself carries no user-facing prose.

import { DEFAULT_RESOLVERS, resolveHost, isTunnelTarget, tunnelIdFromTarget, isPrivateAddress } from './doh.js';
import { createClient, zoneFor, answeringRecord } from './cloudflare.js';

export const CHECK_IDS = ['public-dns', 'zone-record', 'tunnel-health', 'tunnel-route', 'edge-http', 'origin', 'ha-proxy', 'ssl-mode', 'local-cache', 'token-exposure'];

const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export function validateHostname(h) {
  return typeof h === 'string' && HOSTNAME_RE.test(h.trim());
}

export function validateOriginUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch { return false; }
}

const r = (id, status, code, params = {}, evidence = [], fix) => ({ id, status, code, params, evidence, ...(fix ? { fix } : {}) });

function classifyNetError(err) {
  const c = (err && (err.cause?.code || err.code)) || '';
  if (/ECONNREFUSED/.test(c)) return 'refused';
  if (/EHOSTUNREACH|ENETUNREACH/.test(c)) return 'unreachable';
  if (/ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/.test(c) || err?.name === 'TimeoutError') return 'timeout';
  if (/ENOTFOUND|EAI_AGAIN/.test(c)) return 'dns';
  if (/CERT|SSL|TLS/.test(c)) return 'tls';
  return 'other';
}

async function probe(url, { fetchImpl, timeoutMs, headers }) {
  const t0 = Date.now();
  try {
    const res = await fetchImpl(url, { redirect: 'manual', headers, signal: AbortSignal.timeout(timeoutMs) });
    const text = (await res.text()).slice(0, 4000);
    return { ok: true, status: res.status, ms: Date.now() - t0, text, server: res.headers.get('server') || '' };
  } catch (err) {
    return { ok: false, kind: classifyNetError(err), ms: Date.now() - t0, message: String(err?.cause?.code || err?.message || err) };
  }
}

// ctx: { hostname, token?, accountId?, originUrl?, resolvers?, fetchImpl?, timeoutMs?,
//        capabilities: { localDns: bool, processes: bool }, platform: { systemLookup?, listProcesses? } }
export async function runChecks(ctx, onResult = () => {}) {
  const hostname = ctx.hostname.trim().toLowerCase();
  const fetchImpl = ctx.fetchImpl || fetch;
  const timeoutMs = ctx.timeoutMs || 8000;
  const resolvers = ctx.resolvers || DEFAULT_RESOLVERS;
  const caps = ctx.capabilities || {};
  const state = {};
  const results = [];
  const emit = (res) => { results.push(res); onResult(res); return res; };

  // 1. Public DNS through every resolver.
  try {
    const answers = await Promise.all(resolvers.map((rv) => resolveHost(rv, hostname, { fetchImpl, timeoutMs })));
    state.dns = answers;
    const ev = answers.map((a) => `${a.resolver}: ${a.nxdomain ? 'NXDOMAIN' : [...a.cnames.map((c) => 'CNAME ' + c), ...a.ipv4.map((x) => 'A ' + x), ...a.ipv6.map((x) => 'AAAA ' + x)].join(', ') || 'no answer'}`);
    const tunnelOnly = answers.find((a) => a.cnames.some(isTunnelTarget) && a.ipv4.length === 0 && a.ipv6.every(isPrivateAddress));
    const sigs = new Set(answers.map((a) => [...a.ipv4].sort().join(',') + '|' + a.nxdomain));
    if (answers.every((a) => a.nxdomain)) emit(r('public-dns', 'fail', 'dns.nxdomain', { hostname }, ev));
    else if (tunnelOnly) {
      state.tunnelId = tunnelIdFromTarget(tunnelOnly.cnames.find(isTunnelTarget));
      emit(r('public-dns', 'fail', 'dns.unproxied-tunnel', { hostname, resolver: tunnelOnly.resolver }, ev));
    } else if (sigs.size > 1) emit(r('public-dns', 'warn', 'dns.resolvers-disagree', { hostname }, ev));
    else emit(r('public-dns', 'pass', 'dns.ok', { hostname, addresses: answers[0].ipv4.join(', ') }, ev));
  } catch (err) {
    emit(r('public-dns', 'error', 'check.error', { message: err.message }));
  }

  // 2-4, 8. Everything that needs the Cloudflare API.
  let cf = null;
  if (ctx.token) {
    try { cf = createClient(ctx.token, { fetchImpl }); } catch { cf = null; }
  }
  if (!cf) {
    for (const id of ['zone-record', 'tunnel-health', 'tunnel-route', 'ssl-mode']) emit(r(id, 'skip', 'skip.no-token'));
  } else {
    try {
      const zones = await cf.zones();
      const zone = zoneFor(hostname, zones);
      if (!zone) {
        emit(r('zone-record', 'fail', 'zone.not-in-account', { hostname }, [`zones: ${zones.map((z) => z.name).join(', ') || 'none'}`]));
      } else {
        state.zone = zone;
        state.accountId = ctx.accountId || zone.account?.id;
        const records = await cf.dnsRecords(zone.id);
        const { record, via } = answeringRecord(hostname, records);
        state.record = record;
        const ev = [`zone ${zone.name} (${zone.status})`, record ? `${record.type} ${record.name} -> ${record.content} proxied=${record.proxied}` : `no record for ${hostname}`];
        if (record && isTunnelTarget(record.content)) state.tunnelId = state.tunnelId || tunnelIdFromTarget(record.content);
        if (!record) {
          emit(r('zone-record', 'fail', 'zone.missing-record', { hostname, zone: zone.name }, ev,
            state.tunnelId ? { id: 'create-record', params: { zoneId: zone.id, hostname, tunnelId: state.tunnelId } } : undefined));
        } else if (isTunnelTarget(record.content) && record.proxied === false) {
          emit(r('zone-record', 'fail', 'zone.unproxied', { hostname, name: record.name }, ev,
            { id: 'set-proxied', params: { zoneId: zone.id, recordId: record.id, name: record.name } }));
        } else if (via === 'wildcard') {
          emit(r('zone-record', 'warn', 'zone.wildcard-only', { hostname, name: record.name }, ev,
            isTunnelTarget(record.content) ? { id: 'create-record', params: { zoneId: zone.id, hostname, tunnelId: tunnelIdFromTarget(record.content) } } : undefined));
        } else emit(r('zone-record', 'pass', 'zone.ok', { hostname, type: record.type, proxied: String(record.proxied) }, ev));

        // SSL mode.
        try {
          const ssl = await cf.zoneSetting(zone.id, 'ssl');
          const origin = ctx.originUrl ? new URL(ctx.originUrl) : null;
          if (ssl.value === 'flexible' && origin?.protocol === 'https:') emit(r('ssl-mode', 'warn', 'ssl.flexible-https-origin', { mode: ssl.value }, [`ssl=${ssl.value}`]));
          else if (ssl.value === 'off') emit(r('ssl-mode', 'warn', 'ssl.off', { mode: ssl.value }, [`ssl=${ssl.value}`]));
          else emit(r('ssl-mode', 'pass', 'ssl.ok', { mode: ssl.value }, [`ssl=${ssl.value}`]));
        } catch (err) { emit(r('ssl-mode', 'error', 'check.error', { message: err.message })); }
      }
    } catch (err) {
      emit(r('zone-record', 'error', 'check.error', { message: err.message }));
    }

    // Tunnel health and route.
    if (!state.tunnelId || !state.accountId) {
      emit(r('tunnel-health', 'skip', 'skip.no-tunnel'));
      emit(r('tunnel-route', 'skip', 'skip.no-tunnel'));
    } else {
      try {
        const t = await cf.tunnel(state.accountId, state.tunnelId);
        const conns = (t.connections || []).filter((c) => !c.is_pending_reconnect).length;
        const ev = [`tunnel ${t.name} (${t.id})`, `status: ${t.status}`, `connections: ${conns}`];
        if (t.status === 'healthy') emit(r('tunnel-health', 'pass', 'tunnel.healthy', { name: t.name, connections: conns }, ev));
        else if (t.status === 'degraded') emit(r('tunnel-health', 'warn', 'tunnel.degraded', { name: t.name, connections: conns }, ev));
        else emit(r('tunnel-health', 'fail', 'tunnel.down', { name: t.name, status: t.status }, ev));
      } catch (err) { emit(r('tunnel-health', 'error', 'check.error', { message: err.message })); }

      try {
        const cfg = await cf.tunnelConfig(state.accountId, state.tunnelId);
        const ingress = cfg?.config?.ingress || [];
        const rule = ingress.find((x) => x.hostname && x.hostname.toLowerCase() === hostname);
        const ev = ingress.map((x) => `${x.hostname || '(catch-all)'} -> ${x.service}`);
        if (rule) {
          state.service = rule.service;
          emit(r('tunnel-route', 'pass', 'route.ok', { hostname, service: rule.service }, ev));
        } else if (cfg?.source === 'local' || !cfg?.config) {
          emit(r('tunnel-route', 'warn', 'route.locally-managed', { hostname }, ev));
        } else {
          emit(r('tunnel-route', 'fail', 'route.missing', { hostname }, ev,
            ctx.originUrl ? { id: 'add-route', params: { accountId: state.accountId, tunnelId: state.tunnelId, hostname, service: ctx.originUrl } } : undefined));
        }
      } catch (err) { emit(r('tunnel-route', 'error', 'check.error', { message: err.message })); }
    }
  }

  // 5. The public edge.
  const edge = await probe(`https://${hostname}/`, { fetchImpl, timeoutMs });
  if (!edge.ok) emit(r('edge-http', 'fail', `edge.${edge.kind}`, { hostname }, [edge.message]));
  else {
    const cfCode = /error code:?\s*(\d{3,4})/i.exec(edge.text)?.[1] || (/Error (\d{4})/.exec(edge.text)?.[1]);
    const ev = [`HTTP ${edge.status} in ${edge.ms} ms`, edge.server && `server: ${edge.server}`, cfCode && `edge error ${cfCode}`].filter(Boolean);
    if (cfCode === '1033') emit(r('edge-http', 'fail', 'edge.1033', { hostname }, ev));
    else if (edge.status === 502 || edge.status === 530) emit(r('edge-http', 'fail', 'edge.bad-gateway', { hostname, status: edge.status }, ev));
    else if (edge.status >= 500) emit(r('edge-http', 'fail', 'edge.5xx', { hostname, status: edge.status }, ev));
    else if (edge.status === 400) emit(r('edge-http', 'fail', 'edge.400', { hostname }, ev));
    else emit(r('edge-http', 'pass', 'edge.ok', { hostname, status: edge.status, ms: edge.ms }, ev));
    state.edgeStatus = edge.status;
  }

  // 6-7. The origin service behind the tunnel.
  const originUrl = ctx.originUrl || (state.service && /^https?:/.test(state.service) ? state.service : null);
  if (!originUrl) {
    emit(r('origin', 'skip', 'skip.no-origin'));
    emit(r('ha-proxy', 'skip', 'skip.no-origin'));
  } else {
    const plain = await probe(originUrl, { fetchImpl, timeoutMs });
    if (!plain.ok) emit(r('origin', 'fail', `origin.${plain.kind}`, { url: originUrl }, [plain.message]));
    else emit(r('origin', plain.status < 500 ? 'pass' : 'fail', plain.status < 500 ? 'origin.ok' : 'origin.5xx', { url: originUrl, status: plain.status, ms: plain.ms }, [`HTTP ${plain.status} in ${plain.ms} ms`]));

    const isHa = plain.ok && /<title>\s*Home Assistant\s*<\/title>/i.test(plain.text);
    if (!plain.ok) emit(r('ha-proxy', 'skip', 'skip.origin-down'));
    else if (!isHa) emit(r('ha-proxy', 'skip', 'skip.not-ha'));
    else {
      const fwd = await probe(originUrl, { fetchImpl, timeoutMs, headers: { 'x-forwarded-for': '203.0.113.7', 'x-forwarded-proto': 'https', 'x-forwarded-host': hostname } });
      const ev = [`plain: HTTP ${plain.status}`, `with X-Forwarded-For: ${fwd.ok ? 'HTTP ' + fwd.status : fwd.message}`];
      // Home Assistant rejects X-Forwarded-For from any address it does not
      // trust, including this computer. So a 400 here only proves a problem
      // when the public path through the tunnel fails the same way.
      if (fwd.ok && fwd.status === 400) {
        if (state.edgeStatus === 400) emit(r('ha-proxy', 'fail', 'ha.forwarded-rejected', { hostname }, ev));
        else if (state.edgeStatus && state.edgeStatus < 400) emit(r('ha-proxy', 'pass', 'ha.untrusted-here', { hostname }, ev));
        else emit(r('ha-proxy', 'warn', 'ha.forwarded-rejected-unconfirmed', { hostname }, ev));
      } else emit(r('ha-proxy', 'pass', 'ha.ok', {}, ev));
    }
  }

  // 9. This computer's resolver (desktop form only).
  if (!caps.localDns || !ctx.platform?.systemLookup) emit(r('local-cache', 'skip', 'skip.desktop-only'));
  else {
    try {
      const local = await ctx.platform.systemLookup(hostname);
      const pub = new Set((state.dns || []).flatMap((a) => a.ipv4));
      const ev = [`system resolver: ${local.length ? local.join(', ') : 'no answer'}`, `public: ${[...pub].join(', ') || 'none'}`];
      const overlap = local.some((ip) => pub.has(ip));
      if (pub.size && !overlap) emit(r('local-cache', 'fail', 'local.stale', { hostname }, ev, { id: 'flush-dns', params: {} }));
      else emit(r('local-cache', 'pass', 'local.ok', {}, ev));
    } catch (err) {
      const pub = (state.dns || []).some((a) => a.ipv4.length);
      emit(r('local-cache', pub ? 'fail' : 'warn', pub ? 'local.stale' : 'local.no-answer', { hostname }, [`system resolver: ${err.code || err.message}`], pub ? { id: 'flush-dns', params: {} } : undefined));
    }
  }

  // 10. Tunnel tokens visible in local process command lines (desktop form only).
  if (!caps.processes || !ctx.platform?.listProcesses) emit(r('token-exposure', 'skip', 'skip.desktop-only'));
  else {
    try {
      const procs = await ctx.platform.listProcesses();
      const hits = procs.filter((p) => /cloudflared/i.test(p.name || p.command) && /--token(\s|=)/.test(p.command || ''));
      if (hits.length) emit(r('token-exposure', 'warn', 'token.cmdline', { count: hits.length }, hits.map((p) => `pid ${p.pid}: cloudflared ... --token <redacted>`)));
      else emit(r('token-exposure', 'pass', 'token.ok', {}, [`${procs.length} processes scanned`]));
    } catch (err) { emit(r('token-exposure', 'error', 'check.error', { message: err.message })); }
  }

  return { hostname, at: new Date().toISOString(), results, summary: summarize(results) };
}

export function summarize(results) {
  const count = (s) => results.filter((x) => x.status === s).length;
  return { fail: count('fail'), warn: count('warn'), pass: count('pass'), skip: count('skip'), error: count('error') };
}
