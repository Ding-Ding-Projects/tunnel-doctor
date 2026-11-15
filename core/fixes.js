// Fixes. Each fix has three steps so the interface can show exactly what will
// change before anything is touched:
//   plan(params, env)          -> { fixId, changes: [{ field, before, after }], request, confirmText }
//   apply(params, env)         -> { undo: { fixId, params } , after }
//   undo(undoParams, env)      -> restores the recorded previous state
// env: { token, fetchImpl, platform: { flushDns? }, capabilities }

import { createClient } from './cloudflare.js';

function client(env) {
  return createClient(env.token, { fetchImpl: env.fetchImpl });
}

async function findRecord(cf, zoneId, recordId) {
  const all = await cf.dnsRecords(zoneId);
  const rec = all.find((x) => x.id === recordId);
  if (!rec) throw new Error('The DNS record no longer exists. Run the checks again.');
  return rec;
}

export const FIXES = {
  'set-proxied': {
    needsToken: true,
    async plan(p, env) {
      const rec = await findRecord(client(env), p.zoneId, p.recordId);
      return {
        fixId: 'set-proxied',
        target: rec.name,
        request: `PATCH /zones/<zone>/dns_records/<record>`,
        changes: [{ field: 'proxied', before: String(rec.proxied), after: 'true' }],
        confirmText: rec.name
      };
    },
    async apply(p, env) {
      const cf = client(env);
      const before = await findRecord(cf, p.zoneId, p.recordId);
      const after = await cf.patchRecord(p.zoneId, p.recordId, { proxied: true });
      return { after: { proxied: after.proxied }, undo: { fixId: 'set-proxied', params: { ...p, proxied: before.proxied } } };
    },
    async undo(u, env) {
      await client(env).patchRecord(u.zoneId, u.recordId, { proxied: u.proxied });
    }
  },

  'create-record': {
    needsToken: true,
    async plan(p) {
      return {
        fixId: 'create-record',
        target: p.hostname,
        request: 'POST /zones/<zone>/dns_records',
        changes: [
          { field: 'type', before: '', after: 'CNAME' },
          { field: 'name', before: '', after: p.hostname },
          { field: 'content', before: '', after: `${p.tunnelId}.cfargotunnel.com` },
          { field: 'proxied', before: '', after: 'true' }
        ],
        confirmText: p.hostname
      };
    },
    async apply(p, env) {
      const rec = await client(env).createRecord(p.zoneId, { type: 'CNAME', name: p.hostname, content: `${p.tunnelId}.cfargotunnel.com`, proxied: true, ttl: 1, comment: 'Created by Tunnel Doctor' });
      return { after: { id: rec.id }, undo: { fixId: 'create-record', params: { zoneId: p.zoneId, recordId: rec.id } } };
    },
    async undo(u, env) {
      await client(env).deleteRecord(u.zoneId, u.recordId);
    }
  },

  'add-route': {
    needsToken: true,
    async plan(p, env) {
      const cfg = await client(env).tunnelConfig(p.accountId, p.tunnelId);
      const count = (cfg?.config?.ingress || []).length;
      return {
        fixId: 'add-route',
        target: p.hostname,
        request: 'PUT /accounts/<account>/cfd_tunnel/<tunnel>/configurations',
        changes: [{ field: 'ingress rules', before: String(count), after: String(count + 1) }, { field: p.hostname, before: '', after: p.service }],
        confirmText: p.hostname
      };
    },
    async apply(p, env) {
      const cf = client(env);
      const cfg = await cf.tunnelConfig(p.accountId, p.tunnelId);
      const config = structuredClone(cfg?.config || {});
      const ingress = config.ingress || [{ service: 'http_status:404' }];
      if (ingress.some((x) => x.hostname?.toLowerCase() === p.hostname.toLowerCase())) throw new Error('A route for this hostname already exists.');
      const catchAllAt = ingress.findIndex((x) => !x.hostname);
      ingress.splice(catchAllAt === -1 ? ingress.length : catchAllAt, 0, { hostname: p.hostname, service: p.service });
      if (catchAllAt === -1) ingress.push({ service: 'http_status:404' });
      config.ingress = ingress;
      await cf.putTunnelConfig(p.accountId, p.tunnelId, config);
      return { after: { ingress: ingress.length }, undo: { fixId: 'add-route', params: { accountId: p.accountId, tunnelId: p.tunnelId, previous: cfg?.config || {} } } };
    },
    async undo(u, env) {
      await client(env).putTunnelConfig(u.accountId, u.tunnelId, u.previous);
    }
  },

  'flush-dns': {
    needsToken: false,
    desktopOnly: true,
    async plan() {
      return { fixId: 'flush-dns', target: 'this computer', request: 'ipconfig /flushdns', changes: [{ field: 'DNS client cache', before: 'cached entries', after: 'empty' }], confirmText: null };
    },
    async apply(_p, env) {
      if (!env.platform?.flushDns) throw new Error('Flushing the DNS cache is only available in the desktop app.');
      await env.platform.flushDns();
      return { after: {}, undo: null };
    }
  }
};

export function getFix(id) {
  const f = FIXES[id];
  if (!f) throw new Error(`Unknown fix: ${id}`);
  return f;
}

export async function planFix(id, params, env) {
  const f = getFix(id);
  if (f.needsToken && !env.token) throw new Error('This fix needs a Cloudflare API token.');
  if (f.desktopOnly && !env.capabilities?.localDns) throw new Error('This fix only works in the desktop app.');
  return f.plan(params, env);
}

// confirmation: { acknowledged: true, typed: '<target>' } -- the two-key rule.
export async function applyFix(id, params, env, confirmation) {
  const plan = await planFix(id, params, env);
  if (!confirmation?.acknowledged) throw new Error('Confirm that you understand the change first.');
  if (plan.confirmText && String(confirmation.typed || '').trim().toLowerCase() !== plan.confirmText.toLowerCase()) {
    throw new Error('The typed confirmation does not match.');
  }
  const out = await getFix(id).apply(params, env);
  return { plan, ...out, at: new Date().toISOString() };
}

export async function undoFix(undo, env) {
  if (!undo) throw new Error('This fix cannot be undone.');
  const f = getFix(undo.fixId);
  if (!f.undo) throw new Error('This fix cannot be undone.');
  await f.undo(undo.params, env);
  return { undone: undo.fixId, at: new Date().toISOString() };
}
