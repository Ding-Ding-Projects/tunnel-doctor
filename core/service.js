// Transport-free application service shared by every delivery form.
// The desktop app calls it over IPC; the hosted web app calls it from HTTP
// handlers. Storage is injected so each form keeps secrets its own way:
//   storage: {
//     readJson(name, fallback), writeJson(name, value),
//     readSecret(), writeSecret(value), clearSecret()
//   }
// platform: { systemLookup?, listProcesses?, flushDns? }  (desktop only)

import { runChecks, validateHostname, validateOriginUrl, CHECK_IDS } from './checks.js';
import { planFix, applyFix, undoFix, FIXES } from './fixes.js';
import { createClient } from './cloudflare.js';
import { randomUUID } from 'node:crypto';

export const DEFAULT_SETTINGS = Object.freeze({
  language: 'both',          // 'en' | 'yue' | 'both'
  funnyEn: 5,
  funnyYue: 5,
  emoji: true,
  theme: 'system',           // 'light' | 'dark' | 'system'
  accent: '#36618e',
  textScale: 100,
  reducedMotion: 'system',
  sounds: true,
  notifications: true,
  originTimeoutMs: 8000,
  historyLimit: 500,
  onboardingDone: false,
  onboardingStep: 1,
  profiles: []               // [{ id, label, hostname, originUrl }]
});

const SETTING_RULES = {
  language: (v) => ['en', 'yue', 'both'].includes(v),
  funnyEn: (v) => Number.isInteger(v) && v >= 1 && v <= 5,
  funnyYue: (v) => Number.isInteger(v) && v >= 1 && v <= 5,
  emoji: (v) => typeof v === 'boolean',
  theme: (v) => ['light', 'dark', 'system'].includes(v),
  accent: (v) => /^#[0-9a-f]{6}$/i.test(v),
  textScale: (v) => Number.isInteger(v) && v >= 100 && v <= 200,
  reducedMotion: (v) => ['system', 'always'].includes(v),
  sounds: (v) => typeof v === 'boolean',
  notifications: (v) => typeof v === 'boolean',
  originTimeoutMs: (v) => Number.isInteger(v) && v >= 1000 && v <= 60000,
  historyLimit: (v) => Number.isInteger(v) && v >= 10 && v <= 5000,
  onboardingDone: (v) => typeof v === 'boolean',
  onboardingStep: (v) => Number.isInteger(v) && v >= 1 && v <= 5,
  profiles: (v) => Array.isArray(v) && v.length <= 100 && v.every((p) => p && typeof p.id === 'string' && validateHostname(p.hostname) && (!p.originUrl || validateOriginUrl(p.originUrl)))
};

export function createService({ storage, platform = {}, form, version, updatedAt, fetchImpl }) {
  const capabilities = {
    form,
    localDns: Boolean(platform.systemLookup && platform.flushDns),
    processes: Boolean(platform.listProcesses),
    version,
    updatedAt
  };

  const settings = async () => ({ ...DEFAULT_SETTINGS, ...(await storage.readJson('settings', {})) });
  const env = async () => ({ token: await storage.readSecret(), fetchImpl, platform, capabilities });

  async function appendHistory(entry) {
    const s = await settings();
    const list = await storage.readJson('history', []);
    list.unshift(entry);
    await storage.writeJson('history', list.slice(0, s.historyLimit));
    return entry;
  }

  return {
    capabilities: () => ({ ...capabilities, checks: CHECK_IDS, fixes: Object.keys(FIXES) }),

    getSettings: settings,
    async updateSettings(patch) {
      if (!patch || typeof patch !== 'object') throw new Error('Settings must be an object.');
      const next = await settings();
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in SETTING_RULES)) throw new Error(`Unknown setting: ${k}`);
        if (!SETTING_RULES[k](v)) throw new Error(`Invalid value for ${k}`);
        next[k] = v;
      }
      await storage.writeJson('settings', next);
      return next;
    },
    async resetSettings(keys) {
      const cur = await settings();
      const list = keys && keys.length ? keys : Object.keys(DEFAULT_SETTINGS);
      for (const k of list) if (k in DEFAULT_SETTINGS && k !== 'profiles') cur[k] = DEFAULT_SETTINGS[k];
      await storage.writeJson('settings', cur);
      return cur;
    },

    async tokenStatus() {
      return { saved: Boolean(await storage.readSecret()) };
    },
    async saveToken(token) {
      if (typeof token !== 'string' || token.trim().length < 20 || token.length > 400) throw new Error('That does not look like an API token.');
      const cf = createClient(token.trim(), { fetchImpl });
      const v = await cf.verify();
      if (v.status !== 'active') throw new Error(`The token is ${v.status}.`);
      const zones = await cf.zones();
      await storage.writeSecret(token.trim());
      return { saved: true, zones: zones.map((z) => z.name) };
    },
    async clearToken() {
      await storage.clearSecret();
      return { saved: false };
    },
    async zones() {
      const token = await storage.readSecret();
      if (!token) return [];
      return (await createClient(token, { fetchImpl }).zones()).map((z) => ({ id: z.id, name: z.name, status: z.status }));
    },

    async runChecks({ hostname, originUrl }, onResult) {
      if (!validateHostname(hostname)) throw new Error('Enter a hostname such as ha.example.com.');
      if (originUrl && !validateOriginUrl(originUrl)) throw new Error('The origin must be an http:// or https:// address.');
      const s = await settings();
      const e = await env();
      const report = await runChecks({ hostname, originUrl: originUrl || undefined, token: e.token, fetchImpl, timeoutMs: s.originTimeoutMs, capabilities, platform }, onResult);
      await storage.writeJson('last-report', report);
      return report;
    },
    lastReport: () => storage.readJson('last-report', null),

    async planFix(fixId, params) { return planFix(fixId, params, await env()); },
    async applyFix(fixId, params, confirmation) {
      const out = await applyFix(fixId, params, await env(), confirmation);
      return appendHistory({ id: randomUUID(), kind: 'fix', fixId, target: out.plan.target, changes: out.plan.changes, undo: out.undo, at: out.at, undone: false });
    },
    async undo(historyId) {
      const list = await storage.readJson('history', []);
      const item = list.find((x) => x.id === historyId);
      if (!item) throw new Error('That history entry no longer exists.');
      if (item.undone) throw new Error('That fix was already undone.');
      await undoFix(item.undo, await env());
      item.undone = true;
      await storage.writeJson('history', list);
      return appendHistory({ id: randomUUID(), kind: 'undo', fixId: item.fixId, target: item.target, changes: item.changes.map((c) => ({ field: c.field, before: c.after, after: c.before })), undo: null, at: new Date().toISOString(), undone: false });
    },
    // History never exposes undo payloads (they can hold full tunnel configs).
    async history() {
      return (await storage.readJson('history', [])).map(({ undo, ...rest }) => ({ ...rest, canUndo: Boolean(undo) && !rest.undone }));
    }
  };
}
