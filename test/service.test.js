import test from 'node:test';
import assert from 'node:assert/strict';
import { createService, DEFAULT_SETTINGS } from '../core/service.js';

export function memoryStorage() {
  const files = new Map();
  let secret = null;
  return {
    readJson: async (n, fb) => (files.has(n) ? structuredClone(files.get(n)) : fb),
    writeJson: async (n, v) => { files.set(n, structuredClone(v)); },
    readSecret: async () => secret,
    writeSecret: async (v) => { secret = v; },
    clearSecret: async () => { secret = null; },
    _files: files
  };
}

test('settings validate, persist and reset', async () => {
  const svc = createService({ storage: memoryStorage(), form: 'hosted', version: '0.0.0', updatedAt: null });
  assert.equal((await svc.getSettings()).funnyEn, 5);
  await svc.updateSettings({ funnyEn: 2, language: 'en' });
  assert.equal((await svc.getSettings()).funnyEn, 2);
  await assert.rejects(svc.updateSettings({ funnyEn: 9 }), /Invalid/);
  await assert.rejects(svc.updateSettings({ nope: 1 }), /Unknown/);
  await svc.resetSettings(['funnyEn']);
  assert.equal((await svc.getSettings()).funnyEn, DEFAULT_SETTINGS.funnyEn);
  assert.equal((await svc.getSettings()).language, 'en');
});

test('hosted form reports desktop-only capabilities as off', () => {
  const svc = createService({ storage: memoryStorage(), form: 'hosted', version: '1', updatedAt: null });
  const caps = svc.capabilities();
  assert.equal(caps.localDns, false);
  assert.equal(caps.processes, false);
  assert.ok(caps.fixes.includes('set-proxied'));
});

test('input validation rejects bad hostnames and origin schemes', async () => {
  const svc = createService({ storage: memoryStorage(), form: 'hosted', version: '1', updatedAt: null, fetchImpl: async () => { throw new Error('no network'); } });
  await assert.rejects(svc.runChecks({ hostname: 'not a host' }), /hostname/);
  await assert.rejects(svc.runChecks({ hostname: 'ha.example.com', originUrl: 'file:///x' }), /origin/);
});

test('history hides undo payloads', async () => {
  const st = memoryStorage();
  await st.writeJson('history', [{ id: 'h1', kind: 'fix', undo: { fixId: 'add-route', params: { previous: { secret: 1 } } }, undone: false }]);
  const svc = createService({ storage: st, form: 'hosted', version: '1', updatedAt: null });
  const h = await svc.history();
  assert.equal(h[0].canUndo, true);
  assert.equal(h[0].undo, undefined);
});
