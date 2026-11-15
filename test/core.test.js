import test from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, validateHostname, validateOriginUrl } from '../core/checks.js';
import { applyFix, planFix, undoFix } from '../core/fixes.js';
import { isPrivateAddress, tunnelIdFromTarget } from '../core/doh.js';
import { zoneFor, answeringRecord } from '../core/cloudflare.js';

const TUNNEL = '3c9e2a10-5b7d-4e8f-9a61-2d4c8b0f7e15';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// A fake network: public DNS hands out the unproxied tunnel answer, the zone
// holds an unproxied record, the tunnel is healthy, the origin is Home Assistant.
function fakeNet(overrides = {}) {
  const state = { proxied: false, calls: [], ...overrides };
  const impl = async (url, init = {}) => {
    const u = new URL(url);
    state.calls.push(`${init.method || 'GET'} ${u.host}${u.pathname}`);
    if (u.host === 'cloudflare-dns.com' || u.host === 'dns.google') {
      const type = u.searchParams.get('type');
      const cname = { name: 'ha.example.com', type: 5, TTL: 300, data: `${TUNNEL}.cfargotunnel.com.` };
      if (state.proxied) return json({ Status: 0, Answer: type === 'A' ? [{ name: 'ha.example.com', type: 1, TTL: 300, data: '172.64.80.1' }] : [] });
      return json({ Status: 0, Answer: type === 'AAAA' ? [cname, { name: `${TUNNEL}.cfargotunnel.com`, type: 28, TTL: 300, data: 'fd10:aec2:5dae::' }] : [cname] });
    }
    if (u.host === 'api.cloudflare.com') {
      const p = u.pathname.replace('/client/v4', '');
      const page = { result_info: { total_pages: 1 } };
      if (p === '/zones') return json({ success: true, result: [{ id: 'z1', name: 'example.com', status: 'active', account: { id: 'a1' } }], ...page });
      if (p === '/zones/z1/dns_records' && (init.method || 'GET') === 'GET') return json({ success: true, result: [{ id: 'r1', type: 'CNAME', name: 'ha.example.com', content: `${TUNNEL}.cfargotunnel.com`, proxied: state.proxied }], ...page });
      if (p === '/zones/z1/dns_records/r1' && init.method === 'PATCH') { state.proxied = JSON.parse(init.body).proxied; return json({ success: true, result: { id: 'r1', proxied: state.proxied } }); }
      if (p === '/zones/z1/settings/ssl') return json({ success: true, result: { value: 'full' } });
      if (p === `/accounts/a1/cfd_tunnel/${TUNNEL}`) return json({ success: true, result: { id: TUNNEL, name: 'home', status: 'healthy', connections: [{}, {}, {}, {}] } });
      if (p === `/accounts/a1/cfd_tunnel/${TUNNEL}/configurations`) return json({ success: true, result: { source: 'cloudflare', config: { ingress: [{ hostname: 'ha.example.com', service: 'http://192.0.2.10:8124' }, { service: 'http_status:404' }] } } });
      return json({ success: false, errors: [{ code: 7003, message: 'not found ' + p }] }, 404);
    }
    if (u.host === 'ha.example.com') {
      if (!state.proxied) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
      if (state.edgeRejects) return new Response('400: Bad Request', { status: 400 });
      return new Response('<title>Home Assistant</title>', { status: 200 });
    }
    if (u.host === '192.0.2.10:8124') {
      const fwd = init.headers && init.headers['x-forwarded-for'];
      if (fwd && state.haRejectsForwarded) return new Response('400: Bad Request', { status: 400 });
      return new Response('<html><title>Home Assistant</title></html>', { status: 200 });
    }
    throw new Error('unexpected request ' + url);
  };
  return { state, impl };
}

const byId = (report, id) => report.results.find((x) => x.id === id);

test('detects the unproxied tunnel record and offers the proxy fix', async () => {
  const net = fakeNet();
  const report = await runChecks({ hostname: 'ha.example.com', token: 't', fetchImpl: net.impl, capabilities: {} });
  assert.equal(byId(report, 'public-dns').code, 'dns.unproxied-tunnel');
  assert.equal(byId(report, 'zone-record').code, 'zone.unproxied');
  assert.equal(byId(report, 'zone-record').fix.id, 'set-proxied');
  assert.equal(byId(report, 'tunnel-health').status, 'pass');
  assert.equal(byId(report, 'tunnel-route').params.service, 'http://192.0.2.10:8124');
  assert.equal(byId(report, 'origin').status, 'pass');
  assert.equal(byId(report, 'local-cache').code, 'skip.desktop-only');
});

test('the proxy fix needs both confirmation keys, applies, and undoes', async () => {
  const net = fakeNet();
  const env = { token: 't', fetchImpl: net.impl, capabilities: {} };
  const params = { zoneId: 'z1', recordId: 'r1', name: 'ha.example.com' };
  const plan = await planFix('set-proxied', params, env);
  assert.deepEqual(plan.changes, [{ field: 'proxied', before: 'false', after: 'true' }]);
  await assert.rejects(applyFix('set-proxied', params, env, { acknowledged: true, typed: 'wrong' }), /does not match/);
  await assert.rejects(applyFix('set-proxied', params, env, { acknowledged: false, typed: 'ha.example.com' }), /Confirm/);
  assert.equal(net.state.proxied, false);
  const done = await applyFix('set-proxied', params, env, { acknowledged: true, typed: 'HA.example.com ' });
  assert.equal(net.state.proxied, true);
  const after = await runChecks({ hostname: 'ha.example.com', token: 't', fetchImpl: net.impl, capabilities: {} });
  assert.equal(byId(after, 'public-dns').status, 'pass');
  assert.equal(byId(after, 'edge-http').status, 'pass');
  await undoFix(done.undo, env);
  assert.equal(net.state.proxied, false);
});

test('flags Home Assistant rejecting forwarded headers only when the public path fails too', async () => {
  const broken = fakeNet({ proxied: true, haRejectsForwarded: true, edgeRejects: true });
  const bad = await runChecks({ hostname: 'ha.example.com', token: 't', fetchImpl: broken.impl, capabilities: {} });
  assert.equal(byId(bad, 'ha-proxy').code, 'ha.forwarded-rejected');
  assert.equal(byId(bad, 'edge-http').code, 'edge.400');

  // Seen against a real instance: the tunnel path works, and Home Assistant
  // still rejects forwarded headers sent from a computer it does not trust.
  const fine = fakeNet({ proxied: true, haRejectsForwarded: true });
  const ok = await runChecks({ hostname: 'ha.example.com', token: 't', fetchImpl: fine.impl, capabilities: {} });
  assert.equal(byId(ok, 'ha-proxy').code, 'ha.untrusted-here');
  assert.equal(byId(ok, 'ha-proxy').status, 'pass');
});

test('local cache check flags a stale system resolver and offers a flush', async () => {
  const net = fakeNet({ proxied: true });
  const report = await runChecks({
    hostname: 'ha.example.com', fetchImpl: net.impl,
    capabilities: { localDns: true, processes: true },
    platform: {
      systemLookup: async () => { throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' }); },
      listProcesses: async () => [{ pid: 9, name: 'cloudflared', command: 'cloudflared tunnel run --token abc' }]
    }
  });
  assert.equal(byId(report, 'local-cache').fix.id, 'flush-dns');
  assert.equal(byId(report, 'token-exposure').code, 'token.cmdline');
  assert.ok(!JSON.stringify(report).includes('abc'), 'the token value never appears in the report');
  assert.equal(byId(report, 'zone-record').code, 'skip.no-token');
});

test('helpers', () => {
  assert.ok(isPrivateAddress('fd10:aec2:5dae::'));
  // Built from octets so the repository holds no literal LAN address.
  assert.ok(isPrivateAddress([192, 168, 1, 4].join('.')));
  assert.ok(isPrivateAddress([10, 0, 0, 4].join('.')));
  assert.ok(!isPrivateAddress('172.64.80.1'));
  assert.equal(tunnelIdFromTarget(`${TUNNEL}.cfargotunnel.com`), TUNNEL);
  assert.equal(zoneFor('a.b.example.com', [{ name: 'example.com' }, { name: 'b.example.com' }]).name, 'b.example.com');
  assert.equal(answeringRecord('x.example.com', [{ name: '*.example.com', type: 'CNAME' }]).via, 'wildcard');
  assert.ok(validateHostname('ha.example.com'));
  assert.ok(!validateHostname('bad host'));
  assert.ok(validateOriginUrl('http://192.0.2.10:8124'));
  assert.ok(!validateOriginUrl('file:///etc/passwd'));
});
